/**
 * Model Catalog Routes — MySQL
 *
 * Provides CRUD for model_specs, plus provider/series listing.
 * System models (workspace_id IS NULL) are readable by all workspaces.
 * User-created models are workspace-scoped.
 */

import { Router } from 'express';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';
import { discoverModels, getProviderDisplay, getRankings } from '../services/discovery';

export const modelsRouter = Router();

// ── Helpers ──

const ALLOWED_SORT_FIELDS = ['name', 'model_id', 'context_window', 'pricing_input_cents', 'pricing_output_cents', 'created_at', 'status', 'priority'];
const ALLOWED_STATUSES = ['active', 'beta', 'deprecated', 'coming_soon'];

function buildVisibilityCondition(wsId: string): string {
  return `(ms.workspace_id IS NULL OR ms.workspace_id = ${pool.escape(wsId)})`;
}

/**
 * Idempotent provider resolution: returns the id for a given provider slug,
 * creating the provider as a system-level record if it doesn't already exist.
 *
 * Uses INSERT IGNORE + follow-up SELECT to handle concurrent requests safely
 * (the slug UNIQUE constraint is global — providers are shared across workspaces).
 */
async function ensureProvider(slug: string): Promise<string | null> {
  // 1. Try to find existing provider (system-level first, since they're global)
  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM model_providers WHERE slug = ? LIMIT 1',
    [slug]
  );
  if (existing.length > 0) return existing[0].id;

  // 2. INSERT IGNORE — another concurrent request may have created it first
  const display = getProviderDisplay(slug);
  const provId = genId('prov');
  await pool.query(
    `INSERT IGNORE INTO model_providers (id, name, slug, name_cn, website, priority, is_system, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`,
    [provId, display.name, slug, display.name_cn, '', 0]
  );

  // 3. Reliably return the id regardless of who won the race
  const [after] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM model_providers WHERE slug = ? LIMIT 1',
    [slug]
  );
  return after.length > 0 ? after[0].id : null;
}

// ── GET /api/v1/models ────────────────────────────────────────
// Query: provider, series, search, status, sort_field, sort_order, page, limit
// Deduplication: prefers workspace-level model_specs over system-level when both exist for the same model_id.
modelsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId || '';
    const {
      provider, series, search, status,
      sort_field = 'priority', sort_order = 'DESC',
      limit: limitStr = '20', page,
    } = req.query as Record<string, string | undefined>;

    const sortField = ALLOWED_SORT_FIELDS.includes(sort_field || '') ? sort_field : 'priority';
    const sortOrder = (sort_order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let limit = Math.min(parseInt(limitStr || '20') || 20, 200);
    let offset = 0;
    if (page) {
      const pageNum = Math.max(parseInt(page) || 1, 1);
      offset = (pageNum - 1) * limit;
    } else {
      offset = parseInt(req.query.offset as string || '0') || 0;
    }

    // Filter conditions (applied AFTER dedup, on the resolved row)
    const filterConditions: string[] = [];
    const filterParams: any[] = [];

    if (provider) {
      filterConditions.push('mp.slug = ?');
      filterParams.push(provider);
    }
    if (series) {
      filterConditions.push('ms2.slug = ?');
      filterParams.push(series);
    }
    if (status && ALLOWED_STATUSES.includes(status)) {
      filterConditions.push('ms.status = ?');
      filterParams.push(status);
    }
    if (search) {
      filterConditions.push('(ms.name LIKE ? OR ms.model_id LIKE ? OR ms.description LIKE ?)');
      const s = `%${search}%`;
      filterParams.push(s, s, s);
    }

    const filterWhere = filterConditions.length > 0 ? ' AND ' + filterConditions.join(' AND ') : '';

    // Dedup helper: subquery that picks workspace row if available, else system row
    const dedupJoin = `
      JOIN (
        SELECT model_id,
          COALESCE(
            MAX(CASE WHEN workspace_id = ? THEN id END),
            MAX(CASE WHEN workspace_id IS NULL THEN id END)
          ) as preferred_id
        FROM model_specs
        WHERE workspace_id IS NULL OR workspace_id = ?
        GROUP BY model_id
      ) dedup ON ms.id = dedup.preferred_id`;

    // Count — deduplicated
    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM model_specs ms
       ${dedupJoin}
       LEFT JOIN model_providers mp ON ms.provider_id = mp.id
       LEFT JOIN model_series ms2 ON ms.series_id = ms2.id
       WHERE 1=1${filterWhere}`,
      [wsId, wsId, ...filterParams]
    );

    // Sort mapping for special fields
    let orderCol: string;
    switch (sortField) {
      case 'priority': orderCol = 'mp.priority'; break;
      case 'name': orderCol = 'ms.name'; break;
      case 'created_at': orderCol = 'ms.created_at'; break;
      default: orderCol = `ms.${sortField}`;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         ms.id, ms.name, ms.model_id, ms.provider_model_id, ms.description, ms.context_window,
         ms.max_output_tokens, ms.pricing_input_cents, ms.pricing_output_cents,
         ms.capabilities, ms.status, ms.released_at,
         ms.is_system, ms.workspace_id, ms.created_at,
         mp.id as provider_id, mp.name as provider_name, mp.slug as provider_slug, mp.name_cn as provider_name_cn, mp.logo_url as provider_logo_url,
         ms2.id as series_id, ms2.name as series_name, ms2.slug as series_slug
       FROM model_specs ms
       ${dedupJoin}
       LEFT JOIN model_providers mp ON ms.provider_id = mp.id
       LEFT JOIN model_series ms2 ON ms.series_id = ms2.id
       WHERE 1=1${filterWhere}
       ORDER BY ${orderCol} ${sortOrder}, ms.name ASC
       LIMIT ? OFFSET ?`,
      [wsId, wsId, ...filterParams, limit, offset]
    );

    // Parse capabilities JSON
    const models = rows.map((r: any) => ({
      ...r,
      capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities || '{}') : (r.capabilities || {}),
      provider: {
        id: r.provider_id,
        name: r.provider_name,
        slug: r.provider_slug,
        name_cn: r.provider_name_cn,
        logo_url: r.provider_logo_url,
      },
      series: r.series_id ? {
        id: r.series_id,
        name: r.series_name,
        slug: r.series_slug,
      } : null,
      pricing: {
        input_cents: Number(r.pricing_input_cents),
        output_cents: Number(r.pricing_output_cents),
      },
      is_editable: r.is_system === 0 && r.workspace_id === wsId,
    }));

    return res.json({
      status: 'success',
      data: {
        models,
        pagination: {
          page: page ? parseInt(page) : Math.floor(offset / limit) + 1,
          page_size: limit,
          total: Number(total),
          total_pages: Math.ceil(Number(total) / limit),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── GET /api/v1/models/providers — list with model counts ─────
modelsRouter.get('/providers', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId || '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT mp.id, mp.name, mp.slug, mp.name_cn, mp.logo_url, mp.priority,
              COUNT(ms.id) as model_count
       FROM model_providers mp
       LEFT JOIN model_specs ms ON ms.provider_id = mp.id
         AND ${buildVisibilityCondition(wsId)}
       GROUP BY mp.id
       ORDER BY mp.priority DESC, mp.name ASC`
    );

    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── GET /api/v1/models/series — list all series ───────────────
modelsRouter.get('/series', async (_req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, slug, description FROM model_series ORDER BY id'
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── GET /api/v1/models/rankings ────────────────────────────────
// Returns model rankings from OpenRouter public API data.
// Query: sort (context|price_low|output_tokens|newest), chinese_only, limit
modelsRouter.get('/rankings', async (req: AuthRequest, res) => {
  try {
    const {
      sort = 'context',
      chinese_only = 'false',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    const sortField = ['context', 'price_low', 'output_tokens', 'newest'].includes(sort || '')
      ? (sort as 'context' | 'price_low' | 'output_tokens' | 'newest')
      : 'context';
    const chineseOnly = chinese_only === 'true';
    const limitNum = Math.min(parseInt(limit || '50') || 50, 100);

    const rankings = await getRankings(sortField, chineseOnly, limitNum);

    return res.json({
      status: 'success',
      data: {
        source: 'openrouter',
        sort: sortField,
        count: rankings.length,
        rankings,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── GET /api/v1/models/discovery/latest ───────────────────────
// Fetches models from OpenRouter public API.
// Query params:
//   provider      — filter to a specific provider slug
//   days          — lookback window in days (default 30, max 365, ignored if mode=all)
//   chinese_only  — "true" (default) = only Chinese providers; "false" = all providers
//   mode          — "new" (default, filter by days) | "all" (return all discovered models)
modelsRouter.get('/discovery/latest', async (req: AuthRequest, res) => {
  try {
    const {
      provider,
      days = '30',
      chinese_only = 'true',
      mode = 'new',
    } = req.query as Record<string, string | undefined>;

    const daysNum = Math.min(parseInt(days || '30') || 30, 365);
    const chineseOnly = chinese_only !== 'false';

    const models = await discoverModels({
      days: daysNum,
      provider: provider || undefined,
      chineseOnly,
      mode: (mode === 'all' ? 'all' : 'new'),
    });

    // Compare against existing model_specs to mark which are truly "new".
    // Match against BOTH model_id AND openrouter_model_id so seed data
    // models (short IDs) are correctly recognized as already-catalogued
    // when their OpenRouter equivalents appear in the discovery list.
    const wsId = req.workspaceId || '';
    const modelIds = models.map(m => m.id);
    const existingIds = new Set<string>();       // matched by model_id
    const existingOrmIds = new Set<string>();    // matched by openrouter_model_id

    if (modelIds.length > 0) {
      const placeholders = modelIds.map(() => '?').join(',');
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT model_id, openrouter_model_id FROM model_specs
         WHERE (model_id IN (${placeholders}) OR openrouter_model_id IN (${placeholders}))
           AND (workspace_id IS NULL OR workspace_id = ?)`,
        [...modelIds, ...modelIds, wsId || null]
      );
      for (const row of existing) {
        if (row.model_id) existingIds.add(row.model_id);
        if (row.openrouter_model_id) existingOrmIds.add(row.openrouter_model_id);
      }
    }

    const enriched = models.map(m => ({
      ...m,
      exists_in_catalog: existingIds.has(m.id) || existingOrmIds.has(m.id),
    }));

    const newCount = enriched.filter(m => !m.exists_in_catalog).length;

    return res.json({
      status: 'success',
      data: {
        source: 'openrouter',
        days: mode === 'all' ? null : daysNum,
        mode,
        chinese_only: chineseOnly,
        count: enriched.length,
        new_count: newCount,
        models: enriched,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── POST /api/v1/models/discovery/sync ────────────────────────
// Batch sync: upsert discovered models into model_specs + model_providers.
// Body: { model_ids?: string[], chinese_only?: boolean, mode?: 'new'|'all', days?: number }
modelsRouter.post('/discovery/sync', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ status: 'error', message: 'Workspace context missing' });

    const {
      model_ids,
      chinese_only = 'true',
      mode = 'new',
      days = '30',
    } = req.body;

    // 1. Fetch from OpenRouter
    const chineseOnly = chinese_only !== false;
    const discovered = await discoverModels({
      days: parseInt(days) || 30,
      chineseOnly,
      mode: mode === 'all' ? 'all' : 'new',
    });

    // 2. Filter to specific model IDs if provided
    const toSync = model_ids && Array.isArray(model_ids)
      ? discovered.filter(m => model_ids.includes(m.id))
      : discovered;

    if (toSync.length === 0) {
      return res.json({ status: 'success', data: { synced: 0, providers_created: 0, message: 'No models to sync' } });
    }

    // 3. Ensure providers exist — idempotent system-level creation
    const providerSlugs = [...new Set(toSync.map(m => m.provider_slug))];
    let providersCreated = 0;

    for (const slug of providerSlugs) {
      const [before] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM model_providers WHERE slug = ? LIMIT 1', [slug]
      );
      const existedBefore = before.length > 0;
      const provId = await ensureProvider(slug);
      if (provId && !existedBefore) providersCreated++;
    }

    // 4. Load provider ID map (all providers are now system-level)
    const [allProviders] = await pool.query<RowDataPacket[]>(
      'SELECT id, slug FROM model_providers WHERE workspace_id IS NULL'
    );
    const providerMap = new Map<string, string>();
    for (const p of allProviders) providerMap.set(p.slug, p.id);

    const [allSeries] = await pool.query<RowDataPacket[]>(
      'SELECT id, slug FROM model_series'
    );
    const seriesMap = new Map<string, string>();
    for (const s of allSeries) seriesMap.set(s.slug, s.id);

    // 5. Load existing system-level model_ids (match both model_id and openrouter_model_id)
    const toSyncIds = toSync.map(m => m.id);
    const existingSystemIds = new Set<string>();
    if (toSyncIds.length > 0) {
      const placeholders = toSyncIds.map(() => '?').join(',');
      const [existingRows] = await pool.query<RowDataPacket[]>(
        `SELECT model_id, openrouter_model_id FROM model_specs
         WHERE (model_id IN (${placeholders}) OR openrouter_model_id IN (${placeholders}))
           AND workspace_id IS NULL`,
        [...toSyncIds, ...toSyncIds]
      );
      for (const row of existingRows) {
        if (row.model_id) existingSystemIds.add(row.model_id);
        if (row.openrouter_model_id) existingSystemIds.add(row.openrouter_model_id);
      }
    }

    // 6. Upsert models (skip those already in system catalog)
    let synced = 0;
    let skipped = 0;
    for (const dm of toSync) {
      // Skip if already in system catalog (matched via model_id or openrouter_model_id)
      if (existingSystemIds.has(dm.id)) {
        skipped++;
        continue;
      }

      const providerId = providerMap.get(dm.provider_slug);
      if (!providerId) continue;

      const seriesId = dm.series_slug ? (seriesMap.get(dm.series_slug) || null) : null;
      const caps = dm.capabilities && Object.keys(dm.capabilities).length > 0
        ? JSON.stringify(dm.capabilities)
        : null;

      // Pricing: OpenRouter returns $/token as string, convert to cents per 1M
      const inputCents = Math.round(parseFloat(dm.pricing.prompt || '0') * 1000000);
      const outputCents = Math.round(parseFloat(dm.pricing.completion || '0') * 1000000);

      const providerModelId = dm.id.includes('/')
        ? dm.id.substring(dm.id.lastIndexOf('/') + 1)
        : dm.id;

      await pool.query(
        `INSERT INTO model_specs (id, provider_id, series_id, name, model_id, openrouter_model_id,
           provider_model_id,
           description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents,
           capabilities, status, is_system, workspace_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
         ON DUPLICATE KEY UPDATE
           openrouter_model_id = VALUES(openrouter_model_id),
           provider_model_id = VALUES(provider_model_id),
           description = VALUES(description),
           context_window = VALUES(context_window),
           max_output_tokens = VALUES(max_output_tokens),
           pricing_input_cents = VALUES(pricing_input_cents),
           pricing_output_cents = VALUES(pricing_output_cents),
           capabilities = VALUES(capabilities)`,
        [
          genId('model'), providerId, seriesId,
          dm.name, dm.id, dm.id, providerModelId,
          dm.description || null,
          dm.context_length, dm.max_output_tokens,
          inputCents, outputCents,
          caps, wsId,
        ]
      );
      synced++;
    }

    return res.json({
      status: 'success',
      data: {
        synced,
        skipped,
        providers_created: providersCreated,
        total_discovered: discovered.length,
        message: `Synced ${synced} models, skipped ${skipped} already in catalog, created ${providersCreated} providers`,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── GET /api/v1/models/:id ────────────────────────────────────
modelsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId || '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ms.*,
              ms.provider_model_id as provider_model_id,
              mp.id as provider_id, mp.name as provider_name, mp.slug as provider_slug, mp.name_cn as provider_name_cn,
              ms2.id as series_id, ms2.name as series_name, ms2.slug as series_slug
       FROM model_specs ms
       LEFT JOIN model_providers mp ON ms.provider_id = mp.id
       LEFT JOIN model_series ms2 ON ms.series_id = ms2.id
       WHERE ms.id = ? AND ${buildVisibilityCondition(wsId)}`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Model not found' });
    }

    const r: any = rows[0];
    return res.json({
      status: 'success',
      data: {
        ...r,
        capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities || '{}') : (r.capabilities || {}),
        provider: {
          id: r.provider_id,
          name: r.provider_name,
          slug: r.provider_slug,
          name_cn: r.provider_name_cn,
        },
        series: r.series_id ? { id: r.series_id, name: r.series_name, slug: r.series_slug } : null,
        is_editable: r.is_system === 0 && r.workspace_id === wsId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── POST /api/v1/models — create user model ────────────────────
modelsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ status: 'error', message: 'Workspace context missing' });

    const {
      provider_id, provider_slug, series_id, name, model_id,
      description, context_window, max_output_tokens,
      pricing_input_cents, pricing_output_cents,
      capabilities, status,
    } = req.body;

    if (!name || !model_id) {
      return res.status(400).json({ status: 'error', message: 'name and model_id are required' });
    }

    // Prevent creating a workspace duplicate when the model_id already
    // exists in the system catalog (workspace_id=NULL). System models are
    // visible to all workspaces, so an additional workspace copy is unnecessary.
    const [[sysCheck]] = await pool.query<RowDataPacket[]>(
      'SELECT id, name FROM model_specs WHERE model_id = ? AND workspace_id IS NULL LIMIT 1',
      [model_id]
    );
    if (sysCheck) {
      return res.status(409).json({
        status: 'error',
        message: `模型 "${model_id}" 已存在于系统目录（${sysCheck.name}），所有工作区均可直接使用，无需重复添加。`,
        existing_id: sysCheck.id,
      });
    }

    // Resolve provider_id: use explicit ID, or look up / auto-create by slug
    let resolvedProviderId: string | null = provider_id || null;
    if (!resolvedProviderId && provider_slug) {
      resolvedProviderId = await ensureProvider(provider_slug);
    }

    // Resolve series_id by slug too
    let resolvedSeriesId = series_id || null;
    if (!resolvedSeriesId && req.body.series_slug) {
      const [sRows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM model_series WHERE slug = ?', [req.body.series_slug]
      );
      if (sRows.length > 0) resolvedSeriesId = sRows[0].id;
    }

    if (!resolvedProviderId) {
      return res.status(400).json({ status: 'error', message: 'provider_id or provider_slug is required' });
    }

    const id = genId('model');
    const caps = capabilities ? JSON.stringify(capabilities) : null;

    await pool.query(
      `INSERT INTO model_specs (id, provider_id, series_id, name, model_id, description,
         context_window, max_output_tokens, pricing_input_cents, pricing_output_cents,
         capabilities, status, is_system, workspace_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, resolvedProviderId, resolvedSeriesId, name, model_id, description || null,
       context_window || 0, max_output_tokens || 0, pricing_input_cents || 0, pricing_output_cents || 0,
       caps, status || 'active', wsId]
    );

    return res.status(201).json({
      status: 'success',
      data: { id, name, model_id, is_system: false, workspace_id: wsId },
    });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'model_id already exists in your workspace' });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── PUT /api/v1/models/:id — update user model ────────────────
modelsRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ status: 'error', message: 'Workspace context missing' });

    // Only allow editing user-created models in current workspace
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM model_specs WHERE id = ? AND workspace_id = ? AND is_system = 0',
      [req.params.id, wsId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Model not found or not editable' });
    }

    const fields: string[] = [];
    const values: any[] = [];
    const { name, model_id, description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents, capabilities, status, provider_id, series_id } = req.body;

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (model_id !== undefined) { fields.push('model_id = ?'); values.push(model_id); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (context_window !== undefined) { fields.push('context_window = ?'); values.push(context_window); }
    if (max_output_tokens !== undefined) { fields.push('max_output_tokens = ?'); values.push(max_output_tokens); }
    if (pricing_input_cents !== undefined) { fields.push('pricing_input_cents = ?'); values.push(pricing_input_cents); }
    if (pricing_output_cents !== undefined) { fields.push('pricing_output_cents = ?'); values.push(pricing_output_cents); }
    if (capabilities !== undefined) { fields.push('capabilities = ?'); values.push(JSON.stringify(capabilities)); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (provider_id !== undefined) { fields.push('provider_id = ?'); values.push(provider_id); }
    if (series_id !== undefined) { fields.push('series_id = ?'); values.push(series_id); }

    if (fields.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No fields to update' });
    }

    values.push(req.params.id, wsId);
    await pool.query(
      `UPDATE model_specs SET ${fields.join(', ')} WHERE id = ? AND workspace_id = ?`,
      values
    );

    return res.json({ status: 'success', message: 'Updated' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'model_id already exists in your workspace' });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── DELETE /api/v1/models/:id ─────────────────────────────────
modelsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const wsId = req.workspaceId;
    if (!wsId) return res.status(400).json({ status: 'error', message: 'Workspace context missing' });

    const [result] = await pool.query(
      'DELETE FROM model_specs WHERE id = ? AND workspace_id = ? AND is_system = 0',
      [req.params.id, wsId]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Model not found or not deletable' });
    }

    return res.json({ status: 'success', message: 'Deleted' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

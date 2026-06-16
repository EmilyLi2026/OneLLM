/**
 * Scheduled Sync Service
 *
 * Periodically fetches OpenRouter model data and upserts into model_specs.
 * - Only syncs Chinese providers (chineseOnly=true)
 * - Preserves existing primary keys and names (only updates pricing/specs)
 * - Auto-creates missing providers
 */

import pool, { genId } from '../db/pool';
import { discoverModels, getProviderDisplay, DiscoveredModel } from './discovery';
import { RowDataPacket } from 'mysql2';

const DEFAULT_USD_CNY_RATE = 7.25;
function getExchangeRate(): number {
  const raw = process.env.USD_CNY_RATE;
  if (!raw) return DEFAULT_USD_CNY_RATE;
  const rate = parseFloat(raw);
  return isNaN(rate) || rate <= 0 ? DEFAULT_USD_CNY_RATE : rate;
}

let _syncRunning = false;
let _lastSyncTime: number | null = null;
let _lastSyncCount = 0;

export function getSyncStatus() {
  return {
    running: _syncRunning,
    lastSyncTime: _lastSyncTime ? new Date(_lastSyncTime).toISOString() : null,
    lastSyncCount: _lastSyncCount,
  };
}

export async function runSync(): Promise<{ synced: number; providersCreated: number; errors: string[] }> {
  if (_syncRunning) {
    return { synced: 0, providersCreated: 0, errors: ['Sync already in progress'] };
  }

  _syncRunning = true;
  const errors: string[] = [];
  let synced = 0;
  let providersCreated = 0;

  try {
    // 1. Fetch Chinese models from OpenRouter cache
    const discovered = await discoverModels({ chineseOnly: true, mode: 'all' });
    console.log(`[sync] Fetched ${discovered.length} Chinese models from OpenRouter`);

    if (discovered.length === 0) {
      _syncRunning = false;
      return { synced: 0, providersCreated: 0, errors: ['No models discovered'] };
    }

    // 2. Ensure providers exist (use NULL workspace_id for system scope)
    const providerSlugs = [...new Set(discovered.map(m => m.provider_slug))];
    const [existingProviders] = await pool.query<RowDataPacket[]>(
      'SELECT id, slug FROM model_providers WHERE workspace_id IS NULL'
    );
    const providerMap = new Map<string, string>();
    for (const p of existingProviders) providerMap.set(p.slug, p.id);

    for (const slug of providerSlugs) {
      if (!providerMap.has(slug)) {
        const display = getProviderDisplay(slug);
        const provId = genId('prov');
        try {
          // INSERT IGNORE: safe under concurrent sync/requests
          await pool.query(
            `INSERT IGNORE INTO model_providers (id, name, slug, name_cn, website, priority, is_system, workspace_id)
             VALUES (?, ?, ?, ?, ?, ?, 1, NULL)`,
            [provId, display.name, slug, display.name_cn, '', 0]
          );
          // Reliably get the ID — ours, or another request's that inserted first
          const [after] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM model_providers WHERE slug = ? LIMIT 1',
            [slug]
          );
          if (after.length > 0) {
            providerMap.set(slug, after[0].id);
            if (after[0].id === provId) providersCreated++;
          }
          console.log(`[sync] Ensured provider: ${slug} (${display.name_cn})`);
        } catch (e: any) {
          errors.push(`Failed to create provider ${slug}: ${e.message}`);
        }
      }
    }

    // 3. Load series map
    const [allSeries] = await pool.query<RowDataPacket[]>(
      'SELECT id, slug FROM model_series'
    );
    const seriesMap = new Map<string, string>();
    for (const s of allSeries) seriesMap.set(s.slug, s.id);

    // 4. Clean up duplicates from previous buggy sync runs (keep the earliest row)
    await pool.query(
      `DELETE m1 FROM model_specs m1
       INNER JOIN model_specs m2
       ON m1.model_id = m2.model_id AND m1.workspace_id IS NULL AND m2.workspace_id IS NULL
       AND m1.is_system = 1 AND m2.is_system = 1
       AND m1.created_at > m2.created_at`
    );
    console.log('[sync] Cleaned up duplicate system models');

    // 5. Upsert models — use SELECT-then-UPDATE/INSERT to handle NULL workspace_id
    //    MySQL UNIQUE constraint with NULL workspace_id allows duplicates, so ON DUPLICATE KEY won't work
    for (const dm of discovered) {
      const providerId = providerMap.get(dm.provider_slug);
      if (!providerId) continue;

      const seriesId = dm.series_slug ? (seriesMap.get(dm.series_slug) || null) : null;
      const caps = dm.capabilities && Object.keys(dm.capabilities).length > 0
        ? JSON.stringify(dm.capabilities) : null;

      // Derive provider-native model ID from OpenRouter's namespaced ID
      // Rule: if model_id contains '/', take the part after the last '/'
      //       e.g. "deepseek/deepseek-v4-pro" → "deepseek-v4-pro"
      //       Otherwise keep as-is (already provider‑native or OpenRouter short alias)
      const providerModelId = dm.id.includes('/')
        ? dm.id.substring(dm.id.lastIndexOf('/') + 1)
        : dm.id;

      // Pricing: OpenRouter returns USD/token → convert to RMB fen per 1M tokens
      const rate = getExchangeRate();
      const inputFen = Math.round(parseFloat(dm.pricing.prompt || '0') * 1_000_000 * 100 * rate);
      const outputFen = Math.round(parseFloat(dm.pricing.completion || '0') * 1_000_000 * 100 * rate);

      try {
        // Check both model_id AND openrouter_model_id for seed data cross-matching
        const [existing] = await pool.query<RowDataPacket[]>(
          `SELECT id, name, model_id, openrouter_model_id FROM model_specs
           WHERE (model_id = ? OR openrouter_model_id = ?)
             AND workspace_id IS NULL AND is_system = 1`,
          [dm.id, dm.id]
        );

        if (existing.length > 0) {
          // UPDATE: refresh pricing/specs/provider_model_id
          const needsOpenRouterId = !existing[0].openrouter_model_id;
          await pool.query(
            `UPDATE model_specs SET
               ${needsOpenRouterId ? 'openrouter_model_id = ?,' : ''}
               provider_model_id = ?, description = ?, context_window = ?,
               max_output_tokens = ?, pricing_input_cents = ?, pricing_output_cents = ?,
               capabilities = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              ...(needsOpenRouterId ? [dm.id] : []),
              providerModelId,
              dm.description || null, dm.context_length, dm.max_output_tokens,
              inputFen, outputFen, caps, existing[0].id
            ]
          );
        } else {
          // INSERT: new system model, include openrouter_model_id + provider_model_id
          await pool.query(
            `INSERT INTO model_specs (id, provider_id, series_id, name, model_id, openrouter_model_id,
               provider_model_id,
               description, context_window, max_output_tokens, pricing_input_cents, pricing_output_cents,
               capabilities, status, is_system, workspace_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, NULL)`,
            [genId('model'), providerId, seriesId,
             dm.name, dm.id, dm.id, providerModelId,
             dm.description || null, dm.context_length, dm.max_output_tokens,
             inputFen, outputFen, caps]
          );
        }
        synced++;
      } catch (e: any) {
        errors.push(`Failed to upsert model ${dm.id}: ${e.message}`);
      }
    }

    _lastSyncTime = Date.now();
    _lastSyncCount = synced;
    console.log(`[sync] Completed: ${synced} models synced, ${providersCreated} providers created, ${errors.length} errors`);
  } catch (error: any) {
    errors.push(`Sync failed: ${error.message}`);
    console.error('[sync] Fatal error:', error.message);
  }

  _syncRunning = false;
  return { synced, providersCreated, errors };
}

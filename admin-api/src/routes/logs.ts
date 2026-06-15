/**
 * Request Log Routes — MySQL
 * Supports multi-condition filtering with pagination.
 */

import { Router } from 'express';
import pool from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

export const logsRouter = Router();

/**
 * GET /api/v1/logs
 *
 * Query params:
 *   date_from   — ISO date string, filter created_at >=
 *   date_to     — ISO date string, filter created_at <=
 *   model       — exact match
 *   provider    — exact match
 *   agent_id    — exact match
 *   status      — HTTP status code
 *   search      — fuzzy match against model name (LIKE %value%)
 *   sort_field  — field to sort by (default: created_at)
 *   sort_order  — ASC or DESC (default: DESC)
 *   limit       — page size (default: 20, max: 200)
 *   offset      — offset (default: 0)
 *   page        — 1-based page number (overrides offset if provided)
 */
logsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const {
      date_from,
      date_to,
      model,
      provider,
      agent_id,
      api_key_id,
      status,
      search,
      sort_field = 'created_at',
      sort_order = 'DESC',
      limit: limitStr = '20',
      offset: offsetStr = '0',
      page,
    } = req.query as Record<string, string | undefined>;

    // Whitelist sort fields
    const allowedSortFields = ['created_at', 'tokens_in', 'tokens_out', 'cost_cents', 'latency_ms', 'model'];
    const sortField = allowedSortFields.includes(sort_field || '') ? sort_field : 'created_at';
    const sortOrder = (sort_order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination
    let limit = Math.min(parseInt(limitStr || '20') || 20, 200);
    let offset = parseInt(offsetStr || '0') || 0;
    if (page) {
      const pageNum = Math.max(parseInt(page) || 1, 1);
      offset = (pageNum - 1) * limit;
    }

    // Build WHERE clause dynamically
    const conditions: string[] = ['rl.workspace_id = ?'];
    const params: any[] = [req.workspaceId];

    if (date_from) {
      conditions.push('rl.created_at >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('rl.created_at <= ?');
      params.push(date_to);
    }
    if (model) {
      conditions.push('rl.model = ?');
      params.push(model);
    }
    if (provider) {
      conditions.push('rl.provider = ?');
      params.push(provider);
    }
    if (agent_id) {
      conditions.push('rl.agent_id = ?');
      params.push(agent_id);
    }
    if (status) {
      conditions.push('rl.status = ?');
      params.push(Number(status));
    }
    if (search) {
      conditions.push('rl.model LIKE ?');
      params.push(`%${search}%`);
    }
    if (api_key_id) {
      conditions.push('rl.api_key_id = ?');
      params.push(api_key_id);
    }

    const whereClause = conditions.join(' AND ');

    // Count total
    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM request_logs rl WHERE ${whereClause}`,
      params
    );

    // Build sort safely (whitelisted)
    const orderClause = `ORDER BY rl.${sortField} ${sortOrder}`;

    // Query data (exclude large content columns — use detail endpoint for those)
    const listColumns = [
      'rl.id', 'rl.workspace_id', 'rl.user_id', 'rl.agent_id',
      'rl.action_label', 'rl.conversation_turn', 'rl.agent_role', 'rl.session_id',
      'rl.request_id', 'rl.model', 'rl.provider', 'rl.binding_id', 'rl.api_key_id',
      'rl.tokens_in', 'rl.tokens_out', 'rl.cost_cents', 'rl.latency_ms',
      'rl.status', 'rl.error_message', 'rl.tool_name', 'rl.tool_action', 'rl.execution_tier',
      'rl.created_at',
      'ak.name as api_key_name',
      'ak.key_prefix as api_key_prefix'
    ].join(', ');

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${listColumns} FROM request_logs rl
       LEFT JOIN api_keys ak ON rl.api_key_id = ak.id
       WHERE ${whereClause}
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Summary stats for current filters
    const [[summary]] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(rl.tokens_in), 0) as total_tokens_in,
         COALESCE(SUM(rl.tokens_out), 0) as total_tokens_out,
         COALESCE(SUM(rl.tokens_in + rl.tokens_out), 0) as total_tokens,
         COALESCE(SUM(rl.cost_cents), 0) as total_cost_cents,
         COALESCE(AVG(rl.latency_ms), 0) as avg_latency_ms,
         COUNT(*) as total_requests,
         COALESCE(SUM(CASE WHEN rl.status < 400 THEN 1 ELSE 0 END), 0) as success_count,
         COALESCE(SUM(CASE WHEN rl.status >= 400 THEN 1 ELSE 0 END), 0) as error_count
       FROM request_logs rl
       WHERE ${whereClause}`,
      params
    );

    return res.json({
      status: 'success',
      data: {
        logs: rows,
        pagination: {
          page: page ? parseInt(page) : Math.floor(offset / limit) + 1,
          page_size: limit,
          total: Number(total),
          total_pages: Math.ceil(Number(total) / limit),
        },
        summary: {
          total_tokens_in: Number(summary.total_tokens_in),
          total_tokens_out: Number(summary.total_tokens_out),
          total_tokens: Number(summary.total_tokens),
          total_cost_cents: Number(summary.total_cost_cents),
          total_cost_yuan: (Number(summary.total_cost_cents) / 100).toFixed(2),
          avg_latency_ms: Math.round(Number(summary.avg_latency_ms)),
          total_requests: Number(summary.total_requests),
          success_count: Number(summary.success_count),
          error_count: Number(summary.error_count),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/v1/logs/stats
 *
 * Query params:
 *   group_by  — model | provider | agent | status (default: model)
 *   date_from — ISO date string
 *   date_to   — ISO date string
 */
logsRouter.get('/stats', async (req: AuthRequest, res) => {
  try {
    const {
      group_by = 'model',
      date_from,
      date_to,
      model,
      provider,
      agent_id,
      api_key_id,
      status,
    } = req.query as Record<string, string | undefined>;

    // Whitelist group by fields
    const allowedGroups: Record<string, string> = {
      model: 'rl.model',
      provider: 'rl.provider',
      agent: 'rl.agent_id',
      status: 'rl.status',
      api_key: 'ak.name, rl.api_key_id',
    };
    const selectNameCol = group_by === 'api_key'
      ? 'COALESCE(ak.name, rl.api_key_id)'
      : (allowedGroups[group_by || ''] || 'rl.model');
    const groupCol = allowedGroups[group_by || ''] || 'rl.model';
    const needsApiKeyJoin = group_by === 'api_key';

    const conditions: string[] = ['rl.workspace_id = ?'];
    const params: any[] = [req.workspaceId];

    if (date_from) { conditions.push('rl.created_at >= ?'); params.push(date_from); }
    if (date_to)   { conditions.push('rl.created_at <= ?'); params.push(date_to); }
    if (model)     { conditions.push('rl.model = ?'); params.push(model); }
    if (provider)  { conditions.push('rl.provider = ?'); params.push(provider); }
    if (agent_id)  { conditions.push('rl.agent_id = ?'); params.push(agent_id); }
    if (api_key_id) { conditions.push('rl.api_key_id = ?'); params.push(api_key_id); }
    if (status)    { conditions.push('rl.status = ?'); params.push(Number(status)); }

    const whereClause = conditions.join(' AND ');
    const fromClause = needsApiKeyJoin
      ? 'FROM request_logs rl LEFT JOIN api_keys ak ON rl.api_key_id = ak.id'
      : 'FROM request_logs rl';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${selectNameCol} as name,
              COALESCE(SUM(rl.tokens_in), 0) as total_tokens_in,
              COALESCE(SUM(rl.tokens_out), 0) as total_tokens_out,
              COALESCE(SUM(rl.tokens_in + rl.tokens_out), 0) as total_tokens,
              COALESCE(SUM(rl.cost_cents), 0) as total_cost_cents,
              COUNT(*) as total_requests,
              COALESCE(SUM(CASE WHEN rl.status < 400 THEN 1 ELSE 0 END), 0) as success_count,
              COALESCE(SUM(CASE WHEN rl.status >= 400 THEN 1 ELSE 0 END), 0) as error_count,
              COALESCE(AVG(rl.latency_ms), 0) as avg_latency_ms
       ${fromClause}
       WHERE ${whereClause}
       GROUP BY ${groupCol}
       ORDER BY total_cost_cents DESC`,
      params
    );

    const totalTokens = rows.reduce((s: number, r: any) => s + Number(r.total_tokens), 0);
    const totalCost = rows.reduce((s: number, r: any) => s + Number(r.total_cost_cents), 0);
    const totalReqs = rows.reduce((s: number, r: any) => s + Number(r.total_requests), 0);

    return res.json({
      status: 'success',
      data: {
        group_by,
        total_tokens: totalTokens,
        total_cost_cents: totalCost,
        total_requests: totalReqs,
        breakdown: rows,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/v1/logs/filters — return distinct values for dropdowns
 * Provides available models, providers, agents for the current workspace.
 *
 * Query params:
 *   api_key_id — when provided, filters models/providers based on the key's bindings (linkage)
 */
logsRouter.get('/filters', async (req: AuthRequest, res) => {
  try {
    const { api_key_id } = req.query as Record<string, string | undefined>;

    // ── If api_key_id is provided, use bindings-based linking ──
    if (api_key_id) {
      const [bindings] = await pool.query<RowDataPacket[]>(
        `SELECT kpb.allowed_models, pc.provider_name
         FROM key_provider_bindings kpb
         JOIN provider_credentials pc ON pc.id = kpb.provider_credential_id
         WHERE kpb.api_key_id = ? AND kpb.enabled = 1`,
        [api_key_id]
      );

      if (bindings.length === 0) {
        return res.json({
          status: 'success',
          data: { models: [], providers: [] },
        });
      }

      // Extract bound provider names
      const boundProviders = [...new Set(
        bindings.map((b: any) => b.provider_name).filter(Boolean)
      )];

      // Collect allowed models from each binding
      const modelSet = new Set<string>();
      let hasUnrestricted = false; // any binding with no model restriction
      for (const b of bindings) {
        if (b.allowed_models) {
          const models: string[] =
            typeof b.allowed_models === 'string'
              ? JSON.parse(b.allowed_models)
              : b.allowed_models;
          if (Array.isArray(models) && models.length > 0) {
            models.filter(Boolean).forEach((m: string) => modelSet.add(m));
          } else {
            hasUnrestricted = true;
          }
        } else {
          hasUnrestricted = true;
        }
      }

      let modelsList: string[];
      if (hasUnrestricted) {
        // Supplement with models actually used in logs for these providers
        const placeholders = boundProviders.map(() => '?').join(',');
        const [logModels] = await pool.query<RowDataPacket[]>(
          `SELECT DISTINCT model FROM request_logs
           WHERE workspace_id = ? AND provider IN (${placeholders})
           ORDER BY model`,
          [req.workspaceId, ...boundProviders]
        );
        logModels
          .map((r: any) => r.model)
          .filter(Boolean)
          .forEach((m: string) => modelSet.add(m));
        modelsList = [...modelSet];
      } else {
        modelsList = [...modelSet];
      }

      return res.json({
        status: 'success',
        data: {
          models: modelsList,
          providers: boundProviders,
        },
      });
    }

    // ── Without api_key_id: return all distinct values from request_logs ──
    const [models] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT model FROM request_logs WHERE workspace_id = ? ORDER BY model',
      [req.workspaceId]
    );
    const [providers] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT provider FROM request_logs WHERE workspace_id = ? ORDER BY provider',
      [req.workspaceId]
    );

    return res.json({
      status: 'success',
      data: {
        models: models.map((r: any) => r.model).filter(Boolean),
        providers: providers.map((r: any) => r.provider).filter(Boolean),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/v1/logs/trend — daily aggregated trend data
 */
logsRouter.get('/trend', async (req: AuthRequest, res) => {
  try {
    const {
      date_from,
      date_to,
      granularity = 'day',
      model,
      provider,
      agent_id,
      api_key_id,
      status,
    } = req.query as Record<string, string | undefined>;

    const format = granularity === 'hour'
      ? '%Y-%m-%d %H:00'
      : '%Y-%m-%d';

    const conditions: string[] = ['workspace_id = ?'];
    const params: any[] = [req.workspaceId];

    const to = date_to || new Date().toISOString().split('T')[0] + ' 23:59:59';
    const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    conditions.push('created_at >= ?');
    params.push(from);
    conditions.push('created_at <= ?');
    params.push(to);
    if (model) { conditions.push('model = ?'); params.push(model); }
    if (provider) { conditions.push('provider = ?'); params.push(provider); }
    if (agent_id) { conditions.push('agent_id = ?'); params.push(agent_id); }
    if (api_key_id) { conditions.push('api_key_id = ?'); params.push(api_key_id); }
    if (status) { conditions.push('status = ?'); params.push(Number(status)); }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, ?) as date,
         COUNT(*) as total_requests,
         COALESCE(SUM(tokens_in), 0) as total_tokens_in,
         COALESCE(SUM(tokens_out), 0) as total_tokens_out,
         COALESCE(SUM(cost_cents), 0) as total_cost_cents,
         COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
         COALESCE(SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END), 0) as success_count,
         COALESCE(SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END), 0) as error_count
       FROM request_logs
       WHERE ${whereClause}
       GROUP BY DATE_FORMAT(created_at, ?)
       ORDER BY date ASC`,
      [format, ...params, format]
    );

    return res.json({
      status: 'success',
      data: rows,
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

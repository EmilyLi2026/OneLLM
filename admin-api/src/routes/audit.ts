/**
 * Audit Log Routes — read-only with human-readable enrichment
 */

import { Router } from 'express';
import pool from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

export const auditRouter = Router();

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
  'agent.created': '创建 Agent',          'agent.updated': '更新 Agent',
  'agent.deleted': '删除 Agent',
  'key.created': '创建 API Key',          'key.updated': '更新 API Key',
  'key.revoked': '吊销 API Key',
  'key.binding.created': '绑定 Provider',  'key.binding.deleted': '解绑 Provider',
  'provider.created': '添加 Provider 凭证','provider.updated': '更新 Provider 凭证',
  'provider.deleted': '删除 Provider 凭证',
  'workspace.created': '创建工作区',       'workspace.updated': '更新工作区',
  'user.invited': '邀请成员',             'user.joined': '加入工作区',
  'budget.updated': '更新预算',           'budget.alert': '预算告警',
  'model.created': '添加模型',            'model.updated': '更新模型',
  'model.deleted': '删除模型',
};

/** GET /api/v1/audit — List audit logs with user/resource names */
auditRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const {
      action, resource_type, user_id,
      date_from, date_to, search,
      limit = '50', offset = '0',
    } = req.query as Record<string, string | undefined>;

    const conditions: string[] = ['al.workspace_id = ?'];
    const params: any[] = [req.workspaceId];

    if (action) { conditions.push('al.action = ?'); params.push(action); }
    if (resource_type) { conditions.push('al.resource_type = ?'); params.push(resource_type); }
    if (user_id) { conditions.push('al.user_id = ?'); params.push(user_id); }
    if (date_from) { conditions.push('al.created_at >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('al.created_at <= ?'); params.push(date_to + ' 23:59:59'); }
    if (search) {
      conditions.push('(u.name LIKE ? OR al.action LIKE ? OR al.resource_type LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereClause = conditions.join(' AND ');

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE ${whereClause}`,
      params
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.*,
              u.name as user_name, u.phone as user_phone,
              w.name as workspace_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN workspaces w ON al.workspace_id = w.id
       WHERE ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    // ── Batch resolve resource names ──
    const nameMap = new Map<string, string>(); // key: "type:id" → display name

    // Collect resource_ids by type
    const idByType: Record<string, Set<string>> = {};
    for (const r of rows) {
      if (!r.resource_type || !r.resource_id) continue;
      if (!idByType[r.resource_type]) idByType[r.resource_type] = new Set();
      idByType[r.resource_type].add(r.resource_id);
    }
    // Also collect IDs from details (provider_credential_id, api_key_id, etc.)
    const detailIdByType: Record<string, Set<string>> = {};
    for (const r of rows) {
      let d: any = {};
      try { d = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}); } catch {}
      for (const [k, v] of Object.entries(d)) {
        if (typeof v !== 'string' || v.length < 8) continue;
        // Map detail key → lookup table
        const typeMap: Record<string, string> = {
          provider_credential_id: 'provider_credential',
          api_key_id: 'api_key', binding_id: 'key_provider_binding',
          created_by: 'user', accepted_by: 'user', owner_id: 'user',
        };
        const mappedType = typeMap[k];
        if (!mappedType) continue;
        if (!detailIdByType[mappedType]) detailIdByType[mappedType] = new Set();
        detailIdByType[mappedType].add(v as string);
      }
    }

    // Batch query each resource type
    for (const [type, ids] of Object.entries(idByType)) {
      await resolveNames(type, [...ids], nameMap);
    }
    for (const [type, ids] of Object.entries(detailIdByType)) {
      await resolveNames(type, [...ids], nameMap);
    }

    // ── Detail value label mapping ──
    const DETAIL_KEY_LABELS: Record<string, string> = {
      name: '名称', provider_credential_id: 'Provider', api_key_id: 'API Key',
      provider_name: '厂商', role: '角色', scopes: '权限',
      rate_limit_rpm: '速率限制', weight: '权重', priority_order: '优先级',
      daily_budget_cents: '日预算', monthly_budget_cents: '月预算',
      allowed_models: '可用模型', enabled: '启用',
      description: '描述', default_model: '默认模型', status: '状态',
      created_by: '创建者', accepted_by: '接受者', binding_id: '绑定',
    };

    // Enrich each row
    const logs = rows.map((r: any) => {
      const d = typeof r.details === 'string' ? JSON.parse(r.details || '{}') : (r.details || {});
      const resKey = `${r.resource_type}:${r.resource_id}`;
      const resourceName = nameMap.get(resKey) || null;

      // Translate detail values from IDs to names
      const translatedDetails: Record<string, any> = {};
      for (const [k, v] of Object.entries(d)) {
        const label = DETAIL_KEY_LABELS[k] || k;
        let displayV = v;
        // Try name resolution for ID-like values
        if (typeof v === 'string' && v.length >= 8) {
          const typeMap: Record<string, string> = {
            provider_credential_id: 'provider_credential',
            api_key_id: 'api_key', created_by: 'user',
            accepted_by: 'user', binding_id: 'key_provider_binding',
          };
          const mappedType = typeMap[k];
          if (mappedType) {
            const mappedKey = `${mappedType}:${v}`;
            const resolved = nameMap.get(mappedKey);
            if (resolved) displayV = resolved;
          }
        }
        translatedDetails[label] = displayV;
      }

      return {
        ...r,
        action_label: ACTION_LABELS[r.action] || r.action,
        resource_name: resourceName,
        details: translatedDetails,
      };
    });

    // ── Helper: batch resolve names for a set of IDs ──
    async function resolveNames(
      type: string, ids: string[], map: Map<string, string>
    ) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      try {
        let query = '';
        let queryParams: any[] = [];
        switch (type) {
          case 'api_key':
            query = `SELECT id, name FROM api_keys WHERE id IN (${placeholders})`; break;
          case 'provider_credential':
            query = `SELECT pc.id, CONCAT(pc.provider_name, ' (', mp.name_cn, ')') as name
                     FROM provider_credentials pc
                     LEFT JOIN model_providers mp ON mp.slug = pc.provider_name
                     WHERE pc.id IN (${placeholders})`; break;
          case 'agent':
            query = `SELECT id, name FROM agents WHERE id IN (${placeholders})`; break;
          case 'workspace':
            query = `SELECT id, name FROM workspaces WHERE id IN (${placeholders})`; break;
          case 'user':
            query = `SELECT id, COALESCE(name, phone, id) as name FROM users WHERE id IN (${placeholders})`; break;
          case 'key_provider_binding':
            query = `SELECT kpb.id, CONCAT(pc.provider_name, ' → Key #', kpb.api_key_id) as name
                     FROM key_provider_bindings kpb
                     LEFT JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
                     WHERE kpb.id IN (${placeholders})`; break;
          case 'model':
            query = `SELECT id, CONCAT(name, ' (', model_id, ')') as name FROM model_specs WHERE id IN (${placeholders})`; break;
        }
        if (!query) return;
        const [rows] = await pool.query<RowDataPacket[]>(query, ids);
        for (const row of rows as any[]) {
          map.set(`${type}:${row.id}`, row.name);
        }
      } catch { /* best effort */ }
    }

    // Available filter options
    const [actions] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT action, COUNT(*) as cnt FROM audit_logs
       WHERE workspace_id = ? GROUP BY action ORDER BY cnt DESC`,
      [req.workspaceId]
    );
    const [types] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT resource_type, COUNT(*) as cnt FROM audit_logs
       WHERE workspace_id = ? GROUP BY resource_type ORDER BY cnt DESC`,
      [req.workspaceId]
    );

    return res.json({
      status: 'success',
      data: {
        logs,
        total: Number(total),
        filter_options: {
          actions: actions.map((a: any) => ({ value: a.action, label: ACTION_LABELS[a.action] || a.action, count: a.cnt })),
          resource_types: types.map((t: any) => ({ value: t.resource_type, label: t.resource_type, count: t.cnt })),
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/audit/actions — Available action types for filter dropdown */
auditRouter.get('/actions', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT action, COUNT(*) as cnt FROM audit_logs
       WHERE workspace_id = ? GROUP BY action ORDER BY cnt DESC`,
      [req.workspaceId]
    );
    return res.json({
      status: 'success',
      data: rows.map((r: any) => ({
        value: r.action,
        label: ACTION_LABELS[r.action] || r.action,
        count: r.cnt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

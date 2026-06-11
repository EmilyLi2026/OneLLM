/**
 * API Key Routes — MySQL
 *
 * Unified API Key model (merged with Virtual Keys):
 *   - Creates OneLLM-scoped keys (onellm_sk_...)
 *   - Optionally binds to a Provider Credential for direct model access
 *   - Supports rate_limit_rpm, monthly_budget_cents, daily_budget_cents per key
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../services/audit';
import { RowDataPacket } from 'mysql2';

export const keysRouter = Router();

interface KeyRow extends RowDataPacket {
  id: string; name: string; key_prefix: string; key_hash: string;
  scopes: any; revoked: number; created_at: string;
  provider_credential_id: string;
  provider_name: string; api_key_preview: string;
  rate_limit_rpm: number; monthly_budget_cents: number; daily_budget_cents: number;
  binding_count: number; bindings_daily_budget_cents: number; bindings_monthly_budget_cents: number;
}

/** POST /api/v1/keys — Create an API Key (optionally bound to a Provider) */
keysRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, scopes, provider_credential_id, rate_limit_rpm, monthly_budget_cents, daily_budget_cents } = req.body;
    const id = genId('key');
    const rawKey = `onellm_sk_${Math.random().toString(36).substring(2, 20)}`;
    const keyHash = await bcrypt.hash(rawKey, 8);
    const keyPrefix = rawKey.substring(0, 16);

    await pool.query(
      `INSERT INTO api_keys (id, workspace_id, user_id, name, key_prefix, key_hash, scopes,
        provider_credential_id, rate_limit_rpm, monthly_budget_cents, daily_budget_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.workspaceId || '', req.userId || '', name || 'Default Key',
        keyPrefix, keyHash,
        JSON.stringify(scopes || ['read']),
        provider_credential_id || null,
        rate_limit_rpm || 60,
        monthly_budget_cents || 0,
        daily_budget_cents || 0,
      ]
    );

    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'key.created', resource_type: 'api_key', resource_id: id,
      details: { name: name || 'Default Key', provider_credential_id: provider_credential_id || null },
      ip_address: req.ip,
    }).catch(() => {});

    return res.status(201).json({
      status: 'success',
      data: {
        id, name: name || 'Default Key', key: rawKey,
        key_preview: keyPrefix, scopes: scopes || ['read'],
        provider_credential_id: provider_credential_id || null,
        rate_limit_rpm: rate_limit_rpm || 60,
        monthly_budget_cents: monthly_budget_cents || 0,
        daily_budget_cents: daily_budget_cents || 0,
        created_at: new Date().toISOString(),
        warning: 'Store this key securely. It will not be shown again.',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/keys — List all API Keys with optional Provider info */
keysRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<KeyRow[]>(
      `SELECT ak.id, ak.name, ak.key_prefix, ak.scopes, ak.revoked,
              ak.provider_credential_id, ak.rate_limit_rpm,
              ak.monthly_budget_cents, ak.daily_budget_cents,
              ak.created_at,
              COUNT(kpb.id) as binding_count,
              COALESCE(SUM(kpb.daily_budget_cents), 0) as bindings_daily_budget_cents,
              COALESCE(SUM(kpb.monthly_budget_cents), 0) as bindings_monthly_budget_cents,
              pc.provider_name,
              CONCAT(LEFT(pc.api_key_encrypted, 8), '...', RIGHT(pc.api_key_encrypted, 4)) as api_key_preview
       FROM api_keys ak
       LEFT JOIN key_provider_bindings kpb ON ak.id = kpb.api_key_id AND kpb.enabled = 1
       LEFT JOIN provider_credentials pc ON ak.provider_credential_id = pc.id
       WHERE ak.workspace_id = ?
       GROUP BY ak.id
       ORDER BY ak.created_at DESC`,
      [req.workspaceId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/keys/:id — Update key metadata (name, provider binding, rate limit, budgets) */
keysRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, provider_credential_id, rate_limit_rpm, monthly_budget_cents, daily_budget_cents } = req.body;
    const [result] = await pool.query<any>(
      `UPDATE api_keys
       SET name = COALESCE(?, name),
           provider_credential_id = ?,
           rate_limit_rpm = COALESCE(?, rate_limit_rpm),
           monthly_budget_cents = COALESCE(?, monthly_budget_cents),
           daily_budget_cents = COALESCE(?, daily_budget_cents)
       WHERE id = ? AND workspace_id = ?`,
      [name || null, provider_credential_id || null,
       rate_limit_rpm || null,
       monthly_budget_cents ?? null, daily_budget_cents ?? null,
       req.params.id, req.workspaceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Key not found' });
    }
    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'key.updated', resource_type: 'api_key', resource_id: req.params.id,
      details: { name, provider_credential_id },
      ip_address: req.ip,
    }).catch(() => {});
    return res.json({ status: 'success', message: 'Key updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** DELETE /api/v1/keys/:id — Revoke a key (soft delete) */
keysRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const [result] = await pool.query<any>(
      'UPDATE api_keys SET revoked = 1 WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Key not found' });
    }
    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'key.revoked', resource_type: 'api_key', resource_id: req.params.id,
      details: {},
      ip_address: req.ip,
    }).catch(() => {});
    return res.json({ status: 'success', message: 'Key revoked' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

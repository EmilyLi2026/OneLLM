/**
 * Key-Provider Binding Routes — 1:N 多 Provider 绑定管理
 *
 * Replaces the single api_keys.provider_credential_id FK
 * with a proper join table supporting multiple providers per key.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../services/audit';
import { decrypt } from '../utils/crypto';
import { RowDataPacket } from 'mysql2';

export const bindingsRouter = Router({ mergeParams: true });

interface BindingRow extends RowDataPacket {
  id: string; api_key_id: string; provider_credential_id: string;
  priority_order: number; weight: number; enabled: number;
  allowed_models: any;
  daily_budget_cents: number; monthly_budget_cents: number; created_at: string;
  provider_name?: string; api_key_preview?: string;
}

/** GET /api/v1/keys/:keyId/bindings — List all Provider bindings for a key */
bindingsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const { keyId } = req.params;
    // Verify key belongs to workspace
    const [keys] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked = 0',
      [keyId, req.workspaceId]
    );
    if (keys.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Key not found' });
    }

    const [bindings] = await pool.query<BindingRow[]>(
      `SELECT kpb.*, pc.provider_name,
              CONCAT(LEFT(pc.api_key_encrypted, 8), '...', RIGHT(pc.api_key_encrypted, 4)) as api_key_preview
       FROM key_provider_bindings kpb
       JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
       WHERE kpb.api_key_id = ?
       ORDER BY kpb.priority_order ASC, kpb.weight DESC`,
      [keyId]
    );
    return res.json({ status: 'success', data: bindings });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/keys/:keyId/bindings — Add a Provider binding */
bindingsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { keyId } = req.params;
    const {
      provider_credential_id, priority_order, weight,
      allowed_models, daily_budget_cents, monthly_budget_cents,
    } = req.body;

    if (!provider_credential_id) {
      return res.status(400).json({ status: 'error', message: 'provider_credential_id is required' });
    }

    // Verify key belongs to workspace
    const [keys] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked = 0',
      [keyId, req.workspaceId]
    );
    if (keys.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Key not found' });
    }

    // Verify provider belongs to same workspace
    const [provs] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM provider_credentials WHERE id = ? AND workspace_id = ?',
      [provider_credential_id, req.workspaceId]
    );
    if (provs.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Provider not found in this workspace' });
    }

    const id = genId('kpb');
    await pool.query(
      `INSERT INTO key_provider_bindings
       (id, api_key_id, provider_credential_id, priority_order, weight, enabled, allowed_models, daily_budget_cents, monthly_budget_cents)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id, keyId, provider_credential_id,
        priority_order ?? 1, weight ?? 100,
        allowed_models ? JSON.stringify(allowed_models) : null,
        daily_budget_cents || 0, monthly_budget_cents || 0,
      ]
    );

    // Also set the legacy FK for backward compat (first binding only)
    const [existingBindings] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM key_provider_bindings WHERE api_key_id = ?',
      [keyId]
    );
    if (existingBindings[0].cnt === 1) {
      await pool.query('UPDATE api_keys SET provider_credential_id = ? WHERE id = ?',
        [provider_credential_id, keyId]);
    }

    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'key.binding.created', resource_type: 'key_provider_binding', resource_id: id,
      details: { api_key_id: keyId, provider_credential_id },
      ip_address: req.ip,
    }).catch(() => {});

    return res.status(201).json({ status: 'success', data: { id, api_key_id: keyId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'This provider is already bound to this key' });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/keys/:keyId/bindings/:id — Update a binding */
bindingsRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { keyId, id } = req.params;
    const { priority_order, weight, enabled, allowed_models, daily_budget_cents, monthly_budget_cents } = req.body;

    // Verify binding belongs to key in this workspace
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT kpb.id FROM key_provider_bindings kpb
       JOIN api_keys ak ON kpb.api_key_id = ak.id
       WHERE kpb.id = ? AND kpb.api_key_id = ? AND ak.workspace_id = ?`,
      [id, keyId, req.workspaceId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Binding not found' });
    }

    const sets: string[] = [];
    const vals: any[] = [];
    if (priority_order !== undefined) { sets.push('priority_order = ?'); vals.push(priority_order); }
    if (weight !== undefined) { sets.push('weight = ?'); vals.push(weight); }
    if (enabled !== undefined) { sets.push('enabled = ?'); vals.push(enabled ? 1 : 0); }
    if (allowed_models !== undefined) {
      sets.push('allowed_models = ?');
      vals.push(allowed_models ? JSON.stringify(allowed_models) : null);
    }
    if (daily_budget_cents !== undefined) { sets.push('daily_budget_cents = ?'); vals.push(daily_budget_cents); }
    if (monthly_budget_cents !== undefined) { sets.push('monthly_budget_cents = ?'); vals.push(monthly_budget_cents); }

    if (sets.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No fields to update' });
    }

    vals.push(id);
    await pool.query(`UPDATE key_provider_bindings SET ${sets.join(', ')} WHERE id = ?`, vals);

    return res.json({ status: 'success', message: 'Binding updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** DELETE /api/v1/keys/:keyId/bindings/:id — Remove a binding */
bindingsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { keyId, id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT kpb.id, kpb.provider_credential_id FROM key_provider_bindings kpb
       JOIN api_keys ak ON kpb.api_key_id = ak.id
       WHERE kpb.id = ? AND kpb.api_key_id = ? AND ak.workspace_id = ?`,
      [id, keyId, req.workspaceId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Binding not found' });
    }

    await pool.query('DELETE FROM key_provider_bindings WHERE id = ?', [id]);

    // If the legacy FK points to the removed binding's provider, update to the first remaining binding
    const [remaining] = await pool.query<RowDataPacket[]>(
      'SELECT provider_credential_id FROM key_provider_bindings WHERE api_key_id = ? ORDER BY priority_order ASC, weight DESC LIMIT 1',
      [keyId]
    );
    await pool.query('UPDATE api_keys SET provider_credential_id = ? WHERE id = ?',
      [remaining.length > 0 ? remaining[0].provider_credential_id : null, keyId]);

    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'key.binding.deleted', resource_type: 'key_provider_binding', resource_id: id,
      details: { api_key_id: keyId },
      ip_address: req.ip,
    }).catch(() => {});

    return res.json({ status: 'success', message: 'Binding removed' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Provider Credential Routes — MySQL
 */

import { Router } from 'express';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';
import { encrypt } from '../utils/crypto';
import { recordAudit } from '../services/audit';

export const providersRouter = Router();

interface ProviderRow extends RowDataPacket {
  id: string; provider_name: string; api_key_encrypted: string; created_at: string;
}

/** POST /api/v1/providers — Store encrypted upstream API key */
providersRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { provider_name, api_key } = req.body;
    if (!provider_name || !api_key) {
      return res.status(400).json({ status: 'error', message: 'provider_name and api_key required' });
    }

    const wsId = req.workspaceId;
    if (!wsId) {
      return res.status(400).json({ status: 'error', message: 'Workspace context missing' });
    }

    const encrypted = encrypt(api_key);
    const masked = api_key.substring(0, 8) + '...' + api_key.substring(api_key.length - 4);

    // Check if already exists for this workspace
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM provider_credentials WHERE workspace_id = ? AND provider_name = ?',
      [wsId, provider_name]
    );

    if (existing.length > 0) {
      // Update existing — keep original id
      await pool.query(
        'UPDATE provider_credentials SET api_key_encrypted = ? WHERE id = ?',
        [encrypted, existing[0].id]
      );
      return res.json({
        status: 'success',
        data: { id: existing[0].id, provider_name, api_key_preview: masked, updated: true },
      });
    }

    // Insert new
    const id = genId('provider');
    await pool.query(
      `INSERT INTO provider_credentials (id, workspace_id, provider_name, api_key_encrypted)
       VALUES (?, ?, ?, ?)`,
      [id, wsId, provider_name, encrypted]
    );

    return res.status(201).json({
      status: 'success',
      data: { id, provider_name, api_key_preview: masked },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/providers/:id — Update (replace) an existing provider's API key */
providersRouter.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key) return res.status(400).json({ status: 'error', message: 'api_key required' });
    const encrypted = encrypt(api_key);
    const result = await pool.query(
      'UPDATE provider_credentials SET api_key_encrypted = ? WHERE id = ? AND workspace_id = ?',
      [encrypted, req.params.id, req.workspaceId]
    ) as any;
    if (result[0].affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Provider not found' });
    }
    return res.json({ status: 'success', message: 'Updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** DELETE /api/v1/providers/:id — Remove a provider credential */
providersRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const wsId = req.workspaceId;

    // Verify provider belongs to this workspace
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, provider_name FROM provider_credentials WHERE id = ? AND workspace_id = ?',
      [id, wsId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Provider not found' });
    }

    const providerName = rows[0].provider_name;

    // Count affected bindings (will be cascade-deleted)
    const [bindings] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM key_provider_bindings WHERE provider_credential_id = ?',
      [id]
    );
    const bindingCount = Number(bindings[0].cnt);

    await pool.query('DELETE FROM provider_credentials WHERE id = ? AND workspace_id = ?', [id, wsId]);

    recordAudit({
      workspace_id: wsId,
      user_id: req.userId,
      action: 'provider.deleted',
      resource_type: 'provider_credential',
      resource_id: id,
      details: { provider_name: providerName, bindings_removed: bindingCount },
      ip_address: req.ip,
    }).catch(() => {});

    return res.json({
      status: 'success',
      message: bindingCount > 0
        ? `已删除 ${providerName}，同时移除了 ${bindingCount} 个 Key 绑定`
        : `已删除 ${providerName}`,
      data: { id, provider_name: providerName, bindings_removed: bindingCount },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/providers — List providers (keys masked) */
providersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<ProviderRow[]>(
      `SELECT id, provider_name, created_at FROM provider_credentials
       WHERE workspace_id = ? ORDER BY created_at DESC`,
      [req.workspaceId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

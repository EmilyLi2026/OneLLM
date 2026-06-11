/**
 * Workspace Routes — MySQL
 */

import { Router } from 'express';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../services/audit';
import { RowDataPacket } from 'mysql2';

export const workspacesRouter = Router();

interface MemberRow extends RowDataPacket {
  id: string; user_id: string; email: string; name: string; role: string; created_at: string;
}

interface WsRow extends RowDataPacket {
  id: string; name: string; slug: string; owner_id: string;
  monthly_budget_cents: number; created_at: string;
}

/** POST /api/v1/workspaces */
workspacesRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, slug } = req.body;
    const id = genId('ws');

    await pool.query(
      'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
      [id, name || 'My Workspace', slug || `ws-${Date.now()}`, req.userId]
    );

    // Auto-add owner as workspace member with 'owner' role
    const memberId = genId('member');
    await pool.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [memberId, id, req.userId, 'owner']
    );

    return res.status(201).json({
      status: 'success',
      data: { id, name: name || 'My Workspace', slug: slug || `ws-${Date.now()}`, owner_id: req.userId },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/workspaces */
workspacesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<WsRow[]>(
      `SELECT w.* FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = ? ORDER BY w.created_at DESC`,
      [req.userId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/workspaces/:id */
workspacesRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<WsRow[]>(
      'SELECT * FROM workspaces WHERE id = ?', [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Workspace not found' });
    }
    return res.json({ status: 'success', data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/workspaces/:id/settings — Update workspace settings */
workspacesRouter.put('/:id/settings', async (req: AuthRequest, res) => {
  try {
    const { name, monthly_budget_cents } = req.body;
    if (monthly_budget_cents !== undefined) {
      await pool.query(
        'UPDATE workspaces SET monthly_budget_cents = ? WHERE id = ? AND owner_id = ?',
        [Number(monthly_budget_cents), req.params.id, req.userId]
      );
    }
    if (name) {
      await pool.query(
        'UPDATE workspaces SET name = ? WHERE id = ? AND owner_id = ?',
        [name, req.params.id, req.userId]
      );
    }
    return res.json({ status: 'success', message: 'Updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/workspaces/:id/members — List members */
workspacesRouter.get('/:id/members', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<MemberRow[]>(
      `SELECT wm.id, wm.user_id, u.email, u.phone, u.name, wm.role, wm.created_at
       FROM workspace_members wm JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ? ORDER BY wm.created_at ASC`,
      [req.params.id]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/workspaces/:id/members — Invite user by email */
workspacesRouter.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const { email, role = 'member' } = req.body;
    const [users] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ status: 'error', message: 'User not found' });
    const userId = users[0].id;

    const memberId = genId('member');
    await pool.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [memberId, req.params.id, userId, role]
    );
    recordAudit({ workspace_id: req.workspaceId, user_id: req.userId, action: 'member.invited', resource_type: 'workspace_member', resource_id: memberId, details: { email, role }, ip_address: req.ip }).catch(() => {});
    return res.status(201).json({ status: 'success', data: { id: memberId, email, role } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ status: 'error', message: 'User already in workspace' });
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/workspaces/:id/members/:memberId — Change member role */
workspacesRouter.put('/:id/members/:memberId', async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    await pool.query('UPDATE workspace_members SET role = ? WHERE id = ? AND workspace_id = ?', [role, req.params.memberId, req.params.id]);
    return res.json({ status: 'success', message: 'Role updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** DELETE /api/v1/workspaces/:id/members/:memberId — Remove member */
workspacesRouter.delete('/:id/members/:memberId', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?', [req.params.memberId, req.params.id]);
    recordAudit({ workspace_id: req.workspaceId, user_id: req.userId, action: 'member.removed', resource_type: 'workspace_member', resource_id: req.params.memberId, ip_address: req.ip }).catch(() => {});
    return res.json({ status: 'success', message: 'Member removed' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

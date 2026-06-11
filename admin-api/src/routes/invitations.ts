/**
 * Workspace Invitation Routes
 *
 * Invite users to a workspace via shareable code links.
 * Does NOT depend on email or pre-registration — invitees verify via SMS.
 */

import { Router } from 'express';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../services/audit';
import { RowDataPacket } from 'mysql2';

export const invitationsRouter = Router({ mergeParams: true });

interface InvitationRow extends RowDataPacket {
  id: string; workspace_id: string; code: string; role: string;
  created_by: string; expires_at: string; max_uses: number; use_count: number;
  accepted_by: string | null; accepted_at: string | null;
  status: string; created_at: string;
  creator_name?: string;
}

/** Generate a short human-readable invitation code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** POST /api/v1/workspaces/:id/invitations — Create an invitation */
invitationsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.id;
    const { role = 'member', expires_in_hours = 72, max_uses = 1 } = req.body;

    // Verify the current user can manage this workspace
    const [members] = await pool.query<RowDataPacket[]>(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ status: 'error', message: 'You are not a member of this workspace' });
    }
    const memberRole = members[0].role;
    if (memberRole !== 'owner' && memberRole !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Only owner or admin can create invitations' });
    }

    const id = genId('inv');
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + expires_in_hours * 3600 * 1000);

    await pool.query(
      `INSERT INTO invitations (id, workspace_id, code, role, created_by, expires_at, max_uses)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, workspaceId, code, role, req.userId, expiresAt, max_uses]
    );

    recordAudit({
      workspace_id: workspaceId, user_id: req.userId,
      action: 'invitation.created', resource_type: 'invitation', resource_id: id,
      details: { code, role, expires_in_hours },
      ip_address: req.ip,
    }).catch(() => {});

    return res.status(201).json({
      status: 'success',
      data: {
        id,
        code,
        role,
        expires_at: expiresAt.toISOString(),
        max_uses,
        // The frontend builds the actual join URL
        join_url: `/join?code=${code}`,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/workspaces/:id/invitations — List invitations */
invitationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.id;

    // Verify membership
    const [members] = await pool.query<RowDataPacket[]>(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Not a workspace member' });
    }

    const [rows] = await pool.query<InvitationRow[]>(
      `SELECT i.*, u.name as creator_name
       FROM invitations i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.workspace_id = ?
       ORDER BY i.created_at DESC`,
      [workspaceId]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/workspaces/:id/invitations/:invitationId — Get single invitation */
invitationsRouter.get('/:invitationId', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<InvitationRow[]>(
      `SELECT i.*, u.name as creator_name
       FROM invitations i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ? AND i.workspace_id = ?`,
      [req.params.invitationId, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Invitation not found' });
    }
    return res.json({ status: 'success', data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** DELETE /api/v1/workspaces/:id/invitations/:invitationId — Revoke an invitation */
invitationsRouter.delete('/:invitationId', async (req: AuthRequest, res) => {
  try {
    const [result] = await pool.query<any>(
      `UPDATE invitations SET status = 'revoked'
       WHERE id = ? AND workspace_id = ? AND status = 'active'`,
      [req.params.invitationId, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Active invitation not found' });
    }

    recordAudit({
      workspace_id: req.params.id, user_id: req.userId,
      action: 'invitation.revoked', resource_type: 'invitation', resource_id: req.params.invitationId,
      ip_address: req.ip,
    }).catch(() => {});

    return res.json({ status: 'success', message: 'Invitation revoked' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

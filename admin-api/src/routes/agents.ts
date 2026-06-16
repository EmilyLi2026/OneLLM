/**
 * Agent Routes — MySQL
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { genId } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { requireWrite } from '../middleware/rbac';
import { recordAudit } from '../services/audit';
import { centsToYuan } from '../utils/currency';
import { RowDataPacket } from 'mysql2';

export const agentsRouter = Router();

interface AgentRow extends RowDataPacket {
  id: string; workspace_id: string; user_id: string; name: string;
  description: string; default_model: string; api_key_hash: string;
  status: string; daily_token_limit: number; monthly_cost_limit_cents: number;
  execution_tier: number; created_at: string; updated_at: string;
}

function maskKey(hash: string): string {
  return hash ? hash.substring(0, 10) + '...' : 'N/A';
}

/** POST /api/v1/agents */
agentsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, default_model } = req.body;
    const id = genId('agent');
    const rawKey = `onellm_ag_${Math.random().toString(36).substring(2, 30)}`;
    const apiKeyHash = await bcrypt.hash(rawKey, 8);

    await pool.query(
      `INSERT INTO agents (id, workspace_id, user_id, name, description, default_model, api_key_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, req.workspaceId || '', req.userId || '', name || 'Unnamed Agent', description || '', default_model || 'gpt-4o', apiKeyHash]
    );

    // Audit
    recordAudit({
      workspace_id: req.workspaceId, user_id: req.userId,
      action: 'agent.created', resource_type: 'agent', resource_id: id,
      details: { name: name || 'Unnamed Agent', default_model: default_model || 'gpt-4o' },
      ip_address: req.ip,
    }).catch(() => {});

    return res.status(201).json({
      status: 'success',
      data: {
        id, name: name || 'Unnamed Agent',
        api_key: rawKey,
        warning: 'Store this API key securely. It will not be shown again.',
        default_model: default_model || 'gpt-4o',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Agent create error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/agents */
agentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<AgentRow[]>(
      'SELECT id, name, description, default_model, status, execution_tier, created_at FROM agents WHERE workspace_id = ? ORDER BY created_at DESC',
      [req.workspaceId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/agents/:id */
agentsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<AgentRow[]>(
      'SELECT id, name, description, default_model, status, execution_tier, daily_token_limit, monthly_cost_limit_cents, created_at, updated_at FROM agents WHERE id = ? AND workspace_id = ?',
      [req.params.id, req.workspaceId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Agent not found' });
    }
    return res.json({ status: 'success', data: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/agents/:id/cost */
agentsRouter.get('/:id/cost', async (req: AuthRequest, res) => {
  try {
    const [[{ total_tokens, total_cost }]] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total_tokens,
              COALESCE(SUM(cost_cents), 0) as total_cost
       FROM request_logs WHERE agent_id = ?`,
      [req.params.id]
    );

    return res.json({
      status: 'success',
      data: {
        agent_id: req.params.id,
        summary: {
          total_tokens: Number(total_tokens),
          total_cost_cents: Number(total_cost),
          total_cost_yuan: centsToYuan(total_cost),
        },
        period: req.query.period || 'all',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PATCH /api/v1/agents/:id */
agentsRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const allowed = ['name', 'description', 'default_model', 'status', 'execution_tier'];
    const sets: string[] = [];
    const vals: any[] = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        sets.push(`${field} = ?`);
        vals.push(req.body[field]);
      }
    }
    if (sets.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid fields to update' });
    }
    vals.push(req.params.id, req.workspaceId);
    await pool.query(
      `UPDATE agents SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ?`,
      vals
    );
    return res.json({ status: 'success', message: 'Updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

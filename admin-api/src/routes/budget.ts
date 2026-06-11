/**
 * Budget Routes
 *
 * Endpoints:
 *   GET  /api/v1/budget/settings   — full budget settings (workspace + keys + agents)
 *   PUT  /api/v1/budget/settings/workspace — update workspace budgets
 *   PUT  /api/v1/budget/settings/keys/:id  — update key budgets
 *   PUT  /api/v1/budget/settings/agents/:id — update agent budgets
 *   GET  /api/v1/budget/analytics  — budget dashboard data
 *   GET  /api/v1/budget/status     — quick workspace budget status
 *   GET  /api/v1/budget/alerts     — recent alerts
 */

import { Router } from 'express';
import pool from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';
import { getBudgetSettings, getBudgetAnalytics, getWorkspaceBudgetStatus } from '../services/budget';

export const budgetRouter = Router();

/** GET /api/v1/budget/settings — All budget settings for current workspace */
budgetRouter.get('/settings', async (req: AuthRequest, res) => {
  try {
    const data = await getBudgetSettings(req.workspaceId || '');
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/budget/settings/workspace — Update workspace budgets */
budgetRouter.put('/settings/workspace', async (req: AuthRequest, res) => {
  try {
    const { monthly_budget_cents, daily_budget_cents } = req.body;
    await pool.query(
      `UPDATE workspaces SET
       monthly_budget_cents = COALESCE(?, monthly_budget_cents),
       daily_budget_cents = COALESCE(?, daily_budget_cents)
       WHERE id = ?`,
      [monthly_budget_cents ?? null, daily_budget_cents ?? null, req.workspaceId]
    );
    return res.json({ status: 'success', message: 'Workspace budget updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/budget/settings/keys/:id — Update key budgets */
budgetRouter.put('/settings/keys/:id', async (req: AuthRequest, res) => {
  try {
    const { monthly_budget_cents, daily_budget_cents } = req.body;
    const [result] = await pool.query<any>(
      `UPDATE api_keys SET
       monthly_budget_cents = COALESCE(?, monthly_budget_cents),
       daily_budget_cents = COALESCE(?, daily_budget_cents)
       WHERE id = ? AND workspace_id = ?`,
      [monthly_budget_cents ?? null, daily_budget_cents ?? null, req.params.id, req.workspaceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Key not found' });
    }
    return res.json({ status: 'success', message: 'Key budget updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/budget/settings/bindings/:id — Update binding-level budgets */
budgetRouter.put('/settings/bindings/:id', async (req: AuthRequest, res) => {
  try {
    const { daily_budget_cents, monthly_budget_cents } = req.body;
    const [result] = await pool.query<any>(
      `UPDATE key_provider_bindings kpb
       JOIN api_keys ak ON kpb.api_key_id = ak.id
       SET
         kpb.daily_budget_cents = COALESCE(?, kpb.daily_budget_cents),
         kpb.monthly_budget_cents = COALESCE(?, kpb.monthly_budget_cents)
       WHERE kpb.id = ? AND ak.workspace_id = ?`,
      [daily_budget_cents ?? null, monthly_budget_cents ?? null, req.params.id, req.workspaceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Binding not found' });
    }
    return res.json({ status: 'success', message: 'Binding budget updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** PUT /api/v1/budget/settings/agents/:id — Update agent budgets */
budgetRouter.put('/settings/agents/:id', async (req: AuthRequest, res) => {
  try {
    const { daily_token_limit, monthly_cost_limit_cents } = req.body;
    const [result] = await pool.query<any>(
      `UPDATE agents SET
       daily_token_limit = COALESCE(?, daily_token_limit),
       monthly_cost_limit_cents = COALESCE(?, monthly_cost_limit_cents)
       WHERE id = ? AND workspace_id = ?`,
      [daily_token_limit ?? null, monthly_cost_limit_cents ?? null, req.params.id, req.workspaceId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Agent not found' });
    }
    return res.json({ status: 'success', message: 'Agent budget updated' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/budget/analytics — Budget dashboard analytics */
budgetRouter.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const data = await getBudgetAnalytics(req.workspaceId || '');
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/budget/status — Quick workspace budget overview */
budgetRouter.get('/status', async (req: AuthRequest, res) => {
  try {
    const data = await getWorkspaceBudgetStatus(req.workspaceId || '');
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/budget/alerts — Recent budget alerts */
budgetRouter.get('/alerts', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM budget_alerts WHERE workspace_id = ?
       ORDER BY notified_at DESC LIMIT 30`,
      [req.workspaceId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Budget Service
 *
 * Four-level enforcement:
 *   🟢 normal   (<70%):  no action
 *   🟡 warning  (70-85%): notification only
 *   🟠 throttle (85-100%): notification + RPM halved
 *   🔴 cutoff   (>=100%):  notification + hard block (402)
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

export type BudgetLevel = 'normal' | 'warning' | 'throttle' | 'cutoff';

export interface BudgetCheckResult {
  level: BudgetLevel;
  budget_name: string;        // which budget was checked
  budgeted_cents: number;
  spent_cents: number;
  percent: number;
  message: string;
}

export interface BindingBudgetInfo {
  id: string;
  provider_name: string;
  priority_order: number;
  weight: number;
  enabled: boolean;
  allowed_models: string[] | null;
  daily_budget_cents: number;
  monthly_budget_cents: number;
  daily_spent: number;
  monthly_spent: number;
}

export interface BudgetSettings {
  workspace: {
    monthly_budget_cents: number;
    daily_budget_cents: number;
  };
  api_keys: Array<{
    id: string; name: string; key_prefix: string; provider_name: string | null;
    monthly_budget_cents: number; daily_budget_cents: number;
    monthly_spent: number; daily_spent: number;
    binding_count: number;
    bindings: BindingBudgetInfo[];
  }>;
  agents: Array<{
    id: string; name: string; status: string;
    daily_token_limit: number; monthly_cost_limit_cents: number;
    daily_tokens_used: number; monthly_cost_cents: number;
  }>;
}

export interface BudgetAnalytics {
  workspace: {
    monthly_budget_cents: number; daily_budget_cents: number;
    monthly_spent_cents: number; daily_spent_cents: number;
    monthly_percent: number; daily_percent: number;
    forecast_days_remaining: number | null;
    suggested_daily_limit: number | null;
  };
  breakdown_by_key: Array<{ name: string; cost_yuan: number; percent: number }>;
  breakdown_by_model: Array<{ name: string; cost_yuan: number; percent: number }>;
  daily_trend: Array<{ date: string; cost_yuan: number; budget_line: number | null }>;
  recent_alerts: Array<{ alert_type: string; threshold_percent: number; notified_at: string }>;
}

// ── Helpers ──

function getLevel(percent: number): BudgetLevel {
  if (percent >= 100) return 'cutoff';
  if (percent >= 85) return 'throttle';
  if (percent >= 70) return 'warning';
  return 'normal';
}

function budgetMessage(name: string, level: BudgetLevel, percent: number): string {
  switch (level) {
    case 'cutoff':   return `${name} 已达 ${percent}%，已触发熔断拦截`;
    case 'throttle': return `${name} 已达 ${percent}%，已触发限流（RPM减半）`;
    case 'warning':  return `${name} 已达 ${percent}%，请注意控制用量`;
    default:         return `${name} 用量正常（${percent}%）`;
  }
}

function genAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

async function recordAlert(workspaceId: string, alertType: string, resourceId: string | null, thresholdPct: number) {
  // Deduplicate: only one alert per type+resource per day
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM budget_alerts WHERE workspace_id = ? AND alert_type = ? AND resource_id <=> ? AND DATE(notified_at) = CURDATE()`,
    [workspaceId, alertType, resourceId]
  );
  if (existing.length === 0) {
    await pool.query(
      `INSERT INTO budget_alerts (id, workspace_id, alert_type, resource_id, threshold_percent)
       VALUES (?, ?, ?, ?, ?)`,
      [genAlertId(), workspaceId, alertType, resourceId, thresholdPct]
    );
  }
}

// ── Budget Enforcement ──

/**
 * Check ALL budget layers for a request.
 * Returns the most severe result across workspace, key, and agent budgets.
 */
export async function checkAllBudgets(
  workspaceId: string,
  keyId: string | null,
  agentId: string | null
): Promise<BudgetCheckResult | null> {
  const results: BudgetCheckResult[] = [];

  // 1. Workspace daily budget
  const ws = await checkWorkspaceDailyBudget(workspaceId);
  if (ws) results.push(ws);

  // 2. Workspace monthly budget
  const wsMonth = await checkWorkspaceMonthlyBudget(workspaceId);
  if (wsMonth) results.push(wsMonth);

  // 3. API Key budgets
  if (keyId) {
    const kDaily = await checkKeyDailyBudget(keyId, workspaceId);
    if (kDaily) results.push(kDaily);
    const kMonthly = await checkKeyMonthlyBudget(keyId, workspaceId);
    if (kMonthly) results.push(kMonthly);
  }

  // 4. Agent budgets
  if (agentId) {
    const aDaily = await checkAgentDailyTokens(agentId, workspaceId);
    if (aDaily) results.push(aDaily);
    const aMonthly = await checkAgentMonthlyCost(agentId, workspaceId);
    if (aMonthly) results.push(aMonthly);
  }

  if (results.length === 0) return null;

  // Return the most severe result
  const severity: Record<BudgetLevel, number> = { normal: 0, warning: 1, throttle: 2, cutoff: 3 };
  results.sort((a, b) => severity[b.level] - severity[a.level]);
  return results[0];
}

async function checkWorkspaceDailyBudget(workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[ws]] = await pool.query<RowDataPacket[]>(
    'SELECT daily_budget_cents FROM workspaces WHERE id = ?', [workspaceId]
  );
  if (!ws?.daily_budget_cents || Number(ws.daily_budget_cents) === 0) return null;

  const budgeted = Number(ws.daily_budget_cents);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE workspace_id = ? AND DATE(created_at) = CURDATE()`,
    [workspaceId]
  );
  const spentCents = Number(spent.total);
  const percent = Math.round((spentCents / budgeted) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `workspace_daily_${level}`, null, percent);
  return { level, budget_name: 'Workspace 日预算', budgeted_cents: budgeted, spent_cents: spentCents, percent,
    message: budgetMessage('Workspace 日预算', level, percent) };
}

async function checkWorkspaceMonthlyBudget(workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[ws]] = await pool.query<RowDataPacket[]>(
    'SELECT monthly_budget_cents FROM workspaces WHERE id = ?', [workspaceId]
  );
  if (!ws?.monthly_budget_cents || Number(ws.monthly_budget_cents) === 0) return null;

  const budgeted = Number(ws.monthly_budget_cents);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE workspace_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`,
    [workspaceId]
  );
  const spentCents = Number(spent.total);
  const percent = Math.round((spentCents / budgeted) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `workspace_monthly_${level}`, null, percent);
  return { level, budget_name: 'Workspace 月预算', budgeted_cents: budgeted, spent_cents: spentCents, percent,
    message: budgetMessage('Workspace 月预算', level, percent) };
}

async function checkKeyDailyBudget(keyId: string, workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[key]] = await pool.query<RowDataPacket[]>(
    'SELECT name, daily_budget_cents FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked = 0',
    [keyId, workspaceId]
  );
  if (!key?.daily_budget_cents || Number(key.daily_budget_cents) === 0) return null;

  const budgeted = Number(key.daily_budget_cents);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs rl
     JOIN api_keys ak ON rl.workspace_id = ak.workspace_id AND rl.user_id = ak.user_id
     WHERE ak.id = ? AND DATE(rl.created_at) = CURDATE()`,
    [keyId]
  );
  const spentCents = Number(spent.total);
  const percent = Math.round((spentCents / budgeted) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `key_daily_${level}`, keyId, percent);
  return { level, budget_name: `Key "${key.name}" 日预算`, budgeted_cents: budgeted, spent_cents: spentCents, percent,
    message: budgetMessage(`Key "${key.name}" 日预算`, level, percent) };
}

async function checkKeyMonthlyBudget(keyId: string, workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[key]] = await pool.query<RowDataPacket[]>(
    'SELECT name, monthly_budget_cents FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked = 0',
    [keyId, workspaceId]
  );
  if (!key?.monthly_budget_cents || Number(key.monthly_budget_cents) === 0) return null;

  const budgeted = Number(key.monthly_budget_cents);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs rl
     JOIN api_keys ak ON rl.workspace_id = ak.workspace_id AND rl.user_id = ak.user_id
     WHERE ak.id = ? AND YEAR(rl.created_at) = YEAR(NOW()) AND MONTH(rl.created_at) = MONTH(NOW())`,
    [keyId]
  );
  const spentCents = Number(spent.total);
  const percent = Math.round((spentCents / budgeted) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `key_monthly_${level}`, keyId, percent);
  return { level, budget_name: `Key "${key.name}" 月预算`, budgeted_cents: budgeted, spent_cents: spentCents, percent,
    message: budgetMessage(`Key "${key.name}" 月预算`, level, percent) };
}

async function checkAgentDailyTokens(agentId: string, workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[agent]] = await pool.query<RowDataPacket[]>(
    'SELECT name, daily_token_limit FROM agents WHERE id = ?', [agentId]
  );
  if (!agent?.daily_token_limit || Number(agent.daily_token_limit) === 0) return null;

  const limit = Number(agent.daily_token_limit);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total FROM request_logs
     WHERE agent_id = ? AND DATE(created_at) = CURDATE()`,
    [agentId]
  );
  const spentTokens = Number(spent.total);
  const percent = Math.round((spentTokens / limit) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `agent_daily_${level}`, agentId, percent);
  return { level, budget_name: `Agent "${agent.name}" 日Token`, budgeted_cents: limit, spent_cents: spentTokens, percent,
    message: budgetMessage(`Agent "${agent.name}" 日Token`, level, percent) };
}

async function checkAgentMonthlyCost(agentId: string, workspaceId: string): Promise<BudgetCheckResult | null> {
  const [[agent]] = await pool.query<RowDataPacket[]>(
    'SELECT name, monthly_cost_limit_cents FROM agents WHERE id = ?', [agentId]
  );
  if (!agent?.monthly_cost_limit_cents || Number(agent.monthly_cost_limit_cents) === 0) return null;

  const budgeted = Number(agent.monthly_cost_limit_cents);
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE agent_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`,
    [agentId]
  );
  const spentCents = Number(spent.total);
  const percent = Math.round((spentCents / budgeted) * 100);
  const level = getLevel(percent);
  if (level === 'normal') return null;

  recordAlert(workspaceId, `agent_monthly_${level}`, agentId, percent);
  return { level, budget_name: `Agent "${agent.name}" 月花费`, budgeted_cents: budgeted, spent_cents: spentCents, percent,
    message: budgetMessage(`Agent "${agent.name}" 月花费`, level, percent) };
}

// ── Settings ──

export async function getBudgetSettings(workspaceId: string): Promise<BudgetSettings> {
  // Workspace
  const [[ws]] = await pool.query<RowDataPacket[]>(
    'SELECT monthly_budget_cents, daily_budget_cents FROM workspaces WHERE id = ?', [workspaceId]
  );

  // API Keys with budget info
  const [keys] = await pool.query<RowDataPacket[]>(
    `SELECT ak.id, ak.name, ak.key_prefix, ak.monthly_budget_cents, ak.daily_budget_cents,
            pc.provider_name
     FROM api_keys ak LEFT JOIN provider_credentials pc ON ak.provider_credential_id = pc.id
     WHERE ak.workspace_id = ? AND ak.revoked = 0
     ORDER BY ak.created_at DESC`, [workspaceId]
  );

  // Key spending + bindings
  const keysWithSpending = await Promise.all(keys.map(async (k: any) => {
    const [[mSpent]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs rl
       JOIN api_keys ak ON rl.workspace_id = ak.workspace_id AND rl.user_id = ak.user_id
       WHERE ak.id = ? AND YEAR(rl.created_at) = YEAR(NOW()) AND MONTH(rl.created_at) = MONTH(NOW())`,
      [k.id]
    );
    const [[dSpent]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs rl
       JOIN api_keys ak ON rl.workspace_id = ak.workspace_id AND rl.user_id = ak.user_id
       WHERE ak.id = ? AND DATE(rl.created_at) = CURDATE()`,
      [k.id]
    );

    // ── Load bindings for this key ──
    let bindings: BindingBudgetInfo[] = [];
    try {
      const [bindingRows] = await pool.query<RowDataPacket[]>(
        `SELECT kpb.id, kpb.priority_order, kpb.weight, kpb.enabled,
                kpb.allowed_models, kpb.daily_budget_cents, kpb.monthly_budget_cents,
                pc.provider_name
         FROM key_provider_bindings kpb
         JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
         WHERE kpb.api_key_id = ? AND kpb.enabled = 1
         ORDER BY kpb.priority_order ASC`,
        [k.id]
      );

      // Per-binding spending
      if (bindingRows.length > 0) {
        const bIds = bindingRows.map((b: any) => b.id);
        const [dailySpending] = await pool.query<RowDataPacket[]>(
          `SELECT binding_id, COALESCE(SUM(cost_cents), 0) as total
           FROM request_logs WHERE binding_id IN (${bIds.map(() => '?').join(',')})
           AND DATE(created_at) = CURDATE() GROUP BY binding_id`,
          bIds
        );
        const dailyMap = new Map<string, number>();
        for (const r of dailySpending) dailyMap.set(r.binding_id, Number(r.total));

        const [monthlySpending] = await pool.query<RowDataPacket[]>(
          `SELECT binding_id, COALESCE(SUM(cost_cents), 0) as total
           FROM request_logs WHERE binding_id IN (${bIds.map(() => '?').join(',')})
           AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) GROUP BY binding_id`,
          bIds
        );
        const monthlyMap = new Map<string, number>();
        for (const r of monthlySpending) monthlyMap.set(r.binding_id, Number(r.total));

        bindings = bindingRows.map((b: any) => ({
          id: b.id,
          provider_name: b.provider_name,
          priority_order: b.priority_order,
          weight: b.weight,
          enabled: b.enabled === 1,
          allowed_models: b.allowed_models || null,
          daily_budget_cents: Number(b.daily_budget_cents),
          monthly_budget_cents: Number(b.monthly_budget_cents),
          daily_spent: dailyMap.get(b.id) || 0,
          monthly_spent: monthlyMap.get(b.id) || 0,
        }));
      }
    } catch {
      // binding_id column may not exist yet
    }

    // Key-level budgets & spending = SUM of all binding budgets & spending (auto-derived)
    const keyMonthlyBudget = bindings.length > 0
      ? bindings.reduce((sum, b) => sum + b.monthly_budget_cents, 0)
      : Number(k.monthly_budget_cents);
    const keyDailyBudget = bindings.length > 0
      ? bindings.reduce((sum, b) => sum + b.daily_budget_cents, 0)
      : Number(k.daily_budget_cents);
    // Spending: use binding_sum if available, otherwise fall back to api_key_id query
    const bindingMonthlySpent = bindings.reduce((sum, b) => sum + b.monthly_spent, 0);
    const bindingDailySpent = bindings.reduce((sum, b) => sum + b.daily_spent, 0);

    // Also query spending by api_key_id (permanent key attribution, survives binding deletion)
    let apiKeyMonthlySpent = 0;
    let apiKeyDailySpent = 0;
    try {
      const [[akmSpent]] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
         WHERE api_key_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`,
        [k.id]
      );
      apiKeyMonthlySpent = Number(akmSpent.total);
      const [[akdSpent]] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
         WHERE api_key_id = ? AND DATE(created_at) = CURDATE()`,
        [k.id]
      );
      apiKeyDailySpent = Number(akdSpent.total);
    } catch { /* api_key_id column may not exist yet */ }

    // Key spending = binding sum (for keys with bindings) or api_key_id query + fallback
    const keyMonthlySpent = bindings.length > 0
      ? bindingMonthlySpent
      : (apiKeyMonthlySpent > 0 ? apiKeyMonthlySpent : Number(mSpent.total));
    const keyDailySpent = bindings.length > 0
      ? bindingDailySpent
      : (apiKeyDailySpent > 0 ? apiKeyDailySpent : Number(dSpent.total));

    return {
      id: k.id, name: k.name, key_prefix: k.key_prefix, provider_name: k.provider_name || null,
      monthly_budget_cents: keyMonthlyBudget,
      daily_budget_cents: keyDailyBudget,
      monthly_spent: keyMonthlySpent,
      daily_spent: keyDailySpent,
      binding_count: bindings.length,
      bindings,
    };
  }));

  // Agents
  const [agents] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, status, daily_token_limit, monthly_cost_limit_cents FROM agents WHERE workspace_id = ?',
    [workspaceId]
  );
  const agentsWithSpending = await Promise.all(agents.map(async (a: any) => {
    const [[tSpent]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total FROM request_logs
       WHERE agent_id = ? AND DATE(created_at) = CURDATE()`, [a.id]
    );
    const [[cSpent]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
       WHERE agent_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`, [a.id]
    );
    return {
      id: a.id, name: a.name, status: a.status,
      daily_token_limit: Number(a.daily_token_limit),
      monthly_cost_limit_cents: Number(a.monthly_cost_limit_cents),
      daily_tokens_used: Number(tSpent.total),
      monthly_cost_cents: Number(cSpent.total),
    };
  }));

  return {
    workspace: {
      monthly_budget_cents: ws ? Number(ws.monthly_budget_cents) : 0,
      daily_budget_cents: ws ? Number(ws.daily_budget_cents) : 0,
    },
    api_keys: keysWithSpending,
    agents: agentsWithSpending,
  };
}

// ── Analytics ──

export async function getBudgetAnalytics(workspaceId: string): Promise<BudgetAnalytics> {
  const [[ws]] = await pool.query<RowDataPacket[]>(
    'SELECT monthly_budget_cents, daily_budget_cents FROM workspaces WHERE id = ?', [workspaceId]
  );
  const monthlyBudget = ws ? Number(ws.monthly_budget_cents) : 0;
  const dailyBudget = ws ? Number(ws.daily_budget_cents) : 0;

  // Monthly spending
  const [[mSpent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE workspace_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`,
    [workspaceId]
  );
  const monthlySpent = Number(mSpent.total);

  // Daily spending
  const [[dSpent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE workspace_id = ? AND DATE(created_at) = CURDATE()`,
    [workspaceId]
  );
  const dailySpent = Number(dSpent.total);

  // Forecast
  const daysIntoMonth = new Date().getDate();
  const dailyAvgSoFar = daysIntoMonth > 0 ? monthlySpent / daysIntoMonth : 0;
  const forecastDaysRemaining = monthlyBudget > 0 && dailyAvgSoFar > 0
    ? Math.round((monthlyBudget - monthlySpent) / dailyAvgSoFar)
    : null;
  const daysLeftInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - daysIntoMonth;
  const suggestedDailyLimit = monthlyBudget > 0
    ? Math.round((monthlyBudget - monthlySpent) / Math.max(daysLeftInMonth, 1))
    : null;

  // Breakdown by key
  const [keyBreakdown] = await pool.query<RowDataPacket[]>(
    `SELECT ak.name,
            COALESCE(SUM(rl.cost_cents), 0) as cost_cents
     FROM request_logs rl
     JOIN api_keys ak ON rl.workspace_id = ak.workspace_id AND rl.user_id = ak.user_id
     WHERE rl.workspace_id = ? AND YEAR(rl.created_at) = YEAR(NOW()) AND MONTH(rl.created_at) = MONTH(NOW())
     GROUP BY ak.name
     ORDER BY cost_cents DESC`, [workspaceId]
  );
  const totalKeyCost = keyBreakdown.reduce((s: number, r: any) => s + Number(r.cost_cents), 0);
  const breakdown_by_key = keyBreakdown.map((r: any) => ({
    name: r.name, cost_yuan: Number(r.cost_cents) / 100,
    percent: totalKeyCost > 0 ? Math.round(Number(r.cost_cents) / totalKeyCost * 100) : 0,
  }));

  // Breakdown by model
  const [modelBreakdown] = await pool.query<RowDataPacket[]>(
    `SELECT model as name, COALESCE(SUM(cost_cents), 0) as cost_cents
     FROM request_logs
     WHERE workspace_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())
     GROUP BY model ORDER BY cost_cents DESC`, [workspaceId]
  );
  const totalModelCost = modelBreakdown.reduce((s: number, r: any) => s + Number(r.cost_cents), 0);
  const breakdown_by_model = modelBreakdown.map((r: any) => ({
    name: r.name, cost_yuan: Number(r.cost_cents) / 100,
    percent: totalModelCost > 0 ? Math.round(Number(r.cost_cents) / totalModelCost * 100) : 0,
  }));

  // Daily trend (last 30 days, with budget line)
  const [dailyTrend] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(created_at) as date, COALESCE(SUM(cost_cents), 0) as cost_cents
     FROM request_logs
     WHERE workspace_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY date ASC`, [workspaceId]
  );
  const dailyBudgetYuan = dailyBudget > 0 ? dailyBudget / 100 : null;
  const daily_trend = dailyTrend.map((r: any) => ({
    date: r.date,
    cost_yuan: Number(r.cost_cents) / 100,
    budget_line: dailyBudgetYuan,
  }));

  // Recent alerts
  const [alerts] = await pool.query<RowDataPacket[]>(
    `SELECT alert_type, threshold_percent, notified_at FROM budget_alerts
     WHERE workspace_id = ? ORDER BY notified_at DESC LIMIT 10`, [workspaceId]
  );
  const recent_alerts = alerts.map((a: any) => ({
    alert_type: a.alert_type,
    threshold_percent: Number(a.threshold_percent),
    notified_at: a.notified_at,
  }));

  return {
    workspace: {
      monthly_budget_cents: monthlyBudget,
      daily_budget_cents: dailyBudget,
      monthly_spent_cents: monthlySpent,
      daily_spent_cents: dailySpent,
      monthly_percent: monthlyBudget > 0 ? Math.round(monthlySpent / monthlyBudget * 100) : 0,
      daily_percent: dailyBudget > 0 ? Math.round(dailySpent / dailyBudget * 100) : 0,
      forecast_days_remaining: forecastDaysRemaining,
      suggested_daily_limit: suggestedDailyLimit,
    },
    breakdown_by_key,
    breakdown_by_model,
    daily_trend,
    recent_alerts,
  };
}

// ── Fire-and-forget alert triggers (called from log-request) ──

/**
 * Trigger budget alerts for a workspace after each request log.
 * Checks both daily and monthly workspace budgets.
 * Called asynchronously (fire-and-forget) from internal/log-request.
 */
export async function checkWorkspaceBudget(workspaceId: string): Promise<void> {
  try {
    await checkWorkspaceDailyBudget(workspaceId);
  } catch { /* fire-and-forget: never throw */ }
  try {
    await checkWorkspaceMonthlyBudget(workspaceId);
  } catch { /* fire-and-forget: never throw */ }
}

/**
 * Trigger budget alerts for an agent after each request log.
 * Checks both daily token limit and monthly cost limit.
 * Called asynchronously (fire-and-forget) from internal/log-request.
 */
export async function checkAgentBudget(agentId: string, workspaceId: string): Promise<void> {
  try {
    await checkAgentDailyTokens(agentId, workspaceId);
  } catch { /* fire-and-forget: never throw */ }
  try {
    await checkAgentMonthlyCost(agentId, workspaceId);
  } catch { /* fire-and-forget: never throw */ }
}

// ── Backward compat (used by existing budget router) ──

export interface BudgetStatus {
  budgeted: number;
  spent: number;
  percent: number;
  is_exceeded: boolean;
  threshold_80: boolean;
  threshold_100: boolean;
}

export async function getWorkspaceBudgetStatus(workspaceId: string): Promise<BudgetStatus> {
  const [[ws]] = await pool.query<RowDataPacket[]>(
    'SELECT monthly_budget_cents FROM workspaces WHERE id = ?', [workspaceId]
  );
  const budgeted = ws ? Number(ws.monthly_budget_cents) : 0;
  const [[spent]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total FROM request_logs
     WHERE workspace_id = ? AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`,
    [workspaceId]
  );
  const spentVal = Number(spent.total);
  const pct = budgeted > 0 ? Math.round((spentVal / budgeted) * 100) : 0;
  return {
    budgeted, spent: spentVal, percent: pct,
    is_exceeded: budgeted > 0 && spentVal >= budgeted,
    threshold_80: pct >= 80,
    threshold_100: pct >= 100,
  };
}

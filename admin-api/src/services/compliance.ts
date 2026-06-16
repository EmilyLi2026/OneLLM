/**
 * Compliance Report Service
 *
 * Generates a structured compliance report by aggregating data from
 * existing tables: audit_logs, request_logs, api_keys, agents,
 * workspace_members, budget_alerts, model_specs, model_providers.
 *
 * The report is a pure read operation — no new data is written.
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

// ── Report types ──

export interface ComplianceReport {
  meta: ReportMeta;
  access_control: AccessControlSection;
  audit_trail: AuditTrailSection;
  data_flow: DataFlowSection;
  budget_control: BudgetControlSection;
  security_events: SecurityEventsSection;
  model_governance: ModelGovernanceSection;
  recommendations: Recommendation[];
}

interface ReportMeta {
  workspace_id: string;
  workspace_name: string;
  period_from: string;
  period_to: string;
  generated_at: string;
  rating: 'green' | 'yellow' | 'red';
  summary: ReportSummary;
}

interface ReportSummary {
  active_users: number;
  active_agents: number;
  total_requests: number;
  provider_count: number;
  audit_events: number;
  budget_violations: number;
  key_revocations: number;
  failed_logins: number;
  cross_border_requests: number;
}

interface AccessControlSection {
  members: MemberEntry[];
  api_keys: ApiKeyEntry[];
  role_changes: AuditEntry[];
}

interface MemberEntry {
  user_name: string;
  user_phone: string | null;
  role: string;
  joined_at: string;
}

interface ApiKeyEntry {
  name: string;
  key_type: 'api_key' | 'agent_key';
  key_preview: string;
  revoked: boolean;
  last_used_at: string | null;
  binding_count: number;
}

interface AuditTrailSection {
  action_distribution: { action: string; action_label: string; count: number }[];
  timeline: AuditEntry[];
  total_events: number;
}

interface AuditEntry {
  timestamp: string;
  user_name: string;
  action: string;
  action_label: string;
  resource_type: string;
  resource_name: string | null;
  details: Record<string, any>;
  ip_address: string | null;
}

interface DataFlowSection {
  by_provider: ProviderFlowEntry[];
  by_agent: AgentFlowEntry[];
  cross_border: CrossBorderAlert | null;
}

interface ProviderFlowEntry {
  provider: string;
  provider_name_cn: string | null;
  region: 'china' | 'international' | 'unknown';
  request_count: number;
  tokens_in: number;
  tokens_out: number;
  cost_yuan: string;
}

interface AgentFlowEntry {
  agent_id: string;
  agent_name: string;
  request_count: number;
  providers: string[];
}

interface CrossBorderAlert {
  provider_count: number;
  request_count: number;
  total_tokens: number;
  providers: string[];
  affected_agents: string[];
  suggestion: string;
}

interface BudgetControlSection {
  workspace_monthly_budget_yuan: string;
  workspace_daily_budget_yuan: string;
  agent_budgets: AgentBudgetEntry[];
  monthly_status: BudgetStatusEntry | null;
  violations: BudgetViolationEntry[];
  cost_trend: CostTrendEntry[];
}

interface AgentBudgetEntry {
  agent_id: string;
  agent_name: string;
  daily_token_limit: number;
  monthly_cost_limit_yuan: string;
}

interface BudgetStatusEntry {
  budgeted_yuan: string;
  spent_yuan: string;
  percent: number;
  level: string;
}

interface BudgetViolationEntry {
  alert_type: string;
  threshold_percent: number;
  notified_at: string;
  resource_id: string | null;
}

interface CostTrendEntry {
  period: string;
  cost_yuan: string;
  request_count: number;
}

interface SecurityEventsSection {
  failed_auth: number;
  key_revocations: number;
  invalid_key_attempts: number;
  rate_limit_triggers: number;
  provider_failovers: number;
  budget_cutoffs: number;
  notable_events: SecurityEvent[];
}

interface SecurityEvent {
  timestamp: string;
  event_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface ModelGovernanceSection {
  active_models: ModelEntry[];
  by_capability: CapabilityEntry[];
}

interface ModelEntry {
  model: string;
  model_name: string;
  provider: string;
  provider_name_cn: string | null;
  capability: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  request_count: number;
  region: string;
}

interface CapabilityEntry {
  capability: string;
  request_count: number;
  has_cross_border: boolean;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  suggestion: string;
}

// ── Constants ──

const DOMESTIC_PROVIDERS = new Set([
  'deepseek', 'dashscope', 'zhipu', 'moonshot', 'minimax',
  'baidu', 'bytedance', 'xunfei', 'lingyi', 'baichuan',
  'tencent', 'stepfun', 'siliconflow',
]);

const ACTION_LABELS: Record<string, string> = {
  'agent.created': '创建 Agent',
  'agent.updated': '更新 Agent',
  'agent.deleted': '删除 Agent',
  'key.created': '创建 API Key',
  'key.updated': '更新 API Key',
  'key.revoked': '吊销 API Key',
  'key.binding.created': '绑定 Provider',
  'key.binding.deleted': '解绑 Provider',
  'provider.created': '添加 Provider 凭证',
  'provider.updated': '更新 Provider 凭证',
  'provider.deleted': '删除 Provider 凭证',
  'workspace.created': '创建工作区',
  'workspace.updated': '更新工作区',
  'user.invited': '邀请成员',
  'user.joined': '加入工作区',
  'member.invited': '邀请成员',
  'member.removed': '移除成员',
  'budget.updated': '更新预算',
  'budget.alert': '预算告警',
  'model.created': '添加模型',
  'model.updated': '更新模型',
  'model.deleted': '删除模型',
};

const CAPABILITY_RISK_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  'text-generation': 'low',
  'reasoning': 'low',
  'embedding': 'low',
  'code': 'low',
  'visual': 'medium',
  'image-generation': 'medium',
  'audio': 'medium',
  'multimodal': 'high',
  'omni': 'high',
  'video-generation': 'high',
};

// ── Main entry point ──

export async function generateReport(
  workspaceId: string,
  from: string,
  to: string,
): Promise<ComplianceReport> {
  const toEnd = to + ' 23:59:59';

  // ── Run independent queries in parallel ──
  const [
    workspace,
    members,
    apiKeys,
    auditAll,
    requestByProvider,
    requestByAgent,
    costTrend,
    budgetData,
    budgetViolationsData,
    modelUsage,
  ] = await Promise.all([
    getWorkspace(workspaceId),
    getMembers(workspaceId),
    getApiKeys(workspaceId),
    getAuditLogs(workspaceId, from, toEnd),
    getRequestByProvider(workspaceId, from, toEnd),
    getRequestByAgent(workspaceId, from, toEnd),
    getCostTrend(workspaceId, from, toEnd),
    getBudgetSettings(workspaceId),
    getBudgetViolations(workspaceId, from, toEnd),
    getModelUsage(workspaceId, from, toEnd),
  ]);

  // ── Assemble report ──

  const totalRequests = requestByProvider.reduce((s, r) => s + r.request_count, 0);
  const crossBorder = requestByProvider.filter(r => r.region !== 'china');
  const activeAgents = requestByAgent.length;

  // Security events
  const keyRevocations = auditAll.filter(a => a.action === 'key.revoked').length;
  const budgetCutoffs = budgetViolationsData.filter(a => a.alert_type.includes('100') || a.alert_type.includes('cutoff')).length;
  const notableEvents = buildNotableEvents(auditAll, requestByProvider, budgetViolationsData);
  const providerFailovers = 0; // TODO: track in gateway

  // Recommendations
  const recommendations = buildRecommendations({
    workspace, members, apiKeys, auditAll, requestByProvider, requestByAgent,
    costTrend, budgetData, budgetViolationsData, modelUsage, totalRequests,
    crossBorderCount: crossBorder.length,
  });

  // Rating
  const rating = calcRating({ recommendations, budgetViolationsData, crossBorderCount: crossBorder.length });

  const report: ComplianceReport = {
    meta: {
      workspace_id: workspaceId,
      workspace_name: workspace?.name || 'Unknown',
      period_from: from,
      period_to: to,
      generated_at: new Date().toISOString(),
      rating,
      summary: {
        active_users: members.length,
        active_agents: activeAgents,
        total_requests: totalRequests,
        provider_count: requestByProvider.length,
        audit_events: auditAll.length,
        budget_violations: budgetViolationsData.length,
        key_revocations: keyRevocations,
        failed_logins: 0, // Not yet collected
        cross_border_requests: crossBorder.reduce((s, r) => s + r.request_count, 0),
      },
    },

    access_control: {
      members: members.map(m => ({
        user_name: m.user_name,
        user_phone: m.user_phone,
        role: m.role,
        joined_at: m.joined_at,
      })),
      api_keys: apiKeys.map(k => ({
        name: k.name,
        key_type: k.key_type,
        key_preview: k.key_preview,
        revoked: k.revoked,
        last_used_at: k.last_used_at,
        binding_count: k.binding_count,
      })),
      role_changes: auditAll
        .filter(a => ['user.invited', 'user.joined', 'member.invited', 'member.removed'].includes(a.action))
        .map(formatAuditEntry),
    },

    audit_trail: {
      total_events: auditAll.length,
      action_distribution: buildActionDistribution(auditAll),
      timeline: auditAll.slice(0, 50).map(formatAuditEntry), // Top 50 most recent
    },

    data_flow: {
      by_provider: requestByProvider,
      by_agent: requestByAgent,
      cross_border: crossBorder.length > 0 ? {
        provider_count: crossBorder.length,
        request_count: crossBorder.reduce((s, r) => s + r.request_count, 0),
        total_tokens: crossBorder.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0),
        providers: crossBorder.map(r => r.provider),
        affected_agents: requestByAgent
          .filter(a => a.providers.some((p: string) => !DOMESTIC_PROVIDERS.has(p)))
          .map(a => a.agent_name),
        suggestion: '确认以上 Agent 向境外厂商发送的内容不包含个人信息或商业机密。如不需要境外模型，可选择解绑对应 Provider 或切换为境内替代模型。',
      } : null,
    },

    budget_control: {
      workspace_monthly_budget_yuan: centsToYuan(budgetData.monthly_budget_cents),
      workspace_daily_budget_yuan: centsToYuan(budgetData.daily_budget_cents),
      agent_budgets: budgetData.agent_budgets.map(a => ({
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        daily_token_limit: a.daily_token_limit,
        monthly_cost_limit_yuan: centsToYuan(a.monthly_cost_limit_cents),
      })),
      monthly_status: budgetData.monthly_budget_cents > 0 ? {
        budgeted_yuan: centsToYuan(budgetData.monthly_budget_cents),
        spent_yuan: centsToYuan(budgetData.monthly_spent_cents),
        percent: budgetData.monthly_percent,
        level: budgetData.monthly_percent >= 100 ? 'cutoff' :
               budgetData.monthly_percent >= 85 ? 'throttle' :
               budgetData.monthly_percent >= 70 ? 'warning' : 'normal',
      } : null,
      violations: budgetViolationsData,
      cost_trend: costTrend,
    },

    security_events: {
      failed_auth: 0,   // Not yet collected
      key_revocations: keyRevocations,
      invalid_key_attempts: 0,  // Not yet collected
      rate_limit_triggers: 0,   // Not yet collected
      provider_failovers: providerFailovers,
      budget_cutoffs: budgetCutoffs,
      notable_events: notableEvents,
    },

    model_governance: {
      active_models: modelUsage.map(m => ({
        ...m,
        risk_level: calcModelRisk(m.provider, m.capability),
      })),
      by_capability: buildCapabilitySummary(modelUsage),
    },

    recommendations,
  };

  return report;
}

// ── Query helpers ──

async function getWorkspace(workspaceId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, monthly_budget_cents, daily_budget_cents FROM workspaces WHERE id = ?',
    [workspaceId],
  );
  return rows[0] || null;
}

async function getMembers(workspaceId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.name as user_name, u.phone as user_phone,
            wm.role, wm.created_at as joined_at
     FROM workspace_members wm
     JOIN users u ON wm.user_id = u.id
     WHERE wm.workspace_id = ?
     ORDER BY FIELD(wm.role, 'owner', 'admin', 'member', 'viewer'), wm.created_at ASC`,
    [workspaceId],
  );
  return rows as any[];
}

async function getApiKeys(workspaceId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ak.name, ak.key_prefix as key_preview, ak.revoked,
            ak.last_used_at,
            COUNT(kpb.id) as binding_count,
            'api_key' as key_type
     FROM api_keys ak
     LEFT JOIN key_provider_bindings kpb ON ak.id = kpb.api_key_id AND kpb.enabled = 1
     WHERE ak.workspace_id = ?
     GROUP BY ak.id

     UNION ALL

     SELECT a.name, CONCAT('onellm_ag_', LEFT(a.id, 6)) as key_preview,
            0 as revoked,
            NULL as last_used_at,
            0 as binding_count,
            'agent_key' as key_type
     FROM agents a
     WHERE a.workspace_id = ? AND a.status = 'active'

     ORDER BY revoked ASC, last_used_at DESC`,
    [workspaceId, workspaceId],
  );
  return rows as any[];
}

async function getAuditLogs(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT al.*, u.name as user_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.workspace_id = ? AND al.created_at >= ? AND al.created_at <= ?
     ORDER BY al.created_at DESC`,
    [workspaceId, from, to],
  );
  return rows as any[];
}

async function getRequestByProvider(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rl.provider,
            COALESCE(MAX(mp.name_cn), rl.provider) as provider_name_cn,
            COUNT(*) as request_count,
            COALESCE(SUM(rl.tokens_in), 0) as tokens_in,
            COALESCE(SUM(rl.tokens_out), 0) as tokens_out,
            COALESCE(SUM(rl.cost_cents), 0) as cost_cents
     FROM request_logs rl
     LEFT JOIN model_providers mp ON mp.slug = rl.provider
     WHERE rl.workspace_id = ? AND rl.created_at >= ? AND rl.created_at <= ?
     GROUP BY rl.provider
     ORDER BY request_count DESC`,
    [workspaceId, from, to],
  );

  return (rows as any[]).map((r: any) => ({
    provider: r.provider,
    provider_name_cn: r.provider_name_cn || null,
    region: DOMESTIC_PROVIDERS.has(r.provider) ? 'china' as const : 'international' as const,
    request_count: Number(r.request_count),
    tokens_in: Number(r.tokens_in),
    tokens_out: Number(r.tokens_out),
    cost_yuan: centsToYuan(r.cost_cents),
  }));
}

async function getRequestByAgent(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rl.agent_id,
            COALESCE(a.name, rl.agent_id) as agent_name,
            COUNT(*) as request_count,
            GROUP_CONCAT(DISTINCT rl.provider ORDER BY rl.provider SEPARATOR ',') as providers
     FROM request_logs rl
     LEFT JOIN agents a ON rl.agent_id = a.id
     WHERE rl.workspace_id = ? AND rl.created_at >= ? AND rl.created_at <= ?
       AND rl.agent_id IS NOT NULL
     GROUP BY rl.agent_id
     ORDER BY request_count DESC`,
    [workspaceId, from, to],
  );

  return (rows as any[]).map((r: any) => ({
    agent_id: r.agent_id,
    agent_name: r.agent_name || r.agent_id,
    request_count: Number(r.request_count),
    providers: r.providers ? r.providers.split(',') : [],
  }));
}

async function getCostTrend(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as period,
            COUNT(*) as request_count,
            COALESCE(SUM(cost_cents), 0) as cost_cents
     FROM request_logs
     WHERE workspace_id = ? AND created_at >= ? AND created_at <= ?
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
     ORDER BY period ASC`,
    [workspaceId, from, to],
  );

  return (rows as any[]).map((r: any) => ({
    period: r.period,
    cost_yuan: centsToYuan(r.cost_cents),
    request_count: Number(r.request_count),
  }));
}

async function getBudgetSettings(workspaceId: string) {
  const [wsRows] = await pool.query<RowDataPacket[]>(
    'SELECT monthly_budget_cents, daily_budget_cents FROM workspaces WHERE id = ?',
    [workspaceId],
  );
  const ws = wsRows[0] || {};

  const [agentRows] = await pool.query<RowDataPacket[]>(
    `SELECT id as agent_id, name as agent_name,
            COALESCE(daily_token_limit, 0) as daily_token_limit,
            COALESCE(monthly_cost_limit_cents, 0) as monthly_cost_limit_cents
     FROM agents WHERE workspace_id = ? AND status = 'active'`,
    [workspaceId],
  );

  // Monthly spent
  const [spentRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(cost_cents), 0) as total
     FROM request_logs
     WHERE workspace_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`,
    [workspaceId],
  );

  const monthlyBudget = Number((ws as any).monthly_budget_cents) || 0;
  const monthlySpent = Number(spentRows[0]?.total) || 0;
  const percent = monthlyBudget > 0 ? Math.round((monthlySpent / monthlyBudget) * 100) : 0;

  return {
    monthly_budget_cents: monthlyBudget,
    daily_budget_cents: Number((ws as any).daily_budget_cents) || 0,
    monthly_spent_cents: monthlySpent,
    monthly_percent: percent,
    agent_budgets: (agentRows as any[]).map((a: any) => ({
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      daily_token_limit: Number(a.daily_token_limit),
      monthly_cost_limit_cents: Number(a.monthly_cost_limit_cents),
    })),
  };
}

async function getBudgetViolations(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT alert_type, threshold_percent, notified_at, resource_id
     FROM budget_alerts
     WHERE workspace_id = ? AND notified_at >= ? AND notified_at <= ?
     ORDER BY notified_at DESC`,
    [workspaceId, from, to],
  );
  return rows as any[];
}

async function getModelUsage(workspaceId: string, from: string, to: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rl.model, rl.provider,
            COUNT(*) as request_count,
            COALESCE(MAX(ms.name), rl.model) as model_name,
            COALESCE(MAX(mp.name_cn), rl.provider) as provider_name_cn,
            COALESCE(MAX(mse.slug), 'text-generation') as capability
     FROM request_logs rl
     LEFT JOIN model_specs ms ON ms.model_id = rl.model AND ms.workspace_id IS NULL
     LEFT JOIN model_providers mp ON mp.slug = rl.provider
     LEFT JOIN model_series mse ON ms.series_id = mse.id
     WHERE rl.workspace_id = ? AND rl.created_at >= ? AND rl.created_at <= ?
     GROUP BY rl.model, rl.provider
     ORDER BY request_count DESC`,
    [workspaceId, from, to],
  );

  return (rows as any[]).map((r: any) => ({
    model: r.model,
    model_name: r.model_name || r.model,
    provider: r.provider,
    provider_name_cn: r.provider_name_cn || null,
    capability: r.capability || 'text-generation',
    request_count: Number(r.request_count),
    region: DOMESTIC_PROVIDERS.has(r.provider) ? 'china' : 'international',
  }));
}

// ── Analysis helpers ──

function formatAuditEntry(a: any): AuditEntry {
  let details = {};
  try { details = typeof a.details === 'string' ? JSON.parse(a.details) : (a.details || {}); } catch {}
  return {
    timestamp: a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at),
    user_name: a.user_name || 'Unknown',
    action: a.action,
    action_label: ACTION_LABELS[a.action] || a.action,
    resource_type: a.resource_type,
    resource_name: null,
    details,
    ip_address: a.ip_address || null,
  };
}

function buildActionDistribution(auditLogs: any[]) {
  const map = new Map<string, number>();
  for (const a of auditLogs) {
    map.set(a.action, (map.get(a.action) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([action, count]) => ({ action, action_label: ACTION_LABELS[action] || action, count }))
    .sort((a, b) => b.count - a.count);
}

function buildNotableEvents(
  auditLogs: any[],
  providerData: any[],
  budgetViolations: any[],
): SecurityEvent[] {
  const events: SecurityEvent[] = [];

  // Key revocations
  const revocations = auditLogs.filter(a => a.action === 'key.revoked');
  for (const r of revocations) {
    events.push({
      timestamp: String(r.created_at),
      event_type: 'key_revoked',
      description: `${r.user_name || 'Unknown'} 吊销了 API Key`,
      severity: 'medium',
    });
  }

  // Budget cutoffs
  for (const v of budgetViolations) {
    if (v.alert_type.includes('100') || v.alert_type.includes('cutoff')) {
      events.push({
        timestamp: String(v.notified_at),
        event_type: 'budget_cutoff',
        description: `预算超限熔断：${v.alert_type}（阈值 ${v.threshold_percent}%）`,
        severity: 'high',
      });
    }
  }

  // Provider health (record any non-zero failover)
  // const failovers = providerData.filter((p: any) => p.fallback_attempts > 0);
  // Currently not tracked — placeholder for future

  return events.slice(0, 20);
}

function buildRecommendations(ctx: {
  workspace: any; members: any[]; apiKeys: any[]; auditAll: any[];
  requestByProvider: any[]; requestByAgent: any[]; costTrend: any[];
  budgetData: any; budgetViolationsData: any[]; modelUsage: any[];
  totalRequests: number; crossBorderCount: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // Check cross-border data flow
  if (ctx.crossBorderCount > 0) {
    recs.push({
      priority: 'medium',
      category: '数据出境',
      title: '检测到境外模型厂商调用',
      detail: `报告期内有 ${ctx.requestByProvider.filter(r => r.region !== 'china').length} 家境外厂商被调用，共 ${ctx.requestByProvider.filter(r => r.region !== 'china').reduce((s: number, r: any) => s + r.request_count, 0)} 次请求。`,
      suggestion: '评估数据传输风险，确认无个人信息出境。如不需要境外模型，可解绑对应 Provider 或切换到境内替代模型（如 DeepSeek / 通义 / 智谱）。',
    });
  }

  // Check no budget set
  if (ctx.budgetData.monthly_budget_cents === 0 && ctx.budgetData.daily_budget_cents === 0) {
    recs.push({
      priority: 'medium',
      category: '预算管控',
      title: '未设置 Workspace 预算上限',
      detail: '当前未设置月预算或日预算上限，存在账单失控风险。',
      suggestion: '建议在「预算控制」页面设置 Workspace 月预算上限，并为核心 Agent 配置 Token/费用子预算。',
    });
  }

  // Check no agent budget limits
  const agentsWithoutBudget = ctx.budgetData.agent_budgets.filter((a: any) =>
    a.daily_token_limit === 0 && a.monthly_cost_limit_cents === 0
  );
  if (agentsWithoutBudget.length > 0) {
    recs.push({
      priority: 'low',
      category: '预算管控',
      title: `${agentsWithoutBudget.length} 个 Agent 未设置子预算`,
      detail: agentsWithoutBudget.map((a: any) => a.agent_name).join('、') + ' 未配置 Token/费用限额。',
      suggestion: '为高风险 Agent 设置日 Token 上限和月费用上限。',
    });
  }

  // Check log retention — we can't actually check the policy, but we can warn
  recs.push({
    priority: 'high',
    category: '数据保留',
    title: '请求日志保留策略建议',
    detail: '当前平台日志保留策略由运维配置决定。等保三级要求日志保留 ≥ 180 天。',
    suggestion: '确认日志保留策略满足合规要求。建议配置自动归档至对象存储（OSS/S3），保留至少 180 天。',
  });

  // Check failed login tracking
  recs.push({
    priority: 'high',
    category: '安全审计',
    title: '缺少登录失败持久化记录',
    detail: '当前登录失败事件仅在内存中临时计数，服务重启后即丢失。无法提供"防暴力破解"的合规证据。',
    suggestion: '将登录失败事件持久化到数据库，以便在合规审计中提供完整的认证安全证据链。',
  });

  // Check revoked keys that still have bindings
  // (already handled by FK cascade, but worth noting)

  // Check if a single user has too many active keys
  if (ctx.apiKeys.filter((k: any) => !k.revoked).length > 20) {
    recs.push({
      priority: 'low',
      category: '密钥管理',
      title: '活跃 API Key 数量较多',
      detail: `当前有 ${ctx.apiKeys.filter((k: any) => !k.revoked).length} 个活跃 Key。`,
      suggestion: '定期审查并清理不再使用的 API Key，降低密钥泄露风险。',
    });
  }

  // Check if there are viewer-only members (who can see everything but change nothing — this is good)
  const viewers = ctx.members.filter((m: any) => m.role === 'viewer');
  if (ctx.members.length > 3 && viewers.length === 0) {
    recs.push({
      priority: 'low',
      category: '访问控制',
      title: '建议添加只读审计角色',
      detail: '当前所有成员均有写权限。对于需要查看合规报告但不应修改配置的审计人员，建议使用 Viewer 角色。',
      suggestion: '为合规/审计人员创建 Viewer 角色账号。',
    });
  }

  return recs;
}

function calcRating(ctx: { recommendations: Recommendation[]; budgetViolationsData: any[]; crossBorderCount: number }): 'green' | 'yellow' | 'red' {
  const hasHighRisk = ctx.recommendations.some(r => r.priority === 'high');
  const hasBudgetCutoff = ctx.budgetViolationsData.some((v: any) =>
    v.alert_type.includes('100') || v.alert_type.includes('cutoff'));
  if (hasBudgetCutoff) return 'red';
  if (hasHighRisk && ctx.crossBorderCount > 0) return 'yellow';
  if (hasHighRisk) return 'yellow';
  return 'green';
}

function calcModelRisk(provider: string, capability: string): 'low' | 'medium' | 'high' | 'critical' {
  const isDomestic = DOMESTIC_PROVIDERS.has(provider);
  const baseRisk = CAPABILITY_RISK_MAP[capability] || 'low';

  if (!isDomestic && baseRisk === 'high') return 'critical';
  if (!isDomestic && baseRisk === 'medium') return 'high';
  if (!isDomestic) return 'medium';
  return baseRisk;
}

function buildCapabilitySummary(modelUsage: any[]): CapabilityEntry[] {
  const map = new Map<string, { request_count: number; has_cross_border: boolean }>();
  for (const m of modelUsage) {
    const existing = map.get(m.capability) || { request_count: 0, has_cross_border: false };
    existing.request_count += m.request_count;
    if (m.region !== 'china') existing.has_cross_border = true;
    map.set(m.capability, existing);
  }
  return Array.from(map.entries()).map(([capability, data]) => ({
    capability,
    request_count: data.request_count,
    has_cross_border: data.has_cross_border,
  }));
}

import { centsToYuan } from '../utils/currency';

/**
 * Pricing Plans — Public API
 *
 * GET /api/v1/public/plans
 *
 * Returns the current pricing tiers. No auth required.
 * Data is config-driven — change this file to update pricing site-wide.
 *
 * IMPORTANT: The platform currently does NOT enforce plan limits.
 * Starter users get full access. This page sets expectations and anchors
 * the Pro price point. Enforcement will be added in a later phase.
 *
 * Tier logic:
 *   Starter = 单人全功能（核心能力完整，仅用量受限）
 *   Pro     = 团队全功能（Starter + 审计日志 + RBAC + 邮件支持 + 用量×20）
 *   Enterprise = 企业合规（Pro + SSO + SLA + 数据驻留 + 私有部署 + 二开）
 */

import { Router } from 'express';

export const plansRouter = Router();

// ── Plan definitions ──
// To change pricing/text, edit this object and redeploy admin-api.
// No frontend deploy needed.

const PLANS = {
  starter: {
    slug: 'starter',
    name: 'Starter',
    price: '免费',
    period: '',
    description: '个人开发者和小型项目，核心功能完整开放',
    popular: false,
    cta: '免费开始',
    cta_href: '/login',
    cta_style: 'outline',

    // ── 用量配额 ──
    monthly_requests: '10,000 次/月',
    rate_limit: '30 RPM',
    workspaces: 1,
    members: 1,
    agents: 3,
    api_keys: 5,
    log_retention: '7 天',

    features: {
      // ── 核心能力 ──
      unified_api:     { name: '统一 API 接入',        included: true,  value: '全部厂商' },
      model_catalog:   { name: '模型目录',              included: true,  value: '50+ 模型' },
      byok:            { name: 'BYOK 自带密钥',         included: true,  value: '✅' },
      smart_failover:  { name: '智能故障转移',          included: true,  value: '✅' },
      budget_control:  { name: '预算管控（三级熔断）',  included: true,  value: '✅' },
      cost_analytics:  { name: '成本分析面板',          included: true,  value: '✅' },
      agent_mgmt:      { name: 'Agent 管理',            included: true,  value: '3 个' },
      playground:      { name: '在线 Playground',       included: true,  value: '✅' },
      request_logs:    { name: '请求日志查询',          included: true,  value: '✅' },

      // ── 团队管控 — 单人不需要 ──
      rbac:            { name: 'RBAC 角色权限',         included: false, value: '—' },
      audit_log:       { name: '审计日志',              included: false, value: '—' },

      // ── 企业合规 — 大企业刚需 ──
      sso:             { name: 'SSO / SAML 单点登录',   included: false, value: '—' },
      sla:             { name: 'SLA 可用性保障',         included: false, value: '—' },
      data_residency:  { name: '数据驻留选择',          included: false, value: '—' },

      // ── 服务与部署 ──
      private_deploy:  { name: '私有化部署',            included: false, value: '—' },
      custom_dev:      { name: '定制二开',              included: false, value: '—' },
      support:         { name: '技术支持',              included: true,  value: '社区 / 文档' },
    },
  },

  pro: {
    slug: 'pro',
    name: 'Pro',
    price: '¥199',
    period: '/月',
    description: '中小团队规模化使用，加入团队管控与更高配额',
    popular: true,
    cta: '升级 Pro',
    cta_href: '/login',   // TODO: link to billing page when payment system is ready
    cta_style: 'primary',

    // ── 用量配额（Starter × 20）──
    monthly_requests: '200,000 次/月',
    rate_limit: '300 RPM',
    workspaces: 5,
    members: 10,
    agents: 20,
    api_keys: '无限制',
    log_retention: '30 天',

    features: {
      // ── 核心能力（同 Starter）──
      unified_api:     { name: '统一 API 接入',        included: true,  value: '全部厂商' },
      model_catalog:   { name: '模型目录',              included: true,  value: '全部模型' },
      byok:            { name: 'BYOK 自带密钥',         included: true,  value: '✅' },
      smart_failover:  { name: '智能故障转移',          included: true,  value: '✅' },
      budget_control:  { name: '预算管控（三级熔断）',  included: true,  value: '✅' },
      cost_analytics:  { name: '成本分析面板',          included: true,  value: '✅ + 导出' },
      agent_mgmt:      { name: 'Agent 管理',            included: true,  value: '20 个' },
      playground:      { name: '在线 Playground',       included: true,  value: '✅' },
      request_logs:    { name: '请求日志查询',          included: true,  value: '✅' },

      // ── 团队管控 ← Pro 的核心差异化价值 ──
      rbac:            { name: 'RBAC 角色权限',         included: true,  value: 'Owner / Member' },
      audit_log:       { name: '审计日志',              included: true,  value: '✅' },

      // ── 企业合规 — Pro 不需要 ──
      sso:             { name: 'SSO / SAML 单点登录',   included: false, value: '—' },
      sla:             { name: 'SLA 可用性保障',         included: false, value: '—' },
      data_residency:  { name: '数据驻留选择',          included: false, value: '—' },

      // ── 服务与部署 ──
      private_deploy:  { name: '私有化部署',            included: false, value: '—' },
      custom_dev:      { name: '定制二开',              included: false, value: '—' },
      support:         { name: '技术支持',              included: true,  value: '邮件工单（48h）' },
    },
  },

  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    price: '定制',
    period: '',
    description: '大型企业安全合规方案，全量功能 + 专属服务',
    popular: false,
    cta: '联系我们',
    cta_href: '/contact',
    cta_style: 'gradient',

    // ── 用量配额（无限制）──
    monthly_requests: '无限制',
    rate_limit: '可定制',
    workspaces: '无限制',
    members: '无限制',
    agents: '无限制',
    api_keys: '无限制',
    log_retention: '180 天（可配置）',

    features: {
      // ── 核心能力（全量 + 增强）──
      unified_api:     { name: '统一 API 接入',        included: true,  value: '全部厂商' },
      model_catalog:   { name: '模型目录',              included: true,  value: '全部模型 + 自建' },
      byok:            { name: 'BYOK 自带密钥',         included: true,  value: '✅ + 自动轮换' },
      smart_failover:  { name: '智能故障转移',          included: true,  value: '✅ + 自定义策略' },
      budget_control:  { name: '预算管控（三级熔断）',  included: true,  value: '✅ + 自定义阈值' },
      cost_analytics:  { name: '成本分析面板',          included: true,  value: '✅ + 导出 + API' },
      agent_mgmt:      { name: 'Agent 管理',            included: true,  value: '无限制' },
      playground:      { name: '在线 Playground',       included: true,  value: '✅' },
      request_logs:    { name: '请求日志查询',          included: true,  value: '✅' },

      // ── 团队管控（完整版）──
      rbac:            { name: 'RBAC 角色权限',         included: true,  value: '4 级权限 + 自定义' },
      audit_log:       { name: '审计日志',              included: true,  value: '全量加密存储' },

      // ── 企业合规 ──
      sso:             { name: 'SSO / SAML 单点登录',   included: true,  value: 'SAML / OIDC' },
      sla:             { name: 'SLA 可用性保障',         included: true,  value: '99.5%' },
      data_residency:  { name: '数据驻留选择',          included: true,  value: 'EU / APAC' },

      // ── 服务与部署 ──
      private_deploy:  { name: '私有化部署',            included: true,  value: 'VPC / 混合云' },
      custom_dev:      { name: '定制二开',              included: true,  value: '✅' },
      support:         { name: '技术支持',              included: true,  value: '专属工程师 + 企微' },
    },
  },
};

// ── Route ──

plansRouter.get('/', (_req, res) => {
  res.json({ status: 'success', data: Object.values(PLANS) });
});

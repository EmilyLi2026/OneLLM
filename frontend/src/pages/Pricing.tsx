import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, ArrowUpRight, Loader2 } from 'lucide-react'

// ── Types ──

interface PlanFeature {
  name: string
  included: boolean
  value: string
}

interface Plan {
  slug: string
  name: string
  price: string
  period: string
  description: string
  popular: boolean
  cta: string
  cta_href: string
  cta_style: 'outline' | 'primary' | 'gradient'
  monthly_requests: string
  rate_limit: string
  workspaces: number | string
  members: number | string
  agents: number | string
  api_keys: number | string
  log_retention: string
  features: Record<string, PlanFeature>
}

// ── Feature group display order ──

const FEATURE_GROUPS: { label: string; keys: string[]; hint?: string }[] = [
  {
    label: '用量配额',
    keys: ['monthly_requests', 'rate_limit', 'workspaces', 'members', 'agents', 'api_keys', 'log_retention'],
  },
  {
    label: '核心能力',
    keys: ['unified_api', 'model_catalog', 'byok', 'smart_failover', 'budget_control', 'cost_analytics', 'agent_mgmt', 'request_logs', 'playground'],
    hint: '所有版本功能一致，仅量不同',
  },
  {
    label: '团队管控',
    keys: ['rbac', 'audit_log'],
    hint: '多人协作的问责与权限',
  },
  {
    label: '企业合规',
    keys: ['sso', 'sla', 'data_residency'],
  },
  {
    label: '服务与部署',
    keys: ['private_deploy', 'custom_dev', 'support'],
  },
]

// ── CTA style map ──

const ctaStyles: Record<string, string> = {
  outline: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
  primary: 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm shadow-blue-200',
  gradient: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-indigo-200',
}

// ── Quantity rows (top section of each card) ──

const QUANTITY_KEYS = ['monthly_requests', 'rate_limit', 'workspaces', 'members', 'agents', 'api_keys', 'log_retention']

const QUANTITY_LABELS: Record<string, string> = {
  monthly_requests: '月请求量',
  rate_limit: '请求速率',
  workspaces: '工作区',
  members: '团队成员',
  agents: 'Agent 数量',
  api_keys: 'API Key 数量',
  log_retention: '日志保留',
}

// ── Component ──

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/v1/public/plans')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (json.status === 'success' && Array.isArray(json.data)) {
          setPlans(json.data)
        } else {
          throw new Error('Unexpected response format')
        }
      })
      .catch((err) => {
        console.error('Failed to load pricing plans', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-gray-400 text-sm">加载定价方案...</span>
      </div>
    )
  }

  // ── Error state ──
  if (error || plans.length === 0) {
    return (
      <div className="max-w-6xl mx-auto text-center py-32">
        <p className="text-gray-400 mb-4">定价信息暂时无法加载</p>
        <Link to="/contact" className="text-blue-500 hover:text-blue-600 text-sm font-medium">
          联系我们了解方案 →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">价格</h1>
        <p className="text-gray-400">选择适合你团队的方案。按团队规模递进：个人 → 团队 → 企业。</p>
      </div>

      {/* ==================== PLAN CARDS ==================== */}
      <section className="mb-12">
        <div className="grid grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className={`rounded-2xl bg-white border shadow-sm overflow-hidden relative flex flex-col ${
                plan.popular ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <div className="px-3 py-1 text-[11px] font-bold text-white bg-blue-500 rounded-bl-xl">
                    最受欢迎
                  </div>
                </div>
              )}

              {/* ── Header ── */}
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-gray-900 tracking-tight">{plan.price}</span>
                  {plan.period && <span className="text-gray-400 text-sm">{plan.period}</span>}
                </div>
                <p className="text-gray-400 text-xs leading-relaxed mb-5">{plan.description}</p>
                {plan.cta_href.startsWith('/') ? (
                  <Link
                    to={plan.cta_href}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all inline-block text-center ${ctaStyles[plan.cta_style]}`}
                  >
                    {plan.cta} <ArrowUpRight className="inline w-3.5 h-3.5 ml-1" strokeWidth={1.5} />
                  </Link>
                ) : (
                  <a
                    href={plan.cta_href}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all inline-block text-center ${ctaStyles[plan.cta_style]}`}
                  >
                    {plan.cta} <ArrowUpRight className="inline w-3.5 h-3.5 ml-1" strokeWidth={1.5} />
                  </a>
                )}
              </div>

              {/* ── Quantity limits ── */}
              <div className="px-6 pt-5 pb-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">用量配额</p>
                <div className="space-y-2.5">
                  {QUANTITY_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{QUANTITY_LABELS[key] || key}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {(plan as any)[key] ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Feature checklist ── */}
              <div className="p-6 pt-3 flex-1">
                {/* Only render feature groups (skip the quantity group) */}
                {FEATURE_GROUPS.filter((g) => g.label !== '用量配额').map((group) => {
                  const groupFeatures = group.keys
                    .map((k) => plan.features[k])
                    .filter(Boolean)
                  if (groupFeatures.length === 0) return null
                  return (
                    <div key={group.label} className="mb-4 last:mb-0">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                        {group.label}
                      </p>
                      <div className="space-y-2.5">
                        {groupFeatures.map((f) => (
                          <div key={f.name} className="flex items-center gap-3 text-sm">
                            {f.included ? (
                              <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={2} />
                            ) : (
                              <X className="w-4 h-4 text-gray-200 shrink-0" strokeWidth={2} />
                            )}
                            <span className="text-gray-400 flex-1">{f.name}</span>
                            <span
                              className={`text-xs font-medium ${f.included ? 'text-gray-600' : 'text-gray-300'}`}
                            >
                              {f.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== BOTTOM NOTE ==================== */}
      <section className="mb-8 p-6 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Starter 免费全功能开放</span>
          <span className="text-blue-500 mx-2">—</span>
          核心能力（统一接入、智能路由、预算管控、成本分析）三个版本完全一致。
          Pro 额外提供团队管控（RBAC + 审计日志），Enterprise 增加企业合规能力。
          当前阶段平台不做强制限制，欢迎体验全部功能。
        </p>
      </section>
    </div>
  )
}

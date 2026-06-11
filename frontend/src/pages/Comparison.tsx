import { Link } from 'react-router-dom'
import { Check, Minus, X, ArrowRight, Info } from 'lucide-react'

// ── Comparison data ──

interface CompareRow {
  feature: string
  category: string
  onellm: boolean | string
  oneapi: boolean | string
  litellm: boolean | string
}

const rows: CompareRow[] = [
  // ── 接入能力 ──
  { category: '接入能力', feature: '国产厂商适配', onellm: '14家原生适配', oneapi: '部分（需自行配置渠道）', litellm: '有限（以国际为主）' },
  { category: '接入能力', feature: '国际厂商接入', onellm: '以国产为主（可扩展）', oneapi: '取决于渠道配置', litellm: '100+' },
  { category: '接入能力', feature: 'OpenAI 兼容 API', onellm: true, oneapi: true, litellm: true },
  { category: '接入能力', feature: '厂商 API Key 加密存储', onellm: 'AES-256-GCM', oneapi: '基础加密', litellm: '基础加密或 Vault' },
  { category: '接入能力', feature: '模型目录（预置规格+定价）', onellm: '120+个系统内置', oneapi: false, litellm: '部分（依赖 models 库）' },
  { category: '接入能力', feature: '新模型自动发现', onellm: 'OpenRouter 同步', oneapi: false, litellm: false },

  // ── 路由与容灾 ──
  { category: '路由与容灾', feature: '多 Provider 绑定 (1 Key → N Provider)', onellm: true, oneapi: false, litellm: false },
  { category: '路由与容灾', feature: '按 model 自动路由', onellm: true, oneapi: false, litellm: '部分（需配置 router）' },
  { category: '路由与容灾', feature: '智能故障转移 (Smart Failover)', onellm: '优先级自动切换', oneapi: false, litellm: true },
  { category: '路由与容灾', feature: '负载均衡 (加权分发)', onellm: '规划中', oneapi: false, litellm: true },
  { category: '路由与容灾', feature: '请求重试 (自动 Retry)', onellm: true, oneapi: false, litellm: true },
  { category: '路由与容灾', feature: '语义缓存 (Semantic Cache)', onellm: '规划中', oneapi: false, litellm: true },

  // ── 成本管控 ──
  { category: '成本管控', feature: '多级预算体系', onellm: '3级 (WS→Key/Agent→Provider)', oneapi: false, litellm: '1级 (Team/Key budget)' },
  { category: '成本管控', feature: '预算预警 (70%)', onellm: true, oneapi: false, litellm: false },
  { category: '成本管控', feature: '自动限流 (85%)', onellm: 'RPM 自动减半', oneapi: false, litellm: false },
  { category: '成本管控', feature: '硬熔断 (100% → 402)', onellm: true, oneapi: false, litellm: '仅 soft limit' },
  { category: '成本管控', feature: '按 Agent 的子预算', onellm: true, oneapi: false, litellm: false },
  { category: '成本管控', feature: 'Token 实时计费', onellm: true, oneapi: false, litellm: true },

  // ── 可观测性 ──
  { category: '可观测性', feature: '全链路请求日志', onellm: true, oneapi: false, litellm: true },
  { category: '可观测性', feature: 'Agent Session 级追踪', onellm: true, oneapi: false, litellm: false },
  { category: '可观测性', feature: '成本分析 Dashboard', onellm: '图表+多维度', oneapi: false, litellm: 'Litellm UI 有基础' },
  { category: '可观测性', feature: '审计日志（不可删除）', onellm: true, oneapi: false, litellm: false },
  { category: '可观测性', feature: 'Web 管理控制台', onellm: '完整管理后台', oneapi: '基础控制台', litellm: 'Admin UI' },

  // ── 企业治理 ──
  { category: '企业治理', feature: '多租户 (Workspace)', onellm: true, oneapi: false, litellm: 'Team/Org' },
  { category: '企业治理', feature: 'RBAC 角色权限', onellm: '4级 (Owner/Admin/Member/Viewer)', oneapi: false, litellm: '基础角色' },
  { category: '企业治理', feature: 'SSO 单点登录', onellm: '规划中', oneapi: false, litellm: 'Enterprise' },
  { category: '企业治理', feature: '邀请码机制', onellm: true, oneapi: false, litellm: false },

  // ── Agent 能力 ──
  { category: 'Agent 能力', feature: 'Agent 专属 API Key', onellm: true, oneapi: false, litellm: false },
  { category: 'Agent 能力', feature: 'Agent 身份体系', onellm: '规划中', oneapi: false, litellm: false },
  { category: 'Agent 能力', feature: 'MCP Gateway', onellm: '规划中', oneapi: false, litellm: 'Beta (Portkey 原版)' },
  { category: 'Agent 能力', feature: '死循环检测', onellm: '规划中', oneapi: false, litellm: false },
  { category: 'Agent 能力', feature: '执行分级管控', onellm: '规划中', oneapi: false, litellm: false },

  // ── 部署与生态 ──
  { category: '部署与生态', feature: '开源协议', onellm: 'MIT', oneapi: 'MIT', litellm: 'MIT' },
  { category: '部署与生态', feature: 'Docker 部署', onellm: true, oneapi: true, litellm: true },
  { category: '部署与生态', feature: '私有化部署', onellm: true, oneapi: true, litellm: true },
  { category: '部署与生态', feature: 'Node.js / Python SDK', onellm: '兼容 OpenAI SDK', oneapi: '不支持 SDK', litellm: 'Python SDK' },
  { category: '部署与生态', feature: '技术栈', onellm: 'TypeScript + React', oneapi: 'Go + React', litellm: 'Python' },
]

const categories = [...new Set(rows.map(r => r.category))]

function renderCell(value: boolean | string) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500" strokeWidth={2} />
  if (value === false) return <X className="w-4 h-4 text-gray-200" strokeWidth={2} />
  if (value === '规划中') return <span className="text-xs text-amber-500 font-medium">{value}</span>
  return <span className="text-xs text-gray-600">{value}</span>
}

export default function Comparison() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">竞品对比</h1>
        <p className="text-gray-500 max-w-3xl">
          客观对比 OneLLM 与 OneAPI、LiteLLM 在 AI 网关核心能力上的差异。
          数据基于各产品公开文档与源码，截至 2026 年 6 月。
        </p>
      </section>

      {/* Quick Summary Cards */}
      <section className="grid grid-cols-3 gap-4 mb-10">
        {[
          {
            name: 'OneLLM',
            tagline: '国产厂商深度覆盖 + 企业管控',
            strengths: ['14家国产原生适配', '3级预算熔断', 'Agent Session 追踪', 'Web 管理控制台'],
            color: 'blue',
          },
          {
            name: 'OneAPI',
            tagline: '轻量级多模型转发',
            strengths: ['部署简单 (Go 单二进制)', '渠道管理灵活', '社区活跃', '消费明细记录'],
            color: 'gray',
          },
          {
            name: 'LiteLLM',
            tagline: 'Python 生态 AI 网关',
            strengths: ['100+ Provider 支持', 'Python 原生集成', '负载均衡+Fallback', 'LangChain 深度绑定'],
            color: 'gray',
          },
        ].map(({ name, tagline, strengths, color }) => (
          <div key={name} className={`p-6 rounded-2xl bg-white border shadow-sm ${name === 'OneLLM' ? 'border-blue-200 ring-2 ring-blue-50' : 'border-gray-100'}`}>
            <h3 className={`text-lg font-bold mb-1 tracking-tight ${name === 'OneLLM' ? 'text-blue-600' : 'text-gray-900'}`}>
              {name}
            </h3>
            <p className="text-xs text-gray-400 mb-4">{tagline}</p>
            <ul className="space-y-1.5">
              {strengths.map(s => (
                <li key={s} className="flex items-start gap-1.5 text-xs text-gray-600">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Detailed Comparison Table */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 tracking-tight">功能逐项对比</h2>

        {categories.map(cat => {
          const catRows = rows.filter(r => r.category === cat)
          return (
            <div key={cat} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">{cat}</h3>
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="text-left py-3 px-5 font-medium text-gray-500 w-[28%]">功能</th>
                      <th className="text-center py-3 px-4 font-medium text-blue-600 bg-blue-50/50 w-[24%]">OneLLM</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500 w-[24%]">OneAPI</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500 w-[24%]">LiteLLM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catRows.map((row, i) => (
                      <tr key={row.feature} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="py-3 px-5 text-gray-700 font-medium">{row.feature}</td>
                        <td className="py-3 px-4 text-center bg-blue-50/20">{renderCell(row.onellm)}</td>
                        <td className="py-3 px-4 text-center">{renderCell(row.oneapi)}</td>
                        <td className="py-3 px-4 text-center">{renderCell(row.litellm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </section>

      {/* Verdict */}
      <section className="mb-12">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-gray-50 to-white border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">选型建议</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
              <h3 className="text-blue-600 font-bold mb-2">选 OneLLM 如果你</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>· 主要使用国产模型（DeepSeek/阿里/智谱等）</li>
                <li>· 需要严格预算熔断防账单失控</li>
                <li>· 需要多租户 + RBAC 企业级管理</li>
                <li>· 关注 Agent 调用链路追踪</li>
                <li>· 需要 Web 管理控制台开箱即用</li>
              </ul>
            </div>
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
              <h3 className="text-gray-700 font-bold mb-2">选 OneAPI 如果你</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>· 需要极简部署（单 Go 二进制）</li>
                <li>· 团队没有复杂企业管控需求</li>
                <li>· 只需要基础的渠道管理+转发</li>
                <li>· 偏好 Go 生态</li>
              </ul>
            </div>
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
              <h3 className="text-gray-700 font-bold mb-2">选 LiteLLM 如果你</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>· 主要使用国际模型 (OpenAI/Anthropic等)</li>
                <li>· 深度使用 LangChain/LlamaIndex 生态</li>
                <li>· 需要 Python 原生 SDK 和 Callback</li>
                <li>· 团队以 Python 为主要技术栈</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8 p-10 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-center shadow-lg shadow-blue-200">
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          想深入了解 OneLLM 如何满足你的场景？
        </h2>
        <p className="text-blue-100 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
          预约产品演示，我们根据你的具体需求做针对性讲解。
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-sm"
        >
          预约演示 <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  )
}

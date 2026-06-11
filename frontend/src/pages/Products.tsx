import { Link } from 'react-router-dom'
import {
  Route, Shield, BarChart3, Cpu, ArrowRight, Server, Key, Eye, Wallet,
  Activity, FileSearch, AlertTriangle, Zap, Layers, Shuffle, Clock, Bot, Plug,
} from 'lucide-react'

const products = [
  {
    id: 'gateway',
    icon: Server,
    title: '统一接入',
    subtitle: '15+ 家国产厂商 · OpenAI 兼容 · 密钥加密',
    color: 'blue',
    desc: '一个 API Key 统一接入 15+ 家国产大模型厂商。支持 DeepSeek、阿里云、智谱、月之暗面、MiniMax、百度、字节、讯飞、百川、腾讯混元、零一万物、阶跃星辰、硅基流动、OpenRouter。标准 OpenAI 兼容 API，零代码切换。',
    highlights: [
      { icon: Server, text: '15+ 家国产厂商全覆盖，OpenAI 兼容 API' },
      { icon: Shield, text: 'AES-256-GCM 加密存储，仅网关内网解密转发' },
      { icon: Key, text: 'API Key 绑定多 Provider (1:N)，灵活扩展' },
      { icon: Layers, text: '流式/非流式请求代理，全协议支持' },
    ],
  },
  {
    id: 'routing',
    icon: Route,
    title: '智能路由',
    subtitle: '自动故障转移 · 优先级调度 · 负载均衡',
    color: 'indigo',
    desc: '请求自动路由到最优 Provider，支持按 priority_order 优先级调度。首选 Provider 返回 5xx/网络异常时，毫秒级自动 Fallback 到备用 Binding，对上游业务完全透明，保障零中断。',
    highlights: [
      { icon: Shuffle, text: '智能路由：根据请求 model 自动匹配最优 Provider' },
      { icon: Route, text: '多级 Fallback：按 priority_order 自动切换，业务无感' },
      { icon: Activity, text: '预算感知调度：自动跳过预算耗尽的 Binding' },
      { icon: Zap, text: '可扩展：预留加权负载均衡、语义缓存能力' },
    ],
  },
  {
    id: 'budget',
    icon: Shield,
    title: '预算管控',
    subtitle: '三级递进 · 硬熔断 · 防账单失控',
    color: 'amber',
    desc: '从 Workspace → Key（Agent）→ Provider 三层预算体系，70% 预警通知、85% 自动限流、100% 硬熔断返回 402，有效防止 Agent 循环调用导致的账单失控。',
    highlights: [
      { icon: AlertTriangle, text: '三级递进：预警(70%) → 限流(85%) → 熔断(100%)' },
      { icon: Wallet, text: '日预算 + 月预算双维度控制，支持自动重置' },
      { icon: BarChart3, text: '预算分析面板：实时百分比、预测、告警记录' },
      { icon: Eye, text: 'Agent Token 限额 + 月花费上限，双重兜底' },
    ],
  },
  {
    id: 'observability',
    icon: BarChart3,
    title: '全链路可观测',
    subtitle: '成本归因 · Session 追踪 · Agent 可视化',
    color: 'emerald',
    desc: '每一次 LLM 调用都记录完整信息：Token 消耗、花费（分）、延迟、状态码。支持按模型/Provider/Agent 多维度分析，按 Session 组织会话级追踪。',
    highlights: [
      { icon: Activity, text: '实时 Dashboard：花费趋势、模型TOP5、成功率' },
      { icon: FileSearch, text: '请求日志：agent_id、session_id、action_label、turn 追踪' },
      { icon: BarChart3, text: '成本分析：按模型/Provider/Agent 分组 + 排序表格' },
      { icon: Eye, text: '审计日志：全部管理操作记录，不可删除、不可篡改' },
    ],
  },
  {
    id: 'catalog',
    icon: Cpu,
    title: '模型目录',
    subtitle: '120+ 系统模型 · 14 家国产厂商 · 自动发现',
    color: 'purple',
    desc: '系统内置 15+ 家国产厂商、120+ 个模型规格，含上下文窗口、最大输出、输入/输出定价、能力标签。对接 OpenRouter 公开数据源，自动发现新上线的国产模型。',
    highlights: [
      { icon: Cpu, text: '14 家国产厂商全覆盖：DeepSeek/阿里/智谱/MiniMax/百度...' },
      { icon: Layers, text: '10 种能力类型：文本生成/推理/视觉/图像/视频/音频/嵌入/代码...' },
      { icon: Zap, text: 'OpenRouter 自动发现新模型 + 内存缓存 1h' },
      { icon: Activity, text: '用户可自建模型规格，灵活扩展' },
    ],
  },
]

const upcomingProducts = [
  {
    id: 'mcp-gateway',
    icon: Plug,
    title: 'MCP Gateway',
    subtitle: 'M3 · 第 11-14 周',
    desc: '为 Agent 提供安全的工具调用入口。支持 MCP Server 注册与发现、工具语义过滤、工具级 ACL 权限控制，让 Agent 在多工具场景下安全可控地执行操作。',
    highlights: [
      { icon: Plug, text: 'MCP Server 注册与自动发现' },
      { icon: FileSearch, text: '工具语义过滤：按任务自动筛选可用工具集' },
      { icon: Shield, text: '工具级 ACL 权限控制，细粒度访问管理' },
    ],
  },
  {
    id: 'agent-control-plane',
    icon: Bot,
    title: 'Agent 控制平面',
    subtitle: 'M4 · 第 15-18 周',
    desc: '从网关升级为 Agent 控制平面。建立 Agent 身份体系与委托链追溯，配合 Token 预算硬熔断、死循环检测、执行分级管控，让 Agent 跑得稳、算得清、可审计。',
    highlights: [
      { icon: Key, text: 'Agent 身份体系 + 委托链追溯' },
      { icon: AlertTriangle, text: 'Token 预算硬熔断：防止失控消费' },
      { icon: Activity, text: '死循环检测 + 执行分级管控' },
    ],
  },
]

const colorMap: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-200', gradient: 'from-blue-500 to-blue-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-500', border: 'border-indigo-200', gradient: 'from-indigo-500 to-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-500', border: 'border-amber-200', gradient: 'from-amber-500 to-orange-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500', border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 to-indigo-600' },
}

export default function Products() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <section className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">产品矩阵</h1>
        <p className="text-gray-500 max-w-2xl">
          OneLLM 由五个核心模块组成，覆盖从统一接入、智能路由、预算管控、可观测性到模型管理的完整链路。
        </p>
      </section>

      {/* Product Modules */}
      <div className="space-y-12 mb-12">
        {products.map((product) => {
          const c = colorMap[product.color]
          return (
            <section key={product.id} className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className={`p-8 bg-gradient-to-r ${c.gradient} text-white`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <product.icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{product.title}</h2>
                    <p className="text-sm opacity-80">{product.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed opacity-90 max-w-3xl">{product.desc}</p>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-4">
                  {product.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                        <h.icon className={`w-4 h-4 ${c.text}`} strokeWidth={1.5} />
                      </div>
                      <span className="text-sm text-gray-600 pt-1 leading-relaxed">{h.text}</span>
                    </div>
                  ))}
                </div>
                {product.id === 'catalog' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 text-right">
                    <Link to="/models" className="text-sm text-purple-500 hover:text-purple-600 font-medium inline-flex items-center gap-1">
                      浏览完整模型目录 <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* ==================== 规划中 ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 tracking-tight">规划中</h2>
        <p className="text-sm text-gray-400 mb-6">以下模块正在开发中，将在后续里程碑交付。</p>
        <div className="space-y-6">
          {upcomingProducts.map((product) => (
            <section key={product.id} className="rounded-3xl bg-white border border-dashed border-gray-200 shadow-sm overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-gray-400 to-gray-500 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <product.icon className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{product.title}</h2>
                    <p className="text-sm opacity-80 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {product.subtitle}
                    </p>
                  </div>
                  <span className="ml-auto px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    规划中
                  </span>
                </div>
                <p className="text-sm leading-relaxed opacity-90 max-w-3xl">{product.desc}</p>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-4">
                  {product.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <h.icon className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      </div>
                      <span className="text-sm text-gray-500 pt-1 leading-relaxed">{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mb-8 p-10 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 text-center shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          想要更深入地了解某个模块？
        </h2>
        <p className="text-gray-400 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
          预约产品演示，我们的解决方案工程师将为你做详细的场景化讲解。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors shadow-sm"
          >
            预约演示 <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
          >
            查看定价
          </Link>
        </div>
      </section>
    </div>
  )
}

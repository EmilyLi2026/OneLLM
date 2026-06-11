import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  Box,
  Puzzle,
  Brain,
  Workflow,
  Globe,
  Cpu,
  Layers,
  Terminal,
  Bot,
  Zap,
  MessageSquare,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// OneLLM 自有 SDK
// ────────────────────────────────────────────────────────────
const ownSdks = [
  {
    name: 'aihub-node',
    label: 'Node.js SDK',
    icon: Terminal,
    bg: 'bg-emerald-50 text-emerald-600',
    desc: '在 Node.js / TypeScript 项目中使用 OneLLM。内置 LangChain callback、Vercel AI SDK provider、OpenTelemetry 插桩。',
    install: 'npm install @ai-hub/node',
    docs: '/docs#nodejs-sdk',
    status: 'supported' as const,
  },
  {
    name: 'aihub-python',
    label: 'Python SDK',
    icon: Bot,
    bg: 'bg-blue-50 text-blue-600',
    desc: '在 Python 项目中使用 OneLLM。内置 LangChain / CrewAI / LlamaIndex / ADK / Strands 等多框架适配。',
    install: 'pip install aihub',
    docs: '/docs#python-sdk',
    status: 'supported' as const,
  },
]

// ────────────────────────────────────────────────────────────
// 框架 & 平台兼容
// ────────────────────────────────────────────────────────────
type IntegrationStatus = 'supported' | 'doc-only' | 'in-progress'

interface FrameworkIntegration {
  name: string
  icon: React.FC<{ className?: string; strokeWidth?: number }>
  type: 'SDK' | '框架' | '平台'
  desc: string
  docAnchor: string
  status: IntegrationStatus
}

const frameworkIntegrations: FrameworkIntegration[] = [
  {
    name: 'OpenAI SDK',
    icon: Cpu,
    type: 'SDK',
    desc: '使用 OpenAI 官方 Node.js / Python SDK，仅修改 baseURL 即可接入 OneLLM 网关。支持 Chat、Embedding、Image、Audio 全部接口。',
    docAnchor: '/docs#openai-sdk',
    status: 'supported',
  },
  {
    name: 'LangChain',
    icon: Workflow,
    type: '框架',
    desc: 'Python SDK 内置 Callback Handler + LLM/Chat 模型包装器；Node.js SDK 提供 LangChain.js callback。全功能覆盖。',
    docAnchor: '/docs#langchain',
    status: 'supported',
  },
  {
    name: 'CrewAI',
    icon: Puzzle,
    type: '框架',
    desc: 'Python SDK 内置 OpenTelemetry 自动插桩，自动追踪 Crew.kickoff、Agent.execute_task 等全部调用。',
    docAnchor: '/docs#crewai',
    status: 'supported',
  },
  {
    name: 'LlamaIndex',
    icon: Layers,
    type: '框架',
    desc: 'Python SDK 内置 LlamaIndex Callback Handler，自动记录索引查询、检索和 LLM 调用。',
    docAnchor: '/docs#llamaindex',
    status: 'supported',
  },
  {
    name: 'Dify',
    icon: Box,
    type: '平台',
    desc: '在 Dify 中将 OneLLM 配置为 OpenAI-API-compatible 模型供应商，即可使用 120+ 模型。',
    docAnchor: '/docs#dify',
    status: 'supported',
  },
  {
    name: '扣子 (Coze)',
    icon: MessageSquare,
    type: '平台',
    desc: '扣子用户通过自定义模型接入 OneLLM，获取对国产模型的深度选择能力。',
    docAnchor: '/docs#coze',
    status: 'supported',
  },
  {
    name: 'Vercel AI SDK',
    icon: Zap,
    type: 'SDK',
    desc: 'Node.js SDK 内置 Vercel AI SDK custom provider，一行代码接入 Next.js / SvelteKit 等 AI 应用。',
    docAnchor: '/docs#vercel-ai-sdk',
    status: 'doc-only',
  },
  {
    name: 'LiteLLM',
    icon: Globe,
    type: '框架',
    desc: 'Python SDK 内置 LiteLLM OpenTelemetry 插桩，支持 completion、embedding、image_generation 等全接口追踪。',
    docAnchor: '/docs#litellm',
    status: 'supported',
  },
  {
    name: 'Google ADK',
    icon: Brain,
    type: '框架',
    desc: 'Python SDK 内置 PortkeyAdk adapter，将 ADK 请求映射到 OneLLM 网关，支持 streaming 与 tool calling。',
    docAnchor: '/docs#adk',
    status: 'supported',
  },
]


// ────────────────────────────────────────────────────────────
// 状态标签
// ────────────────────────────────────────────────────────────
const statusConfig: Record<IntegrationStatus, { label: string; className: string }> = {
  'supported': { label: '已支持', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  'doc-only': { label: '文档完善中', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  'in-progress': { label: '开发中', className: 'bg-gray-50 text-gray-500 border-gray-200' },
}

// ────────────────────────────────────────────────────────────
// 页面组件
// ────────────────────────────────────────────────────────────
export default function Integrations() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* ==================== Header ==================== */}
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">生态集成</h1>
        <p className="text-gray-500 max-w-2xl">
          OneLLM 兼容 OpenAI API 标准，提供官方 Node.js 与 Python SDK，内置主流 AI 框架的 Callback / Instrumentation / Adapter。
          只需一行代码接入，无需学习新 API。
        </p>
      </section>

      {/* ==================== 自有 SDK ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 tracking-tight">OneLLM 官方 SDK</h2>
        <p className="text-sm text-gray-400 mb-5">推荐使用官方 SDK 以获得框架集成、自动追踪和最佳性能。</p>
        <div className="grid grid-cols-2 gap-4">
          {ownSdks.map((sdk) => (
            <div key={sdk.name} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${sdk.bg}`}>
                  <sdk.icon className="w-5.5 h-5.5" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-gray-900 font-semibold">{sdk.label}</h3>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded border font-medium ${statusConfig[sdk.status].className}`}>
                      {statusConfig[sdk.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-3">{sdk.desc}</p>
                  <div className="flex items-center gap-3">
                    <code className="px-2.5 py-1 rounded-lg bg-gray-50 text-xs text-gray-500 font-mono border border-gray-100">
                      {sdk.install}
                    </code>
                    <Link
                      to={sdk.docs}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 shrink-0"
                    >
                      接入指南 <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 框架 & 平台兼容 ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 tracking-tight">框架 & 平台兼容</h2>
        <p className="text-sm text-gray-400 mb-5">
          以下框架和平台均可直接与 OneLLM 集成。点击「配置指南」查看详细教程。
        </p>
        <div className="grid grid-cols-3 gap-3">
          {frameworkIntegrations.map((fw) => (
            <Link
              key={fw.name}
              to={fw.docAnchor}
              className="group p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                  <fw.icon className="w-4 h-4 text-gray-500 group-hover:text-blue-500 transition-colors" strokeWidth={1.5} />
                </div>
                <h3 className="text-gray-900 font-semibold text-sm">{fw.name}</h3>
                <span className={`px-1.5 py-0.5 text-[10px] rounded border font-medium ml-auto ${statusConfig[fw.status].className}`}>
                  {statusConfig[fw.status].label}
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mb-2.5">{fw.desc}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-300 group-hover:text-blue-500 transition-colors">
                <BookOpen className="w-3 h-3" strokeWidth={1.5} />
                <span>配置指南</span>
                <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
              </div>
            </Link>
          ))}
        </div>
      </section>


      {/* ==================== 底部说明 ==================== */}
      <footer className="text-center py-8 text-gray-300 text-sm border-t border-gray-100">
        <p>
          OneLLM 兼容 OpenAI API 标准，任何遵循该标准的框架 / SDK / 平台均可直接集成，
          无需额外适配。
          <a
            href="https://platform.openai.com/docs/api-reference"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-500 ml-1"
          >
            参考 OpenAI API 文档 <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </footer>
    </div>
  );
}

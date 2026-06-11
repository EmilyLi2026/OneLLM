import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Key, Cpu, Zap, BookOpen, Copy, Check, ArrowRight,
  Terminal, Server, Shield, ChevronDown,
  Workflow, Puzzle, Box, MessageSquare, Layers, Globe, Brain, Bot,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// 通用：代码示例（快速接入区）
// ────────────────────────────────────────────────────────────
const CODE_EXAMPLES: Record<string, string> = {
  curl: `# 1. 在管理控制台创建 API Key
# 2. 用标准 OpenAI SDK 直接调用，只需改 baseURL

curl https://your-gateway.onellm.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'`,
  nodejs: `// npm install openai
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-gateway.onellm.com/v1',
  apiKey: 'YOUR_API_KEY',
});

const completion = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: '你好，介绍一下你自己' }],
});

console.log(completion.choices[0].message.content);`,
  python: `# pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="https://your-gateway.onellm.com/v1",
    api_key="YOUR_API_KEY",
)

completion = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好，介绍一下你自己"}],
)

print(completion.choices[0].message.content)`,
}

const QUICKSTART_TABS = [
  { key: 'curl', label: 'cURL' },
  { key: 'nodejs', label: 'Node.js' },
  { key: 'python', label: 'Python' },
]

// ────────────────────────────────────────────────────────────
// 框架配置指南数据
// ────────────────────────────────────────────────────────────

type CodeTab = { lang: string; code: string }

interface FrameworkGuide {
  id: string
  title: string
  icon: React.FC<{ className?: string; strokeWidth?: number }>
  principle: string
  steps: { label: string; content: string }[]
  codeTabs?: CodeTab[]
  note?: string
  /** 仅 Python SDK */
  pythonOnly?: boolean
  /** 仅 Node SDK */
  nodeOnly?: boolean
}

const frameworkGuides: FrameworkGuide[] = [
  // ──── 1. OpenAI SDK ────
  {
    id: 'openai-sdk',
    title: 'OpenAI SDK',
    icon: Cpu,
    principle: 'OneLLM 网关完全兼容 OpenAI API 格式，Chat / Embeddings / Image / Audio / Models 全部端点。使用 OpenAI 官方 SDK，仅需修改 baseURL 和 apiKey 即可将所有请求路由到 OneLLM，由网关负责模型切换、负载均衡和成本追踪。',
    steps: [
      { label: '获取 API Key', content: '登录 OneLLM 管理控制台，进入「API Keys」页面创建一个 Key。' },
      { label: '设置 baseURL', content: '将 SDK 的 baseURL 指向你的 OneLLM 网关地址（例如 https://your-gateway.onellm.com/v1）。' },
      { label: '发起调用', content: '后续代码无需任何修改 — model 参数可切换至 DeepSeek / Qwen / GPT / Claude 等任意已配置模型。' },
    ],
    codeTabs: [
      {
        lang: 'Node.js',
        code: `// npm install openai
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-gateway.onellm.com/v1',
  apiKey: process.env.AIHUB_API_KEY,
});

const completion = await client.chat.completions.create({
  model: 'deepseek-chat',   // 可切换任意模型
  messages: [{ role: 'user', content: '你好' }],
  stream: true,              // 支持流式
});

for await (const chunk of completion) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`,
      },
      {
        lang: 'Python',
        code: `# pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="https://your-gateway.onellm.com/v1",
    api_key="your-api-key",
)

# Chat
completion = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
)
print(completion.choices[0].message.content)

# Embeddings
emb = client.embeddings.create(
    model="text-embedding-3-small",
    input=["Hello world"],
)`,
      },
    ],
    note: '所有 OpenAI SDK 接口均可用：chat.completions、embeddings、images.generate、audio.speech、audio.transcriptions、models.list。',
  },

  // ──── 2. LangChain ────
  {
    id: 'langchain',
    title: 'LangChain',
    icon: Workflow,
    principle: 'OneLLM Python SDK 内置了 LangChain Callback Handler 和 LLM/ChatModel 包装器，可自动追踪所有 LLM 调用、Chain 执行、Tool 调用和 Retriever 查询。Node.js SDK 同样提供 LangChain.js callback。',
    steps: [
      { label: '安装 OneLLM SDK', content: 'Python: pip install aihub。Node.js: npm install @ai-hub/node。SDK 自带 LangChain 集成。' },
      { label: '使用 Callback（自动追踪）', content: '创建 LangchainCallbackHandler 实例并传入 LangChain 的 callbacks 列表。Agent / Chain / LLM 的所有调用将被自动记录到 OneLLM。' },
      { label: '或使用包装器（直接替换）', content: 'Python SDK 提供 PortkeyLLM 和 ChatPortkey，可直接替换 LangChain 的 OpenAI LLM，无需额外配置回调。' },
    ],
    codeTabs: [
      {
        lang: 'Python — Callback 方式',
        code: `# pip install aihub langchain-openai
from langchain_openai import ChatOpenAI
from portkey_ai.langchain import LangchainCallbackHandler

# 创建 OneLLM callback（自动上报所有 LLM 调用）
portkey_handler = LangchainCallbackHandler(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
)

llm = ChatOpenAI(
    model="deepseek-chat",
    base_url="https://your-gateway.onellm.com/v1",
    api_key="your-onellm-key",
    callbacks=[portkey_handler],  # ← 自动追踪
)

response = llm.invoke("你好")
# 调用记录自动出现在 OneLLM Dashboard 中`,
      },
      {
        lang: 'Python — Wrapper 方式',
        code: `# pip install aihub langchain
from portkey_ai.llms.langchain.chat import ChatPortkey

# ChatPortkey 直接替换 LangChain ChatModel
llm = ChatPortkey(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
    model="deepseek-chat",
)

response = llm.invoke("你好")
# 无需 callback，自动上报`,
      },
      {
        lang: 'Node.js',
        code: `// npm install @ai-hub/node @langchain/core @langchain/openai
import { ChatOpenAI } from '@langchain/openai';
import { LangchainCallbackHandler } from '@ai-hub/node/langchain';

const handler = new LangchainCallbackHandler({
  apiKey: process.env.AIHUB_API_KEY,
  baseURL: 'https://your-gateway.onellm.com/v1',
});

const llm = new ChatOpenAI({
  model: 'deepseek-chat',
  configuration: {
    baseURL: 'https://your-gateway.onellm.com/v1',
    apiKey: process.env.AIHUB_API_KEY,
  },
  callbacks: [handler],
});

const response = await llm.invoke('你好');
console.log(response.content);`,
      },
    ],
    note: 'LangChain Agent / Tool Calling / Chain 嵌套调用均可完整追踪。每次调用自动记录 model、tokens、latency、cost。',
  },

  // ──── 3. CrewAI ────
  {
    id: 'crewai',
    title: 'CrewAI',
    icon: Puzzle,
    pythonOnly: true,
    principle: 'OneLLM Python SDK 内置 CrewAI OpenTelemetry 自动插桩。安装后自动追踪 Crew.kickoff、Agent.execute_task、Task.execute_sync 等所有关键方法调用，零代码侵入。',
    steps: [
      { label: '安装', content: 'pip install aihub crewai。OneLLM SDK 的 CrewAI 插桩会自动检测 crewai 包是否已安装。' },
      { label: '初始化插桩', content: '在代码开头调用一次 initialize_instrumentation()，SDK 自动完成对所有 CrewAI 方法的 monkey-patch。' },
      { label: '正常使用 CrewAI', content: '代码无需任何额外修改，所有 Crew 执行记录自动上报到 OneLLM。' },
    ],
    codeTabs: [
      {
        lang: 'Python',
        code: `# pip install aihub crewai crewai-tools
from portkey_ai.api_resources.instrumentation import initialize_instrumentation

# 一行初始化，自动插桩 CrewAI
initialize_instrumentation(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
)

# 下面正常使用 CrewAI —— 所有调用自动追踪
from crewai import Agent, Task, Crew

researcher = Agent(
    role="研究员",
    goal="查找最新 AI 趋势",
    backstory="你是一位资深科技研究员",
    llm="deepseek-chat",  # 通过 OneLLM 路由
)

task = Task(
    description="调研 2026 年 AI Agent 发展方向",
    expected_output="一份 3 段的调研报告",
    agent=researcher,
)

crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()
# 所有 LLM 调用记录在 OneLLM Dashboard 可见`,
      },
    ],
    note: '支持追踪的方法：Crew.kickoff / kickoff_for_each / kickoff_async、Agent.execute_task、Task.execute_sync、RAGStorage.save / search / reset。',
  },

  // ──── 4. LlamaIndex ────
  {
    id: 'llamaindex',
    title: 'LlamaIndex',
    icon: Layers,
    pythonOnly: true,
    principle: 'OneLLM Python SDK 内置 LlamaIndex Callback Handler，继承自 llama_index.core.callbacks.base.BaseCallbackHandler。自动记录索引查询、节点检索、LLM 生成等全链路事件。',
    steps: [
      { label: '安装', content: 'pip install aihub llama-index。SDK 自动检测 llama-index 包并注册 callback。' },
      { label: '配置 Callback', content: '创建 LlamaIndexCallbackHandler 实例，传入 LlamaIndex 的 Settings.callback_manager。' },
      { label: '正常查询', content: '后续所有 query / retrieve / chat 调用自动上报到 OneLLM。' },
    ],
    codeTabs: [
      {
        lang: 'Python',
        code: `# pip install aihub llama-index llama-index-llms-openai
from llama_index.core import Settings, VectorStoreIndex, SimpleDirectoryReader
from llama_index.llms.openai import OpenAI
from portkey_ai.llamaindex import LlamaIndexCallbackHandler

# 1. 创建 callback handler
portkey_handler = LlamaIndexCallbackHandler(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
)

# 2. 配置 LLM + callback
Settings.llm = OpenAI(
    model="deepseek-chat",
    api_base="https://your-gateway.onellm.com/v1",
    api_key="your-onellm-key",
)
Settings.callback_manager.add_handler(portkey_handler)

# 3. 正常使用 —— 自动追踪
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("这篇文档讲了什么？")
# 所有 LLM 调用 + 检索事件自动记录`,
      },
    ],
    note: '支持的追踪事件：on_event_start/end（LLM / Retrieval / Node Parsing / Embedding / Synthesis）。支持 streaming 和 async 模式。',
  },

  // ──── 5. Dify ────
  {
    id: 'dify',
    title: 'Dify',
    icon: Box,
    principle: 'Dify 支持「OpenAI-API-compatible」模型供应商类型。将 OneLLM 配置为一个供应商后，Dify 中的所有 Agent / Workflow / Chatflow 即可通过 OneLLM 调用任意模型，享有统一路由、成本控制和日志追踪。',
    steps: [
      { label: '打开 Dify 设置', content: '登录 Dify 控制台 → 右上角头像 →「设置」→「模型供应商」。' },
      { label: '添加 OpenAI-API-compatible 供应商', content: '点击「添加供应商」→ 选择「OpenAI-API-compatible」。在弹出的配置表单中填写 OneLLM 网关地址和 API Key。' },
      { label: '配置模型列表', content: '在 Dify 中配置你希望通过 OneLLM 调用的模型名称（如 deepseek-chat、qwen-plus 等）。网关收到请求后自动路由到对应上游厂商。' },
      { label: '使用', content: '在 Dify 的 Agent / Workflow / 应用中，选择你刚刚配置的 OneLLM 供应商下的模型即可。' },
    ],
    codeTabs: undefined,
    note: '配置参数示例：API Base URL = https://your-gateway.onellm.com/v1，API Key = aihub_sk_xxx。确保 Dify 实例能访问你的 OneLLM 网关地址。',
  },

  // ──── 6. 扣子 (Coze) ────
  {
    id: 'coze',
    title: '扣子 (Coze)',
    icon: MessageSquare,
    principle: '扣子支持通过「自定义模型」接入第三方模型服务。将 OneLLM 配置为自定义模型 endpoint，即可在扣子 Bot / Agent 中调用 120+ 个国产和国际模型。',
    steps: [
      { label: '打开扣子模型配置', content: '登录扣子控制台 → 进入 Bot 编辑 →「模型」设置 →「添加自定义模型」。' },
      { label: '填写 Endpoint 信息', content: '在自定义模型配置中填写：API 地址 = https://your-gateway.onellm.com/v1/chat/completions，认证方式 = Bearer Token，填入 OneLLM API Key。' },
      { label: '配置模型参数', content: '设置模型名称（如 deepseek-chat）、最大 Token 数、温度等参数。扣子会将对话消息按 OpenAI Chat Completions 格式发送给 OneLLM。' },
      { label: '测试并发布', content: '在扣子调试面板中测试模型是否正常回复，确认后发布 Bot。' },
    ],
    codeTabs: undefined,
    note: '扣子的自定义模型接口遵循 OpenAI Chat Completions 格式，因此与 OneLLM 完全兼容。如需使用多个模型，在扣子中添加多个自定义模型条目即可。',
  },

  // ──── 7. Vercel AI SDK ────
  {
    id: 'vercel-ai-sdk',
    title: 'Vercel AI SDK',
    icon: Zap,
    nodeOnly: true,
    principle: 'OneLLM Node.js SDK 提供与 Vercel AI SDK 兼容的 custom provider。只需将 provider 指向 OneLLM，即可在 Next.js / SvelteKit / Nuxt 等框架的 AI 应用中使用，支持 streaming、tool calling 等全部功能。',
    steps: [
      { label: '安装', content: 'npm install @ai-hub/node ai @ai-sdk/openai。OneLLM SDK 的 provider 基于 @ai-sdk/openai 的接口标准。' },
      { label: '创建 Provider', content: '使用 OneLLM 的 createAIHubProvider 工厂函数，传入网关地址和 API Key。' },
      { label: '在路由中使用', content: '在 Next.js Route Handler 中，用 streamText 或 generateText 配合 OneLLM provider。' },
    ],
    codeTabs: [
      {
        lang: 'Next.js Route Handler',
        code: `// app/api/chat/route.ts
// npm install @ai-hub/node ai @ai-sdk/openai
import { streamText } from 'ai';
import { createAIHubProvider } from '@ai-hub/node/vercel';

const aihub = createAIHubProvider({
  baseURL: 'https://your-gateway.onellm.com/v1',
  apiKey: process.env.AIHUB_API_KEY!,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: aihub('deepseek-chat'),  // 可切换任意模型
    messages,
  });

  return result.toDataStreamResponse();
}`,
      },
      {
        lang: '通用 (generateText)',
        code: `// npm install @ai-hub/node ai
import { generateText } from 'ai';
import { createAIHubProvider } from '@ai-hub/node/vercel';

const aihub = createAIHubProvider({
  baseURL: 'https://your-gateway.onellm.com/v1',
  apiKey: process.env.AIHUB_API_KEY!,
});

const { text } = await generateText({
  model: aihub('qwen-plus'),
  prompt: '写一首关于人工智能的诗',
});

console.log(text);`,
      },
    ],
    note: '支持 streamText、generateText、streamObject、generateObject 等 Vercel AI SDK 全部核心 API。也兼容 useChat hook。',
  },

  // ──── 8. LiteLLM ────
  {
    id: 'litellm',
    title: 'LiteLLM',
    icon: Globe,
    pythonOnly: true,
    principle: 'OneLLM Python SDK 内置 LiteLLM OpenTelemetry 自动插桩，覆盖 completion、text_completion、embedding、image_generation 等所有接口的同步与异步调用。',
    steps: [
      { label: '安装', content: 'pip install aihub litellm。SDK 自动检测 litellm 包。' },
      { label: '初始化插桩', content: '调用 initialize_instrumentation()，一行代码完成对 litellm 全部 API 的 monkey-patch。' },
      { label: '正常使用', content: '后续所有 litellm.completion / litellm.embedding 调用自动上报至 OneLLM。' },
    ],
    codeTabs: [
      {
        lang: 'Python',
        code: `# pip install aihub litellm
from portkey_ai.api_resources.instrumentation import initialize_instrumentation

initialize_instrumentation(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
)

# 正常使用 LiteLLM —— 自动追踪
import litellm

# 同步
response = litellm.completion(
    model="openai/deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
    api_base="https://your-gateway.onellm.com/v1",
)

# 异步
response = await litellm.acompletion(
    model="openai/deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
)

# 所有调用自动记录到 OneLLM`,
      },
    ],
    note: '支持 litellm.completion / acompletion / text_completion / embedding / aembedding / image_generation / aimage_generation。',
  },

  // ──── 9. Google ADK ────
  {
    id: 'adk',
    title: 'Google ADK (Agent Development Kit)',
    icon: Brain,
    pythonOnly: true,
    principle: 'OneLLM Python SDK 内置 PortkeyAdk — 一个完整的 ADK BaseLlm 适配器。将 ADK Agent 的 LLM 请求映射到 OneLLM 网关，支持 streaming、tool calling、thinking 等 ADK 全部特性。',
    steps: [
      { label: '安装', content: 'pip install aihub google-adk。PortkeyAdk 适配器位于 portkey_ai.integrations.adk。' },
      { label: '替换 LLM', content: '在 ADK Agent 初始化时，使用 PortkeyAdk 实例替代默认 LLM。' },
      { label: '正常运行', content: 'Agent 的所有 LLM 调用自动通过 OneLLM 网关路由和记录。' },
    ],
    codeTabs: [
      {
        lang: 'Python',
        code: `# pip install aihub google-adk google-genai
from google.adk.agents import LlmAgent
from portkey_ai.integrations.adk import PortkeyAdk

# 创建 OneLLM 适配的 LLM
llm = PortkeyAdk(
    api_key="your-onellm-key",
    base_url="https://your-gateway.onellm.com/v1",
    model="deepseek-chat",
)

# ADK Agent 正常使用
agent = LlmAgent(
    name="assistant",
    model=llm,          # ← 使用 OneLLM 适配器
    instruction="你是一个有帮助的助手。",
)

# 所有 LLM 调用自动经 OneLLM 路由
# 支持 streaming、tool calling、thinking`,
      },
    ],
    note: 'PortkeyAdk 完全兼容 google-adk >= 0.x。支持 Responses API 模式，包含 reasoning / thinking、JSON schema 输出、function calls 等 ADK 核心特性。',
  },
]

// ────────────────────────────────────────────────────────────
// 快速接入步骤
// ────────────────────────────────────────────────────────────
const quickStart = [
  {
    step: '01', icon: Server, title: '配置 Provider',
    desc: '在「Provider 凭证」中添加你的上游模型厂商 API Key（如 DeepSeek、阿里百炼等），支持 AES-256 加密存储。',
    color: 'bg-purple-50 text-purple-500',
  },
  {
    step: '02', icon: Key, title: '获取 API Key',
    desc: '登录管理控制台，在「API Keys」中创建你的第一个 Key。支持绑定多个模型厂商，设置预算上限。',
    color: 'bg-blue-50 text-blue-500',
  },
  {
    step: '03', icon: Terminal, title: '发起调用',
    desc: '使用标准 OpenAI SDK，只需修改 baseURL 和 API Key 即可。网关自动路由到可用 Provider，记录每次调用的 Token 消耗和费用。',
    color: 'bg-emerald-50 text-emerald-500',
  },
]

const topics = [
  { icon: BookOpen, title: 'API 参考', desc: '完整的 OpenAI 兼容接口文档，包括 Chat、Embeddings、Images、Audio、Models 等端点。支持 streaming 和 function calling。' },
  { icon: Cpu, title: '模型切换', desc: '切换 model 参数即可使用不同模型，网关自动路由到对应厂商。支持 DeepSeek / Qwen / GPT / Claude / Gemini 等 120+ 模型。' },
  { icon: Shield, title: '安全与认证', desc: '所有请求通过 HTTPS + Bearer Token 认证。Key 支持 Scope 限制、IP 白名单、过期时间和预算上限。' },
  { icon: Zap, title: '最佳实践', desc: '连接池复用、指数退避重试、Prompt 缓存、Streaming 流式响应的推荐用法。生产环境建议设置重试策略和超时。' },
]

// ────────────────────────────────────────────────────────────
// 页面组件
// ────────────────────────────────────────────────────────────
export default function Docs() {
  const [activeTab, setActiveTab] = useState('curl')
  const [copied, setCopied] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)
  const [guideTabIndex, setGuideTabIndex] = useState<Record<string, number>>({})
  const location = useLocation()

  // 处理从 Integrations 页面跳过来的 hash（如 /docs#langchain）
  useEffect(() => {
    const hash = location.hash?.replace('#', '')
    if (hash) {
      setExpandedGuide(hash)
      setTimeout(() => {
        const el = document.getElementById(hash)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 150)
    }
  }, [location.hash])

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_EXAMPLES[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleGuide = (id: string) => {
    setExpandedGuide(expandedGuide === id ? null : id)
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ==================== Header ==================== */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">技术支持</h1>
        <p className="text-gray-400">快速接入 OneLLM 网关，用一套 API 调用 120+ AI 模型。包含主流 Agent 框架的详细配置教程。</p>
      </div>

      {/* ==================== 三步快速接入 ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 tracking-tight">⚡ 三步快速接入</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickStart.map(({ step, icon: Icon, title, desc, color }) => (
            <div key={step} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-gray-300 tracking-wider">{step}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}
                  style={{ backgroundColor: color.includes('blue') ? '#eff6ff' : color.includes('purple') ? '#faf5ff' : '#ecfdf5' }}>
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-gray-900 font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 代码示例 ==================== */}
      <section className="mb-12">
        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">代码示例</h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
            {QUICKSTART_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setCopied(false) }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <pre className="p-4 rounded-xl bg-gray-50 text-sm text-gray-600 overflow-x-auto border border-gray-100 leading-relaxed">
{CODE_EXAMPLES[activeTab]}
          </pre>
          <p className="mt-3 text-xs text-gray-400">
            兼容 OpenAI SDK，只需修改 <code className="text-blue-500 bg-blue-50 px-1 rounded">baseURL</code> 和 <code className="text-blue-500 bg-blue-50 px-1 rounded">apiKey</code> 即可接入。
          </p>
        </div>
      </section>

      {/* ==================== 框架配置指南 ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 tracking-tight">框架配置指南</h2>
        <p className="text-sm text-gray-400 mb-5">
          以下为各主流 Agent 框架的详细接入教程。点击展开查看完整代码和配置步骤。
        </p>
        <div className="space-y-3">
          {frameworkGuides.map((guide) => {
            const isOpen = expandedGuide === guide.id
            const tabIdx = guideTabIndex[guide.id] ?? 0
            const hasCode = guide.codeTabs && guide.codeTabs.length > 0

            return (
              <div
                key={guide.id}
                id={guide.id}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden scroll-mt-20"
              >
                {/* ── 折叠标题栏 ── */}
                <button
                  onClick={() => toggleGuide(guide.id)}
                  className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <guide.icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-semibold text-sm">{guide.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {guide.pythonOnly ? 'Python SDK' : guide.nodeOnly ? 'Node.js SDK' : 'Python / Node.js SDK'}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-300 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                </button>

                {/* ── 展开内容 ── */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    {/* 原理 */}
                    <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                      <div className="text-xs font-semibold text-blue-600 mb-1">💡 原理</div>
                      <p className="text-xs text-blue-700/80 leading-relaxed">{guide.principle}</p>
                    </div>

                    {/* 步骤 */}
                    <div className="mt-4 space-y-3">
                      {guide.steps.map((s, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{s.label}</div>
                            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{s.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 代码 */}
                    {hasCode && (
                      <div className="mt-5">
                        {/* 语言 tabs */}
                        {guide.codeTabs!.length > 1 && (
                          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3 w-fit">
                            {guide.codeTabs!.map((tab, i) => (
                              <button
                                key={i}
                                onClick={() => setGuideTabIndex({ ...guideTabIndex, [guide.id]: i })}
                                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                                  i === tabIdx
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                {tab.lang}
                              </button>
                            ))}
                          </div>
                        )}
                        <pre className="p-4 rounded-xl bg-gray-50 text-xs text-gray-600 overflow-x-auto border border-gray-100 leading-relaxed">
{guide.codeTabs![tabIdx].code}
                        </pre>
                      </div>
                    )}

                    {/* 备注 */}
                    {guide.note && (
                      <div className="mt-4 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                        <p className="text-xs text-amber-700/80 leading-relaxed">{guide.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ==================== 常用话题 ==================== */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-5 tracking-tight">常用话题</h2>
        <div className="grid grid-cols-2 gap-4">
          {topics.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-semibold text-sm mb-1">{title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 底部 CTA ==================== */}
      <section className="mb-8 p-8 rounded-3xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">遇到问题？</h2>
        <p className="text-gray-400 text-sm mb-5 max-w-md mx-auto">
          联系我们的技术团队获取一对一支持，或提交定制化方案需求。
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm shadow-blue-200"
        >
          获取技术支持 <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </section>
    </div>
  )
}

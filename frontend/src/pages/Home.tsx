import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Shield, Zap, Layers, BarChart3, Key, Route, Puzzle, EyeOff, AlertTriangle,
  Mail, MessageSquare, Headphones, Server, Cpu, Network, TrendingUp, Users, CheckCircle2,
} from 'lucide-react'
import AuthModal from '../components/AuthModal'
import kefuImg from '../assets/kefu1.png'

// ── Gateway features (merged from old + new) ──
const features = [
  {
    icon: Route,
    title: '智能路由与自动故障转移',
    desc: '一个 API Key 绑定多个模型厂商，按优先级自动路由；主 Provider 不可用时毫秒级切换到备用，保障业务零中断。',
  },
  {
    icon: Shield,
    title: '三级预算熔断体系',
    desc: 'Workspace → Key（Agent）→ Provider 三层逐级管控。70% 预警 / 85% 限流 / 100% 硬熔断返回 402，防止账单失控。',
  },
  {
    icon: Key,
    title: '多 Provider 统一接入',
    desc: '支持 DeepSeek、阿里云、智谱、月之暗面、MiniMax、百度、字节、讯飞、百川、腾讯混元、零一万物、阶跃星辰、硅基流动、OpenRouter 14 家国产大模型厂商。一套 OpenAI 兼容 API，零代码切换。',
  },
  {
    icon: BarChart3,
    title: '全链路可观测与成本归因',
    desc: '每次调用记录 Token 消耗、花费（分）、延迟、成功率。按模型/Provider/Agent 多维度下钻，支持 Session 级会话追踪。',
  },
  {
    icon: Cpu,
    title: '模型目录与自动发现',
    desc: '120+ 个系统内置模型规格，14 家厂商分级管理。对接 OpenRouter 公开数据源自动发现新模型，始终保持最新。',
  },
  {
    icon: Layers,
    title: '密钥加密存储与审计',
    desc: '上游厂商 API Key 使用 AES-256-GCM 加密存储，仅网关内网解密后转发。审计日志记录全部管理操作，不可删除、不可篡改。',
  },
]

// ── Pain points ──
const pains = [
  {
    icon: Puzzle,
    title: '接入碎片化',
    subtitle: '5 个模型 = 5 套代码',
    pain: 'DeepSeek、阿里、智谱……每家 API 格式不同、SDK 各异。每接入一个新模型就要重读文档、重写适配层，维护成本随模型数量线性增长。',
  },
  {
    icon: EyeOff,
    title: '成本黑盒',
    subtitle: 'Token 消耗像无底洞',
    pain: 'Agent 循环调用了几次？哪个模型最烧钱？单次请求花了多少？没有统一网关一切都不可见，直到月底收到账单才发现预算早已失控。',
  },
  {
    icon: AlertTriangle,
    title: '单点风险',
    subtitle: '一次宕机 = 全面停摆',
    pain: '主模型厂商故障了怎么办？切备用 Key 要改配置、重启服务、手动干预。等恢复完，几小时的业务中断和客户投诉已经发生，无可挽回。',
  },
]

// ── Social proof metrics ──
const metrics = [
  { value: '15+', label: '国产厂商深度接入', icon: Shield },
  { value: '120+', label: '系统内置模型规格', icon: Cpu },
  { value: '3级', label: '预算管控体系', icon: TrendingUp },
  { value: 'OpenAI', label: '兼容标准协议', icon: Network },
]

// ── How it works steps ──
const howItWorks = [
  {
    step: '01',
    title: '配置 Provider 凭证',
    desc: '在管理控制台添加上游模型厂商 API Key，AES-256-GCM 加密存储，仅网关内网解密使用。',
    icon: Key,
  },
  {
    step: '02',
    title: '创建 API Key 并绑定 Provider',
    desc: '创建统一 API Key，按需绑定多个 Provider（支持优先级、模型白名单、独立预算）。一个 Key 打通所有厂商。',
    icon: Layers,
  },
  {
    step: '03',
    title: '一行代码调用',
    desc: '使用标准 OpenAI SDK，只改 baseURL 和 API Key。网关自动路由到最佳 Provider，记录每次调用。',
    icon: Route,
  },
]

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="max-w-5xl mx-auto">
      {/* ═══════════════════════════════════════════════
          1. HERO — P0-3: Professional, data-driven
      ═══════════════════════════════════════════════ */}
      <section className="py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          基于 MIT 开源协议 · 可私有化部署
        </div>

        <h1 className="text-5xl font-bold text-gray-900 mb-3 tracking-tight leading-tight">
           国产大模型的统一控制平面
          <br />
          <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            助力你的 Agent 跑的稳、算得清、合规安全
          </span>
        </h1>
        <p className="text-lg text-gray-500 max-w-3xl mx-auto mb-10 leading-relaxed">
          一套 API 统一接入
          <strong className="text-gray-700"> 国产大模型厂商</strong>，
          智能路由、自动故障转移、三级预算熔断、全链路可观测——让每一分钱都花在刀刃上。
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setAuthOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-sm shadow-blue-200"
          >
            免费开始使用 <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            预约产品演示
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 text-gray-500 rounded-xl font-medium hover:text-gray-700 transition-colors"
          >
            查看文档 →
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          2. SOCIAL PROOF — P0-4: Metrics bar
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-100">
          <div className="grid grid-cols-4 gap-6">
            {metrics.map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Icon className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{value}</div>
                <div className="text-sm text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          3. PAIN POINTS — resonate first, then solve
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">接入大模型，你是否也踩过这些坑？</h2>
          <p className="text-gray-400 text-sm">每一个坑背后，都是团队的真金白银和时间成本</p>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {pains.map(({ icon: Icon, title, subtitle, pain }) => (
            <div key={title} className="p-7 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-bold text-base tracking-tight">{title}</h3>
                  <p className="text-gray-400 text-xs">{subtitle}</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{pain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          4. HOW IT WORKS — solution after pain points
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">三步接入，即刻统一 AI 模型入口</h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            从配置到调用的极简流程，兼容 OpenAI SDK 标准接口
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden lg:block absolute top-10 left-[calc(16.5%+2rem)] right-[calc(16.5%+2rem)] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-blue-200" />

          {howItWorks.map(({ step, title, desc, icon: Icon }) => (
            <div key={step} className="relative p-6 rounded-2xl bg-white border border-gray-100 shadow-sm text-center group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform relative z-10">
                <Icon className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-bold text-blue-400 mb-1 tracking-wider">STEP {step}</div>
              <h3 className="text-gray-900 font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          5. GATEWAY FEATURES
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center tracking-tight mb-1">平台核心能力</h2>
        <Link to="/products" className="text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center justify-center gap-1 mb-8">
          查看完整产品矩阵 <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm group hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-gray-900 font-medium mb-2 tracking-tight">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          6. BOTTOM CTA BANNER
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <div className="p-10 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-center shadow-lg shadow-blue-200">
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            准备好统一管控 AI 模型调用了？
          </h2>
          <p className="text-blue-100 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            免费注册即可接入 120+ 个系统模型，支持 14 家国产厂商。企业版提供私有化部署与专属技术支持。
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-sm"
            >
              免费开始 <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 border border-blue-300 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
            >
              查看定价方案
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          7. CONTACT
      ═══════════════════════════════════════════════ */}
      <section className="mb-16">
        <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">开始使用 OneLLM</h2>
            <p className="text-gray-400 text-sm">免费注册，即刻接入企业级 AI 网关</p>
          </div>
          <div className="grid grid-cols-4 gap-6 items-start max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-1">企业销售</div>
              <img src={kefuImg} alt="企业销售" className="w-28 h-28 mx-auto rounded-xl border border-gray-100" />
              <div className="text-xs text-gray-400 mt-2">扫码联系销售</div>
            </div>
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-1">在线咨询</div>
              <div className="text-xl font-bold text-gray-900 tracking-tight">186 1076 8620</div>
              <div className="text-xs text-gray-400 mt-1">工作日 9:00-18:00</div>
            </div>
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <Headphones className="w-5 h-5 text-purple-500" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-1">技术支持</div>
              <img src={kefuImg} alt="技术支持" className="w-28 h-28 mx-auto rounded-xl border border-gray-100" />
              <div className="text-xs text-gray-400 mt-2">扫码添加技术支持</div>
            </div>
            <div className="flex flex-col items-center justify-center h-full min-h-[180px]">
              <button
                onClick={() => setAuthOpen(true)}
                className="w-full px-5 py-3 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm shadow-blue-200 text-center mb-3"
              >
                免费注册
              </button>
              <Link
                to="/contact"
                className="w-full px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors text-center"
              >
                更多联系方式
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          8. FOOTER
      ═══════════════════════════════════════════════ */}
      <footer className="text-center py-8 text-gray-300 text-sm border-t border-gray-100">
        <p>©2026 叮咚数智（天津）科技有限公司 保留所有权利</p>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

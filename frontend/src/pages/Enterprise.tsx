import { Link } from 'react-router-dom'
import {
  Shield,
  Building2,
  Headphones,
  Users,
  Server,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

const enterpriseFeatures = [
  {
    icon: Users,
    title: 'SSO 单点登录 & RBAC',
    desc: '支持 SAML/OIDC 集成，细粒度角色权限控制（Owner / Admin / Member / Viewer），团队组织架构管理。',
    highlight: '安全',
  },
  {
    icon: Clock,
    title: '高可用架构',
    desc: '网关内置智能故障转移，主 Provider 不可用时自动切换备用。Redis 实时计数 + MySQL 持久化，服务设计为无状态可水平扩展。',
    highlight: '可靠',
  },
  {
    icon: CheckCircle2,
    title: '三级预算熔断',
    desc: 'Workspace → Key（Agent）→ Provider 三层逐级管控，70% 预警 / 85% 限流 / 100% 硬熔断，有效防止 Agent 账单失控。',
    highlight: '管控',
  },
  {
    icon: Shield,
    title: '安全加密体系',
    desc: 'API Key bcrypt 加盐哈希；上游 Provider 密钥 AES-256-GCM 加密存储，仅网关内网解密。审计日志全量记录、不可删除。',
    highlight: '合规',
  },
  {
    icon: Headphones,
    title: '专属技术支持',
    desc: '配备专属解决方案工程师，提供部署方案设计、性能调优和最佳实践指导。工作日电话/企微/邮件多渠道支持。',
    highlight: '服务',
  },
  {
    icon: Server,
    title: '私有化部署',
    desc: '支持 Docker 容器化部署、VPC 私有云方案。数据不出企业网络，满足数据驻留与合规要求。',
    highlight: '合规',
  },
]

export default function Enterprise() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* HERO */}
      <section className="py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          企业版
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight leading-tight">
          企业级 AI 接入解决方案
          <br />
          <span className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            安全 · 可控 · 可审计
          </span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          为对安全、合规和成本管控有严格要求的企业团队提供全方位的 AI 模型接入解决方案 —
          SSO 集成、私有化部署、密钥加密、预算熔断和专属技术支持。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-200"
          >
            查看定价方案 <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            预约演示 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="mb-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">企业级特性</h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            为满足企业安全、合规和运维需求而设计的差异化能力
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {enterpriseFeatures.map(({ icon: Icon, title, desc, highlight }) => (
            <div
              key={title}
              className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-gray-900 font-semibold text-sm tracking-tight">{title}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-blue-50 text-blue-500">
                  {highlight}
                </span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEPLOYMENT OPTIONS */}
      <section className="mb-12">
        <div className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center tracking-tight">部署方案</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              {
                title: 'SaaS 多租户',
                desc: '由我们托管，零运维成本。适合中小团队快速上线，数据逻辑隔离，支持按量计费。',
              },
              {
                title: 'VPC 私有云',
                desc: '部署在客户 VPC 中，数据不出企业网络。支持定制化安全策略和网络配置，满足合规审计要求。',
              },
              {
                title: '混合部署',
                desc: '控制平面 SaaS + 数据平面私有化。兼顾运维便捷性与数据安全，适合对数据驻留有严格要求的企业。',
              },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                <Server className="w-8 h-8 text-blue-500 mx-auto mb-3" strokeWidth={1.5} />
                <h3 className="text-gray-900 font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mb-8 p-10 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-center shadow-lg shadow-blue-200">
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
          准备好将 AI 模型管控提升到企业级？
        </h2>
        <p className="text-blue-100 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
          联系我们的企业团队，获取定制化部署方案与专属技术支持。
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-sm"
        >
          立即预约演示 <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  )
}

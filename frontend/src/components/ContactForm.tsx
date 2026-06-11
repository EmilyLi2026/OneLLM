import { useState } from 'react'
import { BadgeCheck, ArrowRight, Loader2 } from 'lucide-react'

export const TEAM_SIZES = ['1-10 人', '11-50 人', '51-200 人', '201-1000 人', '1000+ 人']
export const INTERESTS = [
  '多模型统一接入',
  '智能路由 & 故障转移',
  '预算管控 & 成本优化',
  'Agent 智能体管控',
  'SSO / RBAC & 审计安全',
  '私有化部署',
  'BYOK & 密钥管理',
  '开发者工具 & SDK 集成',
  '模型选型 & 成本评估',
  '其他 / 综合评估',
]

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    company: '',
    teamSize: TEAM_SIZES[0],
    interests: [] as string[],
    message: '',
  })

  const toggleInterest = (item: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(item)
        ? prev.interests.filter((i) => i !== item)
        : [...prev.interests, item],
    }))
  }

  const resetForm = () => {
    setForm({ name: '', phone: '', company: '', teamSize: TEAM_SIZES[0], interests: [], message: '' })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // validate
    if (!form.name.trim()) {
      setError('请填写姓名')
      return
    }
    if (!form.phone.trim()) {
      setError('请填写联系方式')
      return
    }
    const phoneDigits = form.phone.replace(/\D/g, '')
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError('请输入有效的手机号')
      return
    }
    if (!form.company.trim()) {
      setError('请填写公司名称')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/contact/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          teamSize: form.teamSize,
          interests: form.interests,
          message: form.message.trim(),
        }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        setError(data.message || '提交失败，请稍后重试')
        setLoading(false)
        return
      }
      setLoading(false)
      setSubmitted(true)
    } catch {
      setError('网络错误，请稍后重试')
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <BadgeCheck className="w-8 h-8 text-emerald-500" strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">提交成功！</h3>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          我们的企业团队将在 24 小时内通过 <span className="text-gray-600 font-medium">{form.phone}</span> 与你联系，安排定制化演示。
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            resetForm()
          }}
          className="mt-6 px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors font-medium"
        >
          重新提交
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1.5 font-medium">姓名 *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="你的姓名"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1.5 font-medium">联系方式 *</label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="你的手机号"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1.5 font-medium">公司名称 *</label>
          <input
            type="text"
            required
            value={form.company}
            onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
            placeholder="你的公司"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1.5 font-medium">团队规模</label>
          <select
            value={form.teamSize}
            onChange={(e) => setForm((p) => ({ ...p, teamSize: e.target.value }))}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {TEAM_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-500 mb-2 font-medium">感兴趣的方向（可多选）</label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleInterest(item)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                form.interests.includes(item)
                  ? 'bg-blue-50 text-blue-500 border border-blue-200'
                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-500 mb-1.5 font-medium">补充说明</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          rows={3}
          placeholder="请描述你的使用场景、规模需求和任何特殊要求..."
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all resize-none"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium text-sm hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            提交中...
          </>
        ) : (
          <>
            提交咨询 <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </>
        )}
      </button>
      <p className="text-xs text-gray-300 text-center">
        提交即表示你同意我们的隐私政策和服务条款。我们不会将你的信息用于营销目的。
      </p>
    </form>
  )
}

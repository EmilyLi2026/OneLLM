import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { DollarSign, Activity as ActivityIcon, Zap } from 'lucide-react'

type TimeRange = '7d' | '14d' | '30d'

export default function Activity() {
  const { token } = useAuth()
  const [range, setRange] = useState<TimeRange>('30d')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_tokens: 0, total_cost_cents: 0, total_requests: 0 })
  const [breakdown, setBreakdown] = useState<{name: string; tokens: number; cost: number; requests: number; color: string}[]>([])
  const [chartData, setChartData] = useState<{date: string; spend: number; requests: number; tokens: number}[]>([])

  useEffect(() => {
    if (!token) return
    fetch('/api/v1/logs/stats?group_by=model', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(d => {
      if (d.status === 'success') {
        const data = d.data
        setStats({ total_tokens: data.total_tokens, total_cost_cents: data.total_cost_cents, total_requests: data.total_requests })
        const colors = ['#10b981','#6366f1','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4']
        setBreakdown((data.breakdown || []).map((b: any, i: number) => ({
          name: b.name, tokens: b.total_tokens, cost: b.total_cost_cents, requests: b.total_requests,
          color: colors[i % colors.length]
        })))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token])

  const totals = { spend: stats.total_cost_cents / 100, requests: stats.total_requests, tokens: stats.total_tokens }
  const filteredData = chartData

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">使用分析</h1>
          <p className="text-gray-400">实时监控 API 消费、请求量和 Token 用量。</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: '7d', label: '近 7 天' },
            { key: '14d', label: '近 14 天' },
            { key: '30d', label: '近 30 天' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`px-4 py-2 rounded-lg text-sm transition-all font-medium ${
                range === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: DollarSign, label: '总消费', value: `$${totals.spend.toFixed(2)}`, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { icon: ActivityIcon, label: '总请求数', value: totals.requests.toLocaleString(), color: 'text-blue-500', bg: 'bg-blue-50' },
          { icon: Zap, label: '总 Token', value: totals.tokens.toLocaleString(), color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-gray-400 text-sm">{label}</div>
              <div className="text-gray-900 text-2xl font-bold tracking-tight">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Model Distribution */}
      {breakdown.length > 0 && (
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-1 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-4 tracking-tight">模型用量分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={breakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="tokens" stroke="none">
                  {breakdown.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", color: "#1f2937", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {breakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-500">{item.name}</span>
                  </div>
                  <span className="text-gray-700 font-medium">{item.tokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-4 tracking-tight">模型用量详情</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-3 font-medium">模型</th>
                  <th className="py-3 font-medium">Token 用量</th>
                  <th className="py-3 font-medium">请求数</th>
                  <th className="py-3 font-medium">花费 (CNY)</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((item) => (
                  <tr key={item.name} className="border-b border-gray-50">
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-900 font-medium">{item.name}</span>
                    </td>
                    <td className="py-3 text-gray-600">{item.tokens.toLocaleString()}</td>
                    <td className="py-3 text-gray-600">{item.requests.toLocaleString()}</td>
                    <td className="py-3 text-gray-900 font-medium">{(item.cost / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {breakdown.length === 0 && !loading && (
        <div className="p-12 text-center text-gray-400">暂无模型用量数据，开始调用 API 后自动统计</div>
      )}

      {/*{/* Requests & Tokens Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 font-semibold mb-4 tracking-tight">请求量趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  color: '#1f2937',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                }}
              />
              <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={false} name="请求数" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 font-semibold mb-4 tracking-tight">Token 用量趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  color: '#1f2937',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                }}
              />
              <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Token" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

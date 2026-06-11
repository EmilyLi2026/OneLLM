import { useState, useEffect, useMemo } from 'react'
import { Trophy, ExternalLink, ChevronDown, ChevronUp, X, Zap, Eye, Cpu } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Config ──
const SORT_OPTIONS = [
  { key: 'context', label: '超长上下文', desc: '按上下文窗口大小排名' },
  { key: 'price_low', label: '最具性价比', desc: '按输入+输出总价从低到高排名' },
  { key: 'output_tokens', label: '最大输出', desc: '按单次最大输出 Token 排名' },
  { key: 'newest', label: '最新上线', desc: '按发布时间从新到旧排名' },
] as const

const CAP_TABS = [
  { key: '', label: '全部' },
  { key: 'vision', label: '视觉', icon: Eye },
  { key: 'function_calling', label: '函数调用', icon: Cpu },
  { key: 'long_context', label: '长上下文', icon: Zap },
] as const

const MEDAL_COLORS = ['bg-amber-400', 'bg-slate-400', 'bg-orange-500']
const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6']

// ── Types ──
interface RankingItem {
  rank: number
  model_id: string
  name: string
  provider_slug: string
  provider_name: string
  context_length: number
  max_output_tokens: number
  input_price_per_m: number
  output_price_per_m: number
  modality: string
  capabilities: Record<string, boolean>
}

interface ProviderInfo { slug: string; name: string; count: number }

// ── Helpers ──
function fmtContext(n: number): string {
  if (n <= 0) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return `${(n / 1000).toFixed(0)}K`
}
function fmtPrice(cents: number): string {
  if (cents <= 0) return '免费'
  if (cents < 0.01) return `$${cents.toFixed(3)}`
  if (cents < 1) return `$${cents.toFixed(2)}`
  return `$${cents.toFixed(0)}`
}
function fmtTokens(n: number): string {
  if (n <= 0) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1000).toFixed(0)}K`
}

export default function Rankings() {
  const [sort, setSort] = useState<string>('context')
  const [capFilter, setCapFilter] = useState('')
  const [provFilter, setProvFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RankingItem[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<RankingItem | null>(null)

  // ── Fetch data ──
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '60', chinese_only: 'false' })
    if (provFilter) params.set('provider', provFilter)
    if (capFilter) params.set('capability', capFilter)

    Promise.all([
      fetch(`/api/v1/models/rankings?${params}`).then(r => r.json()),
      fetch('/api/v1/models/rankings/filters').then(r => r.json()).catch(() => ({ data: { providers: [] } })),
    ]).then(([rankRes, filtRes]) => {
      if (rankRes.status === 'success') setData(rankRes.data.rankings || [])
      if (filtRes.status === 'success') setProviders(filtRes.data.providers || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sort, capFilter, provFilter])

  // ── Chart data (top 15, reversed for horizontal bar) ──
  const chartData = useMemo(() => {
    return [...data].slice(0, 15).reverse().map(d => ({
      name: d.name.length > 22 ? d.name.slice(0, 22) + '…' : d.name,
      fullName: d.name,
      model_id: d.model_id,
      value: sort === 'context' ? d.context_length
        : sort === 'price_low' ? (d.input_price_per_m + d.output_price_per_m)
        : sort === 'output_tokens' ? d.max_output_tokens
        : d.rank,
      displayValue: sort === 'context' ? fmtContext(d.context_length)
        : sort === 'price_low' ? fmtPrice(d.input_price_per_m + d.output_price_per_m)
        : sort === 'output_tokens' ? fmtTokens(d.max_output_tokens)
        : `#${d.rank}`,
      provider: d.provider_name,
    }))
  }, [data, sort])

  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1

  // ── Aggregated stats ──
  const providerCount = useMemo(() => new Set(data.map(d => d.provider_slug)).size, [data])

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ── */}
      <section className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 mb-1 tracking-tight">AI 模型排行榜</h1>
        <p className="text-sm text-gray-400">
          基于 OpenRouter 公开数据，当前收录 {data.length} 个模型来自 {providerCount} 家厂商，支持多维度排序与筛选。
        </p>
      </section>

      {/* ── Sort + Filters Bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setSort(key); setExpandedId(null); setSelectedModel(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              sort === key
                ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-gray-200 mx-1">|</span>
        {/* Capability filter chips */}
        {CAP_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCapFilter(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              capFilter === key
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
            }`}
          >
            {Icon && <Icon className="w-3 h-3" strokeWidth={1.5} />}
            {label}
          </button>
        ))}
        {/* Provider filter */}
        <select
          value={provFilter}
          onChange={e => setProvFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-500 cursor-pointer focus:outline-none focus:border-blue-400"
        >
          <option value="">全部厂商</option>
          {providers.map(p => (
            <option key={p.slug} value={p.slug}>{p.name} ({p.count})</option>
          ))}
        </select>
      </div>

      {/* ── Chart ── */}
      <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          {SORT_OPTIONS.find(s => s.key === sort)?.desc} — Top 15
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(chartData.length * 28, 200)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 120, bottom: 0 }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.model_id) {
                  const model = data.find(d => d.model_id === e.activePayload[0].payload.model_id)
                  if (model) setSelectedModel(model)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" stroke="#d1d5db" fontSize={11} tick={false} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={115}
                tick={{ fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                  fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
                formatter={(_: number, __: string, props: any) => [props.payload.displayValue, props.payload.fullName]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16} cursor="pointer">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-16 text-center text-gray-300">暂无数据</div>
        )}
      </div>

      {/* ── Detail Panel (when model selected from chart or table) ── */}
      {selectedModel && (
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-sm mb-6 relative">
          <button
            onClick={() => setSelectedModel(null)}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg font-bold text-gray-600">
              {selectedModel.name[0]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedModel.name}</h3>
              <p className="text-sm text-gray-400 mb-3">{selectedModel.provider_name} · {selectedModel.model_id}</p>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">上下文窗口</div>
                  <div className="text-sm font-semibold text-gray-700">{fmtContext(selectedModel.context_length)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">最大输出</div>
                  <div className="text-sm font-semibold text-gray-700">{fmtTokens(selectedModel.max_output_tokens)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">输入价格/1M</div>
                  <div className="text-sm font-semibold text-gray-700">{fmtPrice(selectedModel.input_price_per_m)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">输出价格/1M</div>
                  <div className="text-sm font-semibold text-gray-700">{fmtPrice(selectedModel.output_price_per_m)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedModel.capabilities?.vision && <span className="px-2 py-0.5 text-[10px] rounded bg-purple-50 text-purple-500 border border-purple-100">视觉</span>}
                {selectedModel.capabilities?.function_calling && <span className="px-2 py-0.5 text-[10px] rounded bg-green-50 text-green-500 border border-green-100">函数调用</span>}
                {selectedModel.capabilities?.long_context && <span className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-500 border border-blue-100">长上下文</span>}
                {selectedModel.capabilities?.image_generation && <span className="px-2 py-0.5 text-[10px] rounded bg-pink-50 text-pink-500 border border-pink-100">图像生成</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rankings Table ── */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="min-h-[3rem] px-5 border-b border-gray-50 last:border-0 flex items-center">
              <div className="animate-pulse rounded bg-gray-100 h-4 w-4 mr-4" />
              <div className="animate-pulse rounded-full bg-gray-100 size-7 mr-4" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="animate-pulse rounded bg-gray-100 h-4 w-3/4" />
                <div className="animate-pulse rounded bg-gray-100 h-3 w-1/2" />
              </div>
              <div className="animate-pulse rounded bg-gray-100 h-4 w-20" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-16 text-center">
          <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-4" strokeWidth={1} />
          <p className="text-gray-400">暂无匹配的模型，换一个筛选条件试试</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {data.map((item) => {
            const isExpanded = expandedId === item.model_id
            const isSelected = selectedModel?.model_id === item.model_id
            return (
              <div key={item.model_id}>
                <div
                  onClick={() => setSelectedModel(isSelected ? null : item)}
                  className={`grid grid-cols-12 items-center min-h-[3rem] px-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/50 border-blue-100' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-1 flex items-center gap-2">
                    {item.rank <= 3 ? (
                      <span className={`w-5 h-5 rounded-md ${MEDAL_COLORS[item.rank - 1]} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {item.rank}
                      </span>
                    ) : (
                      <span className="w-5 h-5 flex items-center justify-center text-gray-400 font-mono text-xs">
                        {item.rank}
                      </span>
                    )}
                  </div>
                  {/* Model info */}
                  <div className="col-span-8 flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">
                      {item.name[0]}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                        {item.capabilities?.vision && <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-500 border border-purple-100 shrink-0">视觉</span>}
                        {item.capabilities?.function_calling && <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-500 border border-green-100 shrink-0">FC</span>}
                      </div>
                      <span className="text-xs text-gray-400">{item.provider_name}</span>
                    </div>
                  </div>
                  {/* Value */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <div className="flex-1 max-w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{
                        width: sort === 'context' ? `${(item.context_length / (maxValue || 1)) * 100}%`
                          : sort === 'price_low' ? `${Math.max(5, 100 - ((item.input_price_per_m + item.output_price_per_m) / (maxValue || 1)) * 100)}%`
                          : sort === 'output_tokens' ? `${(item.max_output_tokens / (maxValue || 1)) * 100}%`
                          : `${10}%`
                      }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 font-mono w-14 text-right">
                      {sort === 'context' ? fmtContext(item.context_length)
                        : sort === 'price_low' ? fmtPrice(item.input_price_per_m + item.output_price_per_m)
                        : sort === 'output_tokens' ? fmtTokens(item.max_output_tokens)
                        : `#${item.rank}`}
                    </span>
                  </div>
                  {/* Expand toggle */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.model_id) }}
                      className="p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
                {/* Expanded detail row */}
                {isExpanded && (
                  <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-6 gap-4 text-xs">
                    <div>
                      <span className="text-gray-400">模型ID</span>
                      <p className="text-gray-700 font-mono mt-0.5">{item.model_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">上下文</span>
                      <p className="text-gray-700 mt-0.5">{fmtContext(item.context_length)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">最大输出</span>
                      <p className="text-gray-700 mt-0.5">{fmtTokens(item.max_output_tokens)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">输入价格/1M</span>
                      <p className="text-gray-700 mt-0.5">{fmtPrice(item.input_price_per_m)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">输出价格/1M</span>
                      <p className="text-gray-700 mt-0.5">{fmtPrice(item.output_price_per_m)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">模态</span>
                      <p className="text-gray-700 mt-0.5">{item.modality || 'text'}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
        <span>数据来源: OpenRouter 公开 API · 每 1 小时更新 · 收录 {data.length} 个模型</span>
        <a href="https://openrouter.ai/rankings" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors">
          查看 OpenRouter 原始排行 <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
        </a>
      </div>
    </div>
  )
}

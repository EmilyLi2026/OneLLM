import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Crown, ExternalLink, ChevronDown, ChevronUp, X, Zap, Eye, Cpu,
  Calculator as CalculatorIcon, DollarSign, ArrowUpDown, Search, BarChart3, ArrowRight,
  Database, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ═══════════════════════════════════════════════
// Types & Config
// ═══════════════════════════════════════════════

type Tab = 'rankings' | 'calculator' | 'directory'

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

const PRESETS = [
  { label: '短对话', input: 1_000, output: 500, desc: '~1K 输入 / 500 输出' },
  { label: '中等任务', input: 5_000, output: 2_000, desc: '~5K 输入 / 2K 输出' },
  { label: '长文档', input: 50_000, output: 10_000, desc: '~50K 输入 / 10K 输出' },
  { label: '大批量', input: 500_000, output: 200_000, desc: '~500K 输入 / 200K 输出' },
]

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: '#10b981', Anthropic: '#d97706', Google: '#4285f4', Meta: '#1877f2',
  DeepSeek: '#6366f1', Alibaba: '#f97316', 'Mistral AI': '#ca8a04', Cohere: '#8b5cf6',
  'Stability AI': '#ec4899',
}
const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4']

interface RankingItem {
  rank: number; model_id: string; name: string; provider_slug: string; provider_name: string
  context_length: number; max_output_tokens: number; input_price_per_m: number; output_price_per_m: number
  modality: string; capabilities: Record<string, boolean>
}
interface ProviderInfo { slug: string; name: string; count: number }

type SortField = 'name' | 'inputPrice' | 'outputPrice' | 'contextLength' | 'estimatedCost' | 'rating'

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function fmtContext(n: number): string { if (n <= 0) return '-'; if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`; return `${(n / 1000).toFixed(0)}K` }
function fmtPrice(cents: number): string { if (cents <= 0) return '免费'; if (cents < 0.01) return `$${cents.toFixed(3)}`; return `$${cents.toFixed(2)}` }
function fmtTokens(n: number): string { if (n <= 0) return '-'; if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`; return `${(n / 1000).toFixed(0)}K` }
function fmtPriceRmb(cents: number | string): string { const n = Number(cents); if (n === 0 || isNaN(n)) return '免费'; return `$${n.toFixed(2)}` }

function calcCost(inputTokens: number, outputTokens: number, inputPrice: number, outputPrice: number): number {
  return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000
}

// ═══════════════════════════════════════════════
// Rankings Tab
// ═══════════════════════════════════════════════

function RankingsTab() {
  const [sort, setSort] = useState<string>('context')
  const [capFilter, setCapFilter] = useState('')
  const [provFilter, setProvFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RankingItem[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<RankingItem | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '50', chinese_only: 'false' })
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

  const chartData = useMemo(() => {
    return [...data].slice(0, 15).reverse().map(d => ({
      name: d.name.length > 22 ? d.name.slice(0, 22) + '…' : d.name,
      fullName: d.name, model_id: d.model_id,
      value: sort === 'context' ? d.context_length
        : sort === 'price_low' ? (d.input_price_per_m + d.output_price_per_m)
        : sort === 'output_tokens' ? d.max_output_tokens : d.rank,
      displayValue: sort === 'context' ? fmtContext(d.context_length)
        : sort === 'price_low' ? fmtPrice(d.input_price_per_m + d.output_price_per_m)
        : sort === 'output_tokens' ? fmtTokens(d.max_output_tokens) : `#${d.rank}`,
      provider: d.provider_name,
    }))
  }, [data, sort])

  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1
  const providerCount = useMemo(() => new Set(data.map(d => d.provider_slug)).size, [data])

  return (
    <div>
      {/* Sort + Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex flex-wrap items-center gap-2">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button key={key} onClick={() => { setSort(key); setExpandedId(null); setSelectedModel(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${sort === key ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
          >{label}</button>
        ))}
        <span className="text-gray-200 mx-1">|</span>
        {CAP_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setCapFilter(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${capFilter === key ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
          >{Icon && <Icon className="w-3 h-3" strokeWidth={1.5} />}{label}</button>
        ))}
        <select value={provFilter} onChange={e => setProvFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-500 cursor-pointer focus:outline-none focus:border-blue-400"
        >
          <option value="">全部厂商</option>
          {providers.map(p => (<option key={p.slug} value={p.slug}>{p.name} ({p.count})</option>))}
        </select>
        </div>

        <span className="text-[11px] text-gray-300 shrink-0">数据来源: OpenRouter 公开 API</span>
      </div>

      {/* Chart */}
      <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          {SORT_OPTIONS.find(s => s.key === sort)?.desc} — Top 15
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(chartData.length * 28, 200)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 120, bottom: 0 }}
              onClick={(e: any) => { if (e?.activePayload?.[0]?.payload?.model_id) { const model = data.find(d => d.model_id === e.activePayload[0].payload.model_id); if (model) setSelectedModel(model) } }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" stroke="#d1d5db" fontSize={11} tick={false} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={115} tick={{ fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                formatter={(_: number, __: string, props: any) => [props.payload.displayValue, props.payload.fullName]} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16} cursor="pointer">
                {chartData.map((entry, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (<div className="py-16 text-center text-gray-300">暂无数据</div>)}
      </div>

      {/* Selected Model Detail */}
      {selectedModel && (
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-sm mb-5 relative">
          <button onClick={() => setSelectedModel(null)} className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100"><X className="w-4 h-4" strokeWidth={1.5} /></button>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg font-bold text-gray-600">{selectedModel.name[0]}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedModel.name}</h3>
              <p className="text-sm text-gray-400 mb-3">{selectedModel.provider_name} · {selectedModel.model_id}</p>
              <div className="grid grid-cols-4 gap-4">
                {[['上下文窗口', fmtContext(selectedModel.context_length)], ['最大输出', fmtTokens(selectedModel.max_output_tokens)], ['输入价格/1M', fmtPrice(selectedModel.input_price_per_m)], ['输出价格/1M', fmtPrice(selectedModel.output_price_per_m)]].map(([label, val]) => (
                  <div key={label as string}><div className="text-xs text-gray-400 mb-0.5">{label}</div><div className="text-sm font-semibold text-gray-700">{val}</div></div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {selectedModel.capabilities?.vision && <span className="px-2 py-0.5 text-[10px] rounded bg-purple-50 text-purple-500 border border-purple-100">视觉</span>}
                {selectedModel.capabilities?.function_calling && <span className="px-2 py-0.5 text-[10px] rounded bg-green-50 text-green-500 border border-green-100">函数调用</span>}
                {selectedModel.capabilities?.long_context && <span className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-500 border border-blue-100">长上下文</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings Table */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="min-h-[3rem] px-5 border-b border-gray-50 last:border-0 flex items-center">
              <div className="animate-pulse rounded bg-gray-100 h-4 w-4 mr-4" />
              <div className="animate-pulse rounded-full bg-gray-100 size-7 mr-4" />
              <div className="flex flex-col gap-1.5 flex-1"><div className="animate-pulse rounded bg-gray-100 h-4 w-3/4" /><div className="animate-pulse rounded bg-gray-100 h-3 w-1/2" /></div>
              <div className="animate-pulse rounded bg-gray-100 h-4 w-20" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-16 text-center">
          <Crown className="w-12 h-12 text-gray-200 mx-auto mb-4" strokeWidth={1} />
          <p className="text-gray-400">暂无匹配的模型，换一个筛选条件试试</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          {data.map((item) => {
            const isExpanded = expandedId === item.model_id
            const isSelected = selectedModel?.model_id === item.model_id
            return (
              <div key={item.model_id}>
                <div onClick={() => setSelectedModel(isSelected ? null : item)}
                  className={`grid grid-cols-12 items-center min-h-[3rem] px-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50 border-blue-100' : ''}`}
                >
                  <div className="col-span-1 flex items-center gap-2">
                    {item.rank <= 3 ? (<span className={`w-5 h-5 rounded-md ${MEDAL_COLORS[item.rank - 1]} flex items-center justify-center text-[10px] font-bold text-white`}>{item.rank}</span>)
                      : (<span className="w-5 h-5 flex items-center justify-center text-gray-400 font-mono text-xs">{item.rank}</span>)}
                  </div>
                  <div className="col-span-8 flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">{item.name[0]}</div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                        {item.capabilities?.vision && <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-500 border border-purple-100 shrink-0">视觉</span>}
                        {item.capabilities?.function_calling && <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-500 border border-green-100 shrink-0">FC</span>}
                      </div>
                      <span className="text-xs text-gray-400">{item.provider_name}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <div className="flex-1 max-w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{
                        width: sort === 'context' ? `${(item.context_length / (maxValue || 1)) * 100}%`
                          : sort === 'price_low' ? `${Math.max(5, 100 - ((item.input_price_per_m + item.output_price_per_m) / (maxValue || 1)) * 100)}%`
                          : sort === 'output_tokens' ? `${(item.max_output_tokens / (maxValue || 1)) * 100}%` : `${10}%`
                      }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 font-mono w-14 text-right">
                      {sort === 'context' ? fmtContext(item.context_length) : sort === 'price_low' ? fmtPrice(item.input_price_per_m + item.output_price_per_m) : sort === 'output_tokens' ? fmtTokens(item.max_output_tokens) : `#${item.rank}`}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.model_id) }}
                      className="p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100">{isExpanded ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-6 gap-4 text-xs">
                    {[['模型ID', item.model_id], ['上下文', fmtContext(item.context_length)], ['最大输出', fmtTokens(item.max_output_tokens)], ['输入价格/1M', fmtPrice(item.input_price_per_m)], ['输出价格/1M', fmtPrice(item.output_price_per_m)], ['模态', item.modality || 'text']].map(([label, val]) => (
                      <div key={label}><span className="text-gray-400">{label}</span><p className="text-gray-700 mt-0.5">{val}</p></div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>数据来源: OpenRouter 公开 API · 每 1 小时更新 · 收录 {data.length} 个模型</span>
        <a href="https://openrouter.ai/rankings" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-600">OpenRouter 原始排行 <ExternalLink className="w-3 h-3" /></a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Shared: Discovery API data hook
// ═══════════════════════════════════════════════

interface DiscoveredModel {
  id: string; name: string; provider_slug: string; provider_display: string
  provider_region: 'cn' | 'intl'; description: string; context_length: number
  max_output_tokens: number; pricing: { prompt: string; completion: string }
  modality: string; capabilities: Record<string, boolean>
}

function useDiscoveryData() {
  const [models, setModels] = useState<DiscoveredModel[]>([])
  const [providers, setProviders] = useState<{slug:string;name:string;count:number}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/v1/models/discovery?limit=500').then(r => r.json()),
      fetch('/api/v1/models/discovery/providers').then(r => r.json()),
    ]).then(([mRes, pRes]) => {
      if (mRes.status === 'success') setModels(mRes.data)
      if (pRes.status === 'success') setProviders(pRes.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return { models, providers, loading }
}

// ═══════════════════════════════════════════════
// Calculator Tab — uses OpenRouter discovery data
// ═══════════════════════════════════════════════

function CalculatorTab() {
  const { models, providers, loading } = useDiscoveryData()
  const [inputTokens, setInputTokens] = useState(5000)
  const [outputTokens, setOutputTokens] = useState(2000)
  const [activePreset, setActivePreset] = useState<string>('中等任务')
  const [search, setSearch] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)
  const [sortField, setSortField] = useState<SortField>('estimatedCost')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState('全部')

  const providerOptions = useMemo(() => ['全部', ...providers.map(p => p.name)], [providers])

  // Calc cost: pricing is $/token, multiply by 1M for $/1M tokens
  const modelCosts = useMemo(() => models.map(m => {
    const inPrice = parseFloat(m.pricing.prompt || '0')
    const outPrice = parseFloat(m.pricing.completion || '0')
    return {
      ...m,
      inputPricePerM: inPrice * 1_000_000,
      outputPricePerM: outPrice * 1_000_000,
      estimatedCost: (inputTokens * inPrice + outputTokens * outPrice),
      isFree: inPrice === 0 && outPrice === 0,
    }
  }), [models, inputTokens, outputTokens])

  const filtered = useMemo(() => {
    let list = [...modelCosts]
    if (search) { const q = search.toLowerCase(); list = list.filter(m => m.name.toLowerCase().includes(q) || m.provider_display.toLowerCase().includes(q)) }
    if (onlyFree) list = list.filter(m => m.isFree)
    if (selectedProvider !== '全部') list = list.filter(m => m.provider_display === selectedProvider)
    list.sort((a, b) => { let cmp = 0; switch (sortField) { case 'name': cmp = a.name.localeCompare(b.name); break; case 'inputPrice': cmp = a.inputPricePerM - b.inputPricePerM; break; case 'outputPrice': cmp = a.outputPricePerM - b.outputPricePerM; break; case 'contextLength': cmp = a.context_length - b.context_length; break; case 'estimatedCost': cmp = a.estimatedCost - b.estimatedCost; break; } return sortAsc ? cmp : -cmp })
    return list
  }, [search, onlyFree, selectedProvider, sortField, sortAsc, modelCosts])

  const chartData = useMemo(() => {
    // 排除免费模型，只比较有实际费用的模型 Top 15
    const paid = modelCosts.filter(m => !m.isFree)
    paid.sort((a, b) => a.estimatedCost - b.estimatedCost)
    return paid.slice(0, 15).map(m => ({
      name: m.name.length > 30 ? m.name.slice(0, 30) + '…' : m.name,
      fullName: m.name,
      cost: Number(m.estimatedCost.toFixed(6)),
      provider: m.provider_display,
      isFree: false,
    }))
  }, [modelCosts])

  const stats = useMemo(() => {
    const free = models.filter(m => parseFloat(m.pricing.prompt || '0') === 0 && parseFloat(m.pricing.completion || '0') === 0).length
    // 最低预估费用取付费模型中最便宜的（排除免费模型）
    const paidSorted = [...modelCosts].filter(m => !m.isFree).sort((a, b) => a.estimatedCost - b.estimatedCost)
    return { free, total: models.length, cheapestName: paidSorted[0]?.name || '-', cheapestCost: paidSorted[0]?.estimatedCost || 0 }
  }, [models, modelCosts])

  const toggleSort = (field: SortField) => { if (sortField === field) setSortAsc(!sortAsc); else { setSortField(field); setSortAsc(true) } }
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
  }

  if (loading) return <div className="text-center py-16 text-gray-300">加载模型数据中...</div>

  return (
    <div>
      {/* Estimator */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><CalculatorIcon className="w-5 h-5 text-blue-500" strokeWidth={1.5} /></div>
          <div><h2 className="text-lg font-semibold text-gray-900 tracking-tight">Token 用量估算</h2><p className="text-sm text-gray-400">输入预期 Token 用量，基于 OpenRouter 公开定价估算各模型费用</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {([
            { label: '输入 Token 数', value: inputTokens, setter: setInputTokens, icon: ArrowDownToLine, cls: { text: 'text-blue-500', accent: 'accent-blue-500', focus: 'focus:border-blue-400' } },
            { label: '输出 Token 数', value: outputTokens, setter: setOutputTokens, icon: ArrowUpFromLine, cls: { text: 'text-emerald-500', accent: 'accent-emerald-500', focus: 'focus:border-emerald-400' } },
          ] as const).map(({ label, value, setter, icon: Icon, cls }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.5} />{label}
                </label>
                <span className={`text-sm font-mono font-semibold ${cls.text}`}>{fmtTokens(value)}</span>
              </div>
              <input type="range" min={100} max={2_000_000} step={100} value={value}
                onChange={e => { setter(Number(e.target.value)); setActivePreset('') }}
                className={`w-full h-1.5 rounded-full bg-gray-200 appearance-none cursor-pointer ${cls.accent}`}
              />
              <input type="number" value={value} onChange={e => { setter(Math.max(0, Number(e.target.value) || 0)); setActivePreset('') }}
                className={`w-full mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm text-center focus:outline-none ${cls.focus} focus:bg-white transition-all`} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-400 self-center mr-1">快捷预设:</span>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => { setInputTokens(p.input); setOutputTokens(p.output); setActivePreset(p.label) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePreset === p.label ? 'bg-blue-50 text-blue-500 border border-blue-200' : 'bg-gray-50 text-gray-400 border border-gray-200 hover:border-gray-300'}`}
              title={p.desc}>{p.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center"><div className="text-2xl font-bold text-emerald-500">{stats.free}</div><div className="text-xs text-gray-400 mt-0.5">免费模型 (共 {stats.total} 个)</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-gray-900">${stats.cheapestCost.toFixed(6)}</div><div className="text-xs text-gray-400 mt-0.5">最低预估费用 ({stats.cheapestName})</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-gray-900">{fmtTokens(inputTokens + outputTokens)}</div><div className="text-xs text-gray-400 mt-0.5">总 Token 量</div></div>
        </div>
      </div>

      {/* Cost Chart */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-500" strokeWidth={1.5} /></div>
          <div><h2 className="text-lg font-semibold text-gray-900 tracking-tight">费用对比（付费模型 Top 15）</h2><p className="text-sm text-gray-400">基于 {fmtTokens(inputTokens)} 输入 + {fmtTokens(outputTokens)} 输出 token 估算 · 已排除免费模型</p></div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 130, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" stroke="#9ca3af" fontSize={11} tickFormatter={(v: number) => (v === 0 ? '$0' : `$${v.toFixed(4)}`)} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={125} tick={{ fill: '#6b7280' }} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', color: '#1f2937', fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                formatter={(value: number) => [value === 0 ? '免费' : `$${value.toFixed(6)}`, '预估费用']} labelFormatter={(label: string) => label} />
              <Bar dataKey="cost" radius={[0, 6, 6, 0]} maxBarSize={18}>
                {chartData.map((entry, i) => (<Cell key={i} fill={entry.isFree ? '#10b981' : (PROVIDER_COLORS[entry.provider] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length])} fillOpacity={entry.isFree ? 1 : 0.8} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="py-16 text-center text-gray-300">暂无数据</div>}
      </div>

      {/* Pricing Table */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div><h2 className="text-lg font-semibold text-gray-900 tracking-tight">全部模型定价表</h2><p className="text-sm text-gray-400">基于 {fmtTokens(inputTokens)} 输入 / {fmtTokens(outputTokens)} 输出 token 的实时估算 · 数据来源 OpenRouter</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              placeholder="搜索模型或提供商..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer">
            {providerOptions.map(p => (<option key={p} value={p}>{p === '全部' ? '全部提供商' : p}</option>))}
          </select>
          <button onClick={() => setOnlyFree(!onlyFree)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${onlyFree ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>
            <Zap className="w-4 h-4" />仅免费</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                {[['模型', 'name'], ['上下文', 'contextLength'], ['输入 $/1M', 'inputPrice'], ['输出 $/1M', 'outputPrice'], ['预估费用', 'estimatedCost']].map(([label, field]) => (
                  <th key={label} className={`py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none`} onClick={() => field && toggleSort(field as SortField)}>
                    <span className="inline-flex items-center gap-1">{label} {field ? <SortIcon field={field as SortField} /> : null}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pr-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{m.name[0]}</div><div><div className="flex items-center gap-1.5"><span className="text-gray-900 font-medium">{m.name}</span>{m.isFree && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200">免费</span>}</div><span className="text-xs text-gray-400">{m.provider_display}</span></div></div></td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">{fmtContext(m.context_length)}</td>
                  <td className="py-3 px-4"><span className={m.inputPricePerM === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>{m.inputPricePerM === 0 ? '免费' : `$${m.inputPricePerM.toFixed(2)}`}</span></td>
                  <td className="py-3 px-4"><span className={m.outputPricePerM === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>{m.outputPricePerM === 0 ? '免费' : `$${m.outputPricePerM.toFixed(2)}`}</span></td>
                  <td className="py-3 px-4"><span className={`font-mono text-xs font-semibold ${m.estimatedCost === 0 ? 'text-emerald-500' : m.estimatedCost < 0.01 ? 'text-emerald-600' : 'text-gray-900'}`}>{m.estimatedCost === 0 ? '免费' : `$${m.estimatedCost.toFixed(6)}`}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (<div className="text-center py-16 text-gray-300">没有找到匹配的模型</div>)}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Model Directory Tab — system model catalog from our DB
// ═══════════════════════════════════════════════

interface SystemModel {
  id: string
  name: string
  model_id: string
  provider_name: string
  provider_name_cn?: string
  provider_slug: string
  series_name?: string
  context_window: number
  max_output_tokens: number
  pricing_input_cents: number
  pricing_output_cents: number
  capabilities: Record<string, boolean> | null
  status: string
}

function useSystemModels() {
  const [models, setModels] = useState<SystemModel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/v1/models/public?limit=200')
      .then(r => r.json())
      .then((res) => {
        if (res.status === 'success') setModels(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Derive provider list from models data (no auth required)
  const providers = useMemo(() => {
    const map = new Map<string, { name: string; name_cn: string; count: number }>()
    for (const m of models) {
      const existing = map.get(m.provider_slug)
      if (existing) { existing.count++ } else {
        map.set(m.provider_slug, { name: m.provider_name, name_cn: m.provider_name_cn || m.provider_name, count: 1 })
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([slug, { name, name_cn, count }]) => ({ id: slug, slug, name, name_cn, model_count: count }))
  }, [models])

  return { models, providers, loading }
}

function ModelDirectoryTab() {
  const { models, providers, loading } = useSystemModels()
  const [providerFilter, setProviderFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    let list = models
    if (providerFilter) list = list.filter(m => m.provider_slug === providerFilter)
    if (statusFilter) list = list.filter(m => m.status === statusFilter)
    return list
  }, [models, providerFilter, statusFilter])

  const activeCount = models.filter(m => m.status === 'active').length
  const freeCount = models.filter(m => Number(m.pricing_input_cents) === 0 && Number(m.pricing_output_cents) === 0).length
  const providerCount = providers.length

  const statusBadge = (status: string) => {
    if (status === 'active') return <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium">可用</span>
    if (status === 'beta') return <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-600 border border-amber-200 font-medium">Beta</span>
    if (status === 'coming_soon') return <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 text-purple-500 border border-purple-200 font-medium">即将上线</span>
    return <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-50 text-gray-400 border border-gray-200">{status}</span>
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: '收录模型', value: models.length, color: 'text-blue-500' },
          { label: '国产可用', value: activeCount, color: 'text-emerald-500' },
          { label: '免费模型', value: freeCount, color: 'text-amber-500' },
          { label: '厂商', value: providerCount, color: 'text-purple-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className={`text-xl font-bold ${color}`}>{loading ? '-' : value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5">
        <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:border-blue-400 cursor-pointer">
          <option value="">全部厂商</option>
          {providers.map(p => <option key={p.id} value={p.slug}>{p.name_cn || p.name} ({p.model_count})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:border-blue-400 cursor-pointer">
          <option value="">全部状态</option>
          <option value="active">可用</option>
          <option value="beta">Beta</option>
          <option value="coming_soon">即将上线</option>
        </select>
        {(providerFilter || statusFilter) && (
          <button onClick={() => { setProviderFilter(''); setStatusFilter('') }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" /> 清除
          </button>
        )}
        <div className="flex-1" />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="animate-pulse rounded-full bg-gray-100 size-8 shrink-0" />
                <div className="flex-1 space-y-2"><div className="animate-pulse rounded bg-gray-100 h-4 w-1/3" /><div className="animate-pulse rounded bg-gray-100 h-3 w-1/5" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-300">暂无匹配模型</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 pl-5 pr-4 font-medium">模型</th>
                <th className="py-3 px-4 font-medium">厂商</th>
                <th className="py-3 px-4 font-medium">上下文</th>
                <th className="py-3 px-4 font-medium">输入 / 1M tokens</th>
                <th className="py-3 px-4 font-medium">输出 / 1M tokens</th>
                <th className="py-3 pr-5 pl-4 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m: SystemModel) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pl-5 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="size-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{m.name[0]}</div>
                      <div>
                        <div className="text-gray-900 font-medium text-sm max-w-[200px] truncate" title={m.name}>{m.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{m.model_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm">{m.provider_name}</td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-xs">{m.context_window ? fmtContext(m.context_window) : '-'}</td>
                  <td className="py-3 px-4"><span className={Number(m.pricing_input_cents) === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>{Number(m.pricing_input_cents) === 0 ? '免费' : fmtPriceRmb(Number(m.pricing_input_cents))}</span></td>
                  <td className="py-3 px-4"><span className={Number(m.pricing_output_cents) === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>{Number(m.pricing_output_cents) === 0 ? '免费' : fmtPriceRmb(Number(m.pricing_output_cents))}</span></td>
                  <td className="py-3 pr-5 pl-4">{statusBadge(m.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>数据来源: 系统模型目录 · 共收录 {models.length} 个模型 · 每小时自动同步 OpenRouter 新模型</span>
        <a href="http://localhost:3001/models" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
          Console 管理 <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// Main Explore Page
// ═══════════════════════════════════════════════

export default function Explore() {
  const [tab, setTab] = useState<Tab>('rankings')

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">模型探索</h1>
          <p className="text-gray-400 text-sm">
            浏览模型排行榜，估算调用成本，查看系统模型目录。
          </p>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { key: 'rankings' as Tab, label: '模型排行榜', icon: Crown },
            { key: 'calculator' as Tab, label: '费用估算', icon: CalculatorIcon },
            { key: 'directory' as Tab, label: '模型目录', icon: Database },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            ><Icon className="w-4 h-4" strokeWidth={1.5} />{label}</button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'rankings' && <RankingsTab />}
      {tab === 'calculator' && <CalculatorTab />}
      {tab === 'directory' && <ModelDirectoryTab />}
    </div>
  )
}

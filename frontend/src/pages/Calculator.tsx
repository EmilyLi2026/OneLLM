import { useState, useMemo } from 'react'
import { models } from '../mock/models'
import {
  Search,
  Calculator as CalculatorIcon,
  DollarSign,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
  Star,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// ---------- helpers ----------

function formatPrice(price: number): string {
  if (price === 0) return '免费'
  return `$${price.toFixed(2)}`
}

function formatContextLength(len: number): string {
  if (len === 0) return '-'
  if (len >= 1_000_000) return `${(len / 1_000_000).toFixed(0)}M`
  if (len >= 1_000) return `${(len / 1_000).toFixed(0)}K`
  return String(len)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function calcCost(
  inputTokens: number,
  outputTokens: number,
  inputPrice: number,
  outputPrice: number,
): number {
  return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000
}

type SortField = 'name' | 'inputPrice' | 'outputPrice' | 'contextLength' | 'estimatedCost' | 'rating'

const PRESETS = [
  { label: '短对话', input: 1_000, output: 500, desc: '~1K 输入 / 500 输出' },
  { label: '中等任务', input: 5_000, output: 2_000, desc: '~5K 输入 / 2K 输出' },
  { label: '长文档', input: 50_000, output: 10_000, desc: '~50K 输入 / 10K 输出' },
  { label: '大批量', input: 500_000, output: 200_000, desc: '~500K 输入 / 200K 输出' },
]

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: '#10b981',
  Anthropic: '#d97706',
  Google: '#4285f4',
  Meta: '#1877f2',
  DeepSeek: '#6366f1',
  Alibaba: '#f97316',
  'Mistral AI': '#ca8a04',
  Cohere: '#8b5cf6',
  'Stability AI': '#ec4899',
}

const FALLBACK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
]

// ---------- component ----------

export default function Calculator() {
  const [inputTokens, setInputTokens] = useState(5000)
  const [outputTokens, setOutputTokens] = useState(2000)
  const [activePreset, setActivePreset] = useState<string>('中等任务')

  const [search, setSearch] = useState('')
  const [onlyFree, setOnlyFree] = useState(false)
  const [sortField, setSortField] = useState<SortField>('estimatedCost')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState('全部')

  const providers = useMemo(
    () => ['全部', ...Array.from(new Set(models.map((m) => m.provider)))],
    [],
  )

  const modelCosts = useMemo(() => {
    return models.map((m) => ({
      ...m,
      estimatedCost: calcCost(inputTokens, outputTokens, m.inputPrice, m.outputPrice),
    }))
  }, [inputTokens, outputTokens])

  const filtered = useMemo(() => {
    let list = [...modelCosts]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.description.includes(q),
      )
    }
    if (onlyFree) list = list.filter((m) => m.isFree)
    if (selectedProvider !== '全部') list = list.filter((m) => m.provider === selectedProvider)

    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'inputPrice': cmp = a.inputPrice - b.inputPrice; break
        case 'outputPrice': cmp = a.outputPrice - b.outputPrice; break
        case 'contextLength': cmp = a.contextLength - b.contextLength; break
        case 'estimatedCost': cmp = a.estimatedCost - b.estimatedCost; break
        case 'rating': cmp = a.rating - b.rating; break
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [search, onlyFree, selectedProvider, sortField, sortAsc, modelCosts])

  const chartData = useMemo(() => {
    return [...modelCosts]
      .sort((a, b) => a.estimatedCost - b.estimatedCost)
      .slice(0, 15)
      .map((m) => ({
        name: m.name,
        cost: Number(m.estimatedCost.toFixed(6)),
        provider: m.provider,
        isFree: m.isFree,
      }))
  }, [modelCosts])

  const stats = useMemo(() => {
    const free = models.filter((m) => m.isFree).length
    const cheapest = [...models].sort((a, b) => {
      const ca = calcCost(inputTokens, outputTokens, a.inputPrice, a.outputPrice)
      const cb = calcCost(inputTokens, outputTokens, b.inputPrice, b.outputPrice)
      return ca - cb
    })[0]
    return {
      free,
      total: models.length,
      cheapestName: cheapest.name,
      cheapestCost: calcCost(inputTokens, outputTokens, cheapest.inputPrice, cheapest.outputPrice),
    }
  }, [inputTokens, outputTokens])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.5} />
    return sortAsc ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-500" strokeWidth={1.5} />
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Token 用量估算</h1>
        <p className="text-gray-400">输入预期 Token 用量，实时估算各模型费用并对比性价比。实际计费请参考 <a href="/pricing" className="text-blue-500 hover:underline">定价页</a>。</p>
      </div>

      {/* ==================== ESTIMATOR ==================== */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Token 用量估算</h2>
            <p className="text-sm text-gray-400">输入你预期的 Token 用量，自动计算每个模型的费用</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-500 font-medium">输入 Token 数</label>
              <span className="text-sm text-blue-500 font-mono font-semibold">{formatTokens(inputTokens)}</span>
            </div>
            <input
              type="range" min={100} max={2_000_000} step={100}
              value={inputTokens}
              onChange={(e) => { setInputTokens(Number(e.target.value)); setActivePreset('') }}
              className="w-full h-1.5 rounded-full bg-gray-200 appearance-none cursor-pointer accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-sm"
            />
            <div className="flex items-center mt-2">
              <input
                type="number"
                value={inputTokens}
                onChange={(e) => { setInputTokens(Math.max(0, Number(e.target.value) || 0)); setActivePreset('') }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm text-center focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-500 font-medium">输出 Token 数</label>
              <span className="text-sm text-emerald-500 font-mono font-semibold">{formatTokens(outputTokens)}</span>
            </div>
            <input
              type="range" min={100} max={2_000_000} step={100}
              value={outputTokens}
              onChange={(e) => { setOutputTokens(Number(e.target.value)); setActivePreset('') }}
              className="w-full h-1.5 rounded-full bg-gray-200 appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-sm"
            />
            <div className="flex items-center mt-2">
              <input
                type="number"
                value={outputTokens}
                onChange={(e) => { setOutputTokens(Math.max(0, Number(e.target.value) || 0)); setActivePreset('') }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm text-center focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-400 self-center mr-1">快捷预设:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setInputTokens(p.input); setOutputTokens(p.output); setActivePreset(p.label) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === p.label
                  ? 'bg-blue-50 text-blue-500 border border-blue-200'
                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:border-gray-300'
              }`}
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">{stats.free}</div>
            <div className="text-xs text-gray-400 mt-0.5">免费模型 (共 {stats.total} 个)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">${stats.cheapestCost.toFixed(6)}</div>
            <div className="text-xs text-gray-400 mt-0.5">最低预估费用 ({stats.cheapestName})</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{formatTokens(inputTokens + outputTokens)}</div>
            <div className="text-xs text-gray-400 mt-0.5">总 Token 量</div>
          </div>
        </div>
      </div>

      {/* ==================== CHART ==================== */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">费用对比（最便宜 Top 15）</h2>
            <p className="text-sm text-gray-400">基于 {formatTokens(inputTokens)} 输入 + {formatTokens(outputTokens)} 输出 token 估算</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" stroke="#9ca3af" fontSize={11} tickFormatter={(v: number) => (v === 0 ? '$0' : `$${v.toFixed(4)}`)} />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={95} tick={{ fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                color: '#1f2937',
                fontSize: '13px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
              formatter={(value: number) => [value === 0 ? '免费' : `$${value.toFixed(6)}`, '预估费用']}
              labelFormatter={(label: string) => {
                const m = models.find((x) => x.name === label)
                return `${label} · ${m?.provider ?? ''}`
              }}
            />
            <Bar dataKey="cost" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isFree ? '#10b981' : (PROVIDER_COLORS[entry.provider] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length])}
                  fillOpacity={entry.isFree ? 1 : 0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          {Array.from(new Set(chartData.map((d) => d.provider))).map((provider) => (
            <div key={provider} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PROVIDER_COLORS[provider] ?? '#6b7280' }} />
              {provider}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />免费
          </div>
        </div>
      </div>

      {/* ==================== PRICING TABLE ==================== */}
      <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-500" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">全部模型定价表</h2>
              <p className="text-sm text-gray-400">基于 {formatTokens(inputTokens)} 输入 / {formatTokens(outputTokens)} 输出 token 的实时估算</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
            价格单位: $/1M tokens
          </div>
        </div>

        {/* Table filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={1.5} />
            <input
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all"
              placeholder="搜索模型或提供商..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            {providers.map((p) => (
              <option key={p} value={p}>{p === '全部' ? '全部提供商' : p}</option>
            ))}
          </select>
          <button
            onClick={() => setOnlyFree(!onlyFree)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
              onlyFree
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Zap className="w-4 h-4" strokeWidth={1.5} />仅免费
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-3 pr-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('name')}>
                  <span className="inline-flex items-center gap-1">模型 <SortIcon field="name" /></span>
                </th>
                <th className="py-3 px-4 font-medium">类别</th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('contextLength')}>
                  <span className="inline-flex items-center gap-1">上下文 <SortIcon field="contextLength" /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('inputPrice')}>
                  <span className="inline-flex items-center gap-1">输入价格 <SortIcon field="inputPrice" /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('outputPrice')}>
                  <span className="inline-flex items-center gap-1">输出价格 <SortIcon field="outputPrice" /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('estimatedCost')}>
                  <span className="inline-flex items-center gap-1">预估费用 <SortIcon field="estimatedCost" /></span>
                </th>
                <th className="py-3 pl-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('rating')}>
                  <span className="inline-flex items-center gap-1">评分 <SortIcon field="rating" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((model) => (
                <tr key={model.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {model.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-900 font-medium">{model.name}</span>
                          {model.isFree && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200">免费</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{model.provider}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 text-xs rounded-md bg-gray-50 text-gray-400">{model.category}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">{formatContextLength(model.contextLength)}</td>
                  <td className="py-3 px-4">
                    <span className={model.inputPrice === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>
                      {formatPrice(model.inputPrice)}{model.inputPrice > 0 && <span className="text-gray-300 text-xs">/M</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={model.outputPrice === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>
                      {formatPrice(model.outputPrice)}{model.outputPrice > 0 && <span className="text-gray-300 text-xs">/M</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-mono text-xs font-semibold ${model.estimatedCost === 0 ? 'text-emerald-500' : model.estimatedCost < 0.01 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {model.estimatedCost === 0 ? '免费' : `$${model.estimatedCost.toFixed(6)}`}
                    </span>
                  </td>
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" strokeWidth={1.5} />
                      <span className="text-gray-500 text-xs">{model.rating}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-300">没有找到匹配的模型，换个筛选条件试试</div>
          )}
        </div>
      </div>
    </div>
  )
}

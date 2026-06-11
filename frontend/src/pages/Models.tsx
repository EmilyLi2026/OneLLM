import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, X, Star, ExternalLink, ChevronDown, ArrowUpDown } from 'lucide-react'

// ── API Types ──
interface ModelSpec {
  id: string
  name: string
  model_id: string
  provider_id: string
  provider_name: string
  provider_slug: string
  series_id?: string
  series_name?: string
  description?: string
  context_window: number
  max_output_tokens: number
  pricing_input_cents: number
  pricing_output_cents: number
  capabilities: Record<string, boolean> | null
  status: string
  released_at?: string
  is_system: number
}

interface Provider {
  id: string
  name: string
  slug: string
  name_cn?: string
}

interface Series {
  id: string
  name: string
  slug: string
}

interface ApiResponse<T> {
  status: string
  data: T
}

// ── Helpers ──
function fmtPrice(cents: number | string): string {
  const n = Number(cents)
  if (n === 0 || isNaN(n)) return '免费'
  return `¥${(n / 100).toFixed(2)}`
}

function fmtContext(len: number): string {
  if (!len) return '-'
  if (len >= 1_000_000) return `${(len / 1_000_000).toFixed(0)}M`
  if (len >= 1_000) return `${(len / 1_000).toFixed(0)}K`
  return String(len)
}

function fmtTokens(n: number): string {
  if (!n) return '-'
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

const STATUS_TAGS: Record<string, { label: string; cls: string }> = {
  active: { label: '可用', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  beta: { label: 'Beta', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  coming_soon: { label: '即将上线', cls: 'bg-purple-50 text-purple-500 border-purple-200' },
  deprecated: { label: '已弃用', cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}

const CAP_LABELS: Record<string, string> = {
  function_calling: '函数调用',
  vision: '视觉',
  long_context: '长上下文',
  image_generation: '图像生成',
  audio: '音频',
  video: '视频生成',
  embedding: '嵌入',
}

// ── Component ──
export default function Models() {
  const [models, setModels] = useState<ModelSpec[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState<'name' | 'inputPrice' | 'outputPrice' | 'context'>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedModel, setSelectedModel] = useState<ModelSpec | null>(null)

  // Fetch models
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (providerFilter) params.set('provider_id', providerFilter)
    if (seriesFilter) params.set('series_id', seriesFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)

    fetch(`/api/v1/models/public?${params}`)
      .then(r => r.json())
      .then((d: ApiResponse<ModelSpec[]>) => {
        if (d.status === 'success') setModels(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [search, providerFilter, seriesFilter, statusFilter])

  // Fetch providers & series for filters
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/models/providers').then(r => r.json()).catch(() => ({ status: 'error', data: [] })),
      fetch('/api/v1/models/series').then(r => r.json()).catch(() => ({ status: 'error', data: [] })),
    ]).then(([pRes, sRes]) => {
      if (pRes.status === 'success') setProviders(pRes.data)
      if (sRes.status === 'success') setSeries(sRes.data)
    })
  }, [])

  // Sort
  const sorted = useMemo(() => {
    const list = [...models]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'inputPrice': cmp = (a.pricing_input_cents || 0) - (b.pricing_input_cents || 0); break
        case 'outputPrice': cmp = (a.pricing_output_cents || 0) - (b.pricing_output_cents || 0); break
        case 'context': cmp = (a.context_window || 0) - (b.context_window || 0); break
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [models, sortField, sortAsc])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />
    return sortAsc
      ? <ChevronDown className="w-3 h-3 text-blue-500" />
      : <ChevronDown className="w-3 h-3 text-blue-500 rotate-180" />
  }

  // Stats
  const stats = useMemo(() => {
    const active = models.filter(m => m.status === 'active').length
    const free = models.filter(m => Number(m.pricing_input_cents) === 0 && Number(m.pricing_output_cents) === 0).length
    const providerCount = new Set(models.map(m => m.provider_slug)).size
    return { total: models.length, active, free, providerCount }
  }, [models])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">模型目录</h1>
        <p className="text-gray-400">
          系统内置 {stats.total} 个模型规格，覆盖 {stats.providerCount} 家厂商。
          支持搜索、筛选和多维度排序。
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: '系统模型', value: stats.total, color: 'text-blue-500' },
          { label: '可用', value: stats.active, color: 'text-emerald-500' },
          { label: '免费模型', value: stats.free, color: 'text-amber-500' },
          { label: '厂商', value: stats.providerCount, color: 'text-purple-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all"
            placeholder="搜索模型名称..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          <option value="">全部厂商</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.name_cn || p.name}</option>
          ))}
        </select>

        <select
          value={seriesFilter}
          onChange={e => setSeriesFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          <option value="">全部能力类型</option>
          {series.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          <option value="">全部状态</option>
          <option value="active">可用</option>
          <option value="beta">Beta</option>
          <option value="coming_soon">即将上线</option>
        </select>

        {(providerFilter || seriesFilter || statusFilter) && (
          <button
            onClick={() => { setProviderFilter(''); setSeriesFilter(''); setStatusFilter('') }}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> 清除筛选
          </button>
        )}
      </div>

      {/* Detail Panel */}
      {selectedModel && (
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-sm mb-6 relative">
          <button
            onClick={() => setSelectedModel(null)}
            className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg font-bold text-gray-600">
              {selectedModel.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{selectedModel.name}</h3>
                <span className="text-sm text-gray-400">{selectedModel.model_id}</span>
                {STATUS_TAGS[selectedModel.status] && (
                  <span className={`px-2 py-0.5 text-xs rounded-md border ${STATUS_TAGS[selectedModel.status].cls}`}>
                    {STATUS_TAGS[selectedModel.status].label}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3">
                {selectedModel.provider_name || selectedModel.provider_slug}
                {selectedModel.series_name && ` · ${selectedModel.series_name}`}
              </p>
              <div className="grid grid-cols-4 gap-4">
                <div><div className="text-xs text-gray-400">上下文窗口</div><div className="text-sm font-semibold text-gray-700">{fmtContext(selectedModel.context_window)}</div></div>
                <div><div className="text-xs text-gray-400">最大输出</div><div className="text-sm font-semibold text-gray-700">{fmtTokens(selectedModel.max_output_tokens)}</div></div>
                <div><div className="text-xs text-gray-400">输入价格 / 1M tokens</div><div className="text-sm font-semibold text-gray-700">{fmtPrice(selectedModel.pricing_input_cents)}</div></div>
                <div><div className="text-xs text-gray-400">输出价格 / 1M tokens</div><div className="text-sm font-semibold text-gray-700">{fmtPrice(selectedModel.pricing_output_cents)}</div></div>
              </div>
              {selectedModel.capabilities && Object.keys(selectedModel.capabilities).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(selectedModel.capabilities).map(([k, v]) =>
                    v ? <span key={k} className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-500 border border-blue-100">{CAP_LABELS[k] || k}</span> : null
                  )}
                </div>
              )}
              {selectedModel.description && (
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{selectedModel.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Models Table */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="animate-pulse rounded-full bg-gray-100 size-9 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="animate-pulse rounded bg-gray-100 h-4 w-1/3" />
                  <div className="animate-pulse rounded bg-gray-100 h-3 w-1/5" />
                </div>
                <div className="animate-pulse rounded bg-gray-100 h-4 w-16" />
                <div className="animate-pulse rounded bg-gray-100 h-4 w-16" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            <Filter className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p>没有找到匹配的模型，换个筛选条件试试</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 pr-4 pl-5 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('name')}>
                  <span className="inline-flex items-center gap-1">模型名称 <SortIcon field="name" /></span>
                </th>
                <th className="py-3 px-4 font-medium">厂商</th>
                <th className="py-3 px-4 font-medium">能力类型</th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('context')}>
                  <span className="inline-flex items-center gap-1">上下文 <SortIcon field="context" /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('inputPrice')}>
                  <span className="inline-flex items-center gap-1">输入/1M <SortIcon field="inputPrice" /></span>
                </th>
                <th className="py-3 px-4 font-medium cursor-pointer hover:text-gray-600 select-none" onClick={() => toggleSort('outputPrice')}>
                  <span className="inline-flex items-center gap-1">输出/1M <SortIcon field="outputPrice" /></span>
                </th>
                <th className="py-3 pl-4 pr-5 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(model => {
                const isSelected = selectedModel?.id === model.id
                return (
                  <tr
                    key={model.id}
                    onClick={() => setSelectedModel(isSelected ? null : model)}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="py-3 pr-4 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {model.name[0]}
                        </div>
                        <div>
                          <div className="text-gray-900 font-medium">{model.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{model.model_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{model.provider_name || model.provider_slug}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{model.series_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">{fmtContext(model.context_window)}</td>
                    <td className="py-3 px-4">
                      <span className={Number(model.pricing_input_cents) === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>
                        {fmtPrice(model.pricing_input_cents)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={Number(model.pricing_output_cents) === 0 ? 'text-emerald-500 font-medium' : 'text-gray-600'}>
                        {fmtPrice(model.pricing_output_cents)}
                      </span>
                    </td>
                    <td className="py-3 pl-4 pr-5">
                      {STATUS_TAGS[model.status] ? (
                        <span className={`px-2 py-0.5 text-xs rounded-md border ${STATUS_TAGS[model.status].cls}`}>
                          {STATUS_TAGS[model.status].label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{model.status}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
        <span>数据来源: 系统模型目录 · 共收录 {models.length} 个模型 · 支持用户自建模型</span>
        <span className="flex items-center gap-1">
          管理控制台:{' '}
          <a href="http://localhost:3001/models" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
            管理模型 <ExternalLink className="w-3 h-3" />
          </a>
        </span>
      </div>
    </div>
  )
}

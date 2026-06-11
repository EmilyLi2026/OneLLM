import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input, Button, Select, Card, Typography, Space, Tag, Spin, Divider, message, Switch } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, ThunderboltOutlined, ClearOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { api } from '../api/client'

interface ChatMsg {
  id: string; role: 'user' | 'assistant'
  content: string; tokens?: { input: number; output: number }
}

interface KeyOption {
  id: string; name: string; key_prefix: string; binding_count: number
}

interface BindingInfo {
  id: string; provider_name: string; priority_order: number
  allowed_models: string[] | null
}

interface ModelInfo {
  model_id: string; provider_model_id: string | null; name: string
  provider_slug: string; provider_name_cn: string | null
  context_window: number
  pricing_input_cents: number; pricing_output_cents: number
  capabilities: Record<string, boolean>
  series_name: string | null
}

export function PlaygroundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isKeyTest = location.pathname === '/keys/test';

  const [keys, setKeys] = useState<KeyOption[]>([])
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [bindings, setBindings] = useState<BindingInfo[]>([])
  const [selectedBindingId, setSelectedBindingId] = useState('')
  const [catalogProviders, setCatalogProviders] = useState<any[]>([])
  const [allModels, setAllModels] = useState<ModelInfo[]>([])
  const [model, setModel] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokens, setTokens] = useState({ in: 0, out: 0 })
  const [streamMode, setStreamMode] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // ── Load keys + catalog ──
  useEffect(() => {
    api.get('/keys').then(r => {
      const list = (r.data.data || []) as KeyOption[]
      setKeys(list)
      if (list.length > 0) {
        const first = list.find(k => k.binding_count > 0) || list[0]
        setSelectedKeyId(first.id)
      }
    }).catch(() => message.error('加载 API Key 失败'))

    api.get('/models/providers').then(r => setCatalogProviders(r.data.data || [])).catch(() => {})
    api.get('/models', { params: { limit: 500, status: 'active' } }).then(r => {
      const models: ModelInfo[] = (r.data.data?.models || []).map((m: any) => ({
        model_id: m.model_id,
        provider_model_id: m.provider_model_id || null,
        name: m.name,
        provider_slug: m.provider?.slug || '',
        provider_name_cn: m.provider?.name_cn || null,
        context_window: m.context_window || 0,
        pricing_input_cents: Number(m.pricing?.input_cents || 0),
        pricing_output_cents: Number(m.pricing?.output_cents || 0),
        capabilities: m.capabilities || {},
        series_name: m.series?.name || null,
      }))
      setAllModels(models)
    }).catch(() => {})
  }, [])

  // ── Load bindings when key changes ──
  useEffect(() => {
    if (!selectedKeyId) { setBindings([]); return }
    api.get(`/keys/${selectedKeyId}/bindings`).then(r => {
      const list = (r.data.data || []) as BindingInfo[]
      setBindings(list)
      if (list.length > 0) setSelectedBindingId(list[0].id)
      else setSelectedBindingId('')
    }).catch(() => setBindings([]))
  }, [selectedKeyId])

  // ── Derived state ──
  const selectedBinding = bindings.find(b => b.id === selectedBindingId)
  const boundProviderSlug = selectedBinding?.provider_name || null

  // Models available for the selected binding's provider.
  // Constrained to binding.allowed_models when configured (matches both model_id and provider_model_id).
  // Deduplicate by provider_model_id: prefer OpenRouter-synced entries (model_id contains '/'),
  // falling back to the entry with the most complete data.
  const availableModels = useMemo(() => {
    if (!boundProviderSlug) return []
    let candidates = allModels.filter(m =>
      m.provider_slug === boundProviderSlug && m.provider_model_id
    )
    // ── Respect the binding's allowed_models white-list ──
    const allowed = selectedBinding?.allowed_models
    if (allowed && allowed.length > 0) {
      const allowedSet = new Set(allowed)
      candidates = candidates.filter(m =>
        allowedSet.has(m.model_id) || allowedSet.has(m.provider_model_id || '')
      )
    }
    const deduped = new Map<string, ModelInfo>()
    for (const m of candidates) {
      const key = m.provider_model_id!
      const existing = deduped.get(key)
      if (!existing) {
        deduped.set(key, m)
      } else {
        // Prefer OpenRouter-synced entries (model_id contains '/') over seed data
        const existingIsSynced = existing.model_id.includes('/')
        const newIsSynced = m.model_id.includes('/')
        if (newIsSynced && !existingIsSynced) deduped.set(key, m)
      }
    }
    return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [boundProviderSlug, allModels, selectedBinding?.allowed_models])

  // Auto-select first model when binding changes
  useEffect(() => {
    if (availableModels.length > 0) {
      const currentExists = availableModels.find(m => m.provider_model_id === model)
      if (!currentExists) setModel(availableModels[0].provider_model_id || '')
    } else {
      setModel('')
    }
  }, [availableModels])

  // Provider display name lookup
  const providerLabel = (slug: string) => {
    const p = catalogProviders.find((x: any) => x.slug === slug)
    return p ? (p.name_cn || p.name) : slug
  }

  const selectedModelInfo = availableModels.find(m => m.provider_model_id === model)

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Send ──
  const handleSend = async () => {
    if (!input.trim() || !selectedKeyId || !model || !selectedBindingId || loading) return
    const um: ChatMsg = { id: 'u-' + Date.now(), role: 'user', content: input.trim() }
    setMessages(p => [...p, um]); setInput(''); setLoading(true)

    try {
      // Get the decrypted provider key for the selected binding
      const keyResp = await api.post('/internal/get-binding-key', { binding_id: selectedBindingId })
      const keyData = keyResp.data.data || {}
      const apiKey = keyData.api_key
      const gwProvider = keyData.provider_name || selectedBinding?.provider_name
      if (!apiKey) { message.error('无法获取 Provider Key'); setLoading(false); return }

      const msgs = [...messages, um].map(m => ({ role: m.role, content: m.content }))
      const gatewayUrl = 'http://localhost:9799/v1/chat/completions'

      const res = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onellm-api-key': apiKey,
          'x-onellm-provider': gwProvider,
          'x-portkey-api-key': apiKey, // legacy compat
        },
        body: JSON.stringify({ model, messages: msgs, stream: streamMode }),
      })

      if (streamMode) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        const amId = 'a-' + Date.now()
        setMessages(p => [...p, { id: amId, role: 'assistant', content: '' }])
        if (reader) {
          let done = false
          while (!done) {
            const { value, done: d } = await reader.read()
            done = d
            if (value) {
              const text = decoder.decode(value, { stream: true })
              for (const line of text.split('\n')) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const chunk = JSON.parse(line.slice(6))
                    fullContent += chunk.choices?.[0]?.delta?.content || ''
                    setMessages(p => p.map(m => m.id === amId ? { ...m, content: fullContent } : m))
                  } catch { /* skip malformed chunks */ }
                }
              }
            }
          }
        }
        setLoading(false)
      } else {
        const data = await res.json()
        // Gateway returns two error formats: { error: {...} } or { status: 'failure', message: '...' }
        const errorMsg = data.error?.message || (data.status === 'failure' && data.message) || null
        if (errorMsg) {
          setMessages(p => [...p, { id: 'err-' + Date.now(), role: 'assistant', content: `**${gwProvider} 错误:** ${errorMsg}` }])
        } else if (data.status === 'failure') {
          setMessages(p => [...p, { id: 'err-' + Date.now(), role: 'assistant', content: `**${gwProvider} 错误:** ${data.message || JSON.stringify(data)}` }])
        } else {
          const usage = data.usage
          const am: ChatMsg = {
            id: 'a-' + Date.now(), role: 'assistant',
            content: data.choices?.[0]?.message?.content || '(空响应)',
            tokens: usage ? { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 } : undefined,
          }
          setMessages(p => [...p, am])
          if (usage) setTokens(p => ({ in: p.in + (usage.prompt_tokens || 0), out: p.out + (usage.completion_tokens || 0) }))
        }
      }
    } catch (err: any) {
      setMessages(p => [...p, { id: 'err-' + Date.now(), role: 'assistant', content: '**网络错误:** ' + err.message }])
    } finally { if (!streamMode) setLoading(false) }
  }

  const hasBinding = bindings.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {isKeyTest && (
        <div style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/keys')}>
            返回 API Keys
          </Button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card size="small" title="配置">
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* Key selector */}
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>API Key</Typography.Text>
              <Select value={selectedKeyId} onChange={setSelectedKeyId} style={{ width: '100%' }} size="small"
                placeholder="选择 API Key"
                options={keys.map(k => ({
                  value: k.id,
                  label: `${k.name} (${k.key_prefix}...) ${k.binding_count > 0 ? `[${k.binding_count}]` : ''}`,
                }))} />
            </div>

            {/* Binding selector */}
            {bindings.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Provider 绑定
                </Typography.Text>
                <Select value={selectedBindingId} onChange={setSelectedBindingId}
                  style={{ width: '100%' }} size="small" placeholder="选择 Provider"
                  options={bindings.map(b => ({
                    value: b.id,
                    label: `${providerLabel(b.provider_name)} ${b.priority_order === 1 ? '(首选)' : `(备${b.priority_order})`}`,
                  }))} />
              </div>
            )}

            {/* Provider display — auto-determined from binding */}
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                模型厂商
                {hasBinding && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>由 Key 绑定</Tag>}
              </Typography.Text>
              <div style={{ padding: '5px 11px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#f5f5f5', fontSize: 14, color: '#000000d9' }}>
                {hasBinding
                  ? `${providerLabel(boundProviderSlug!)}（仅限已配置的模型）`
                  : <span style={{ color: '#bfbfbf' }}>请先选择有绑定的 Key</span>}
              </div>
            </div>

            {/* Model selector */}
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                模型型号
                {boundProviderSlug && <Tag style={{ marginLeft: 4, fontSize: 10 }}>{availableModels.length} 个</Tag>}
              </Typography.Text>
              <Select value={model || undefined} onChange={setModel} style={{ width: '100%' }} size="small"
                showSearch placeholder="选择模型"
                disabled={!boundProviderSlug}
                filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                options={availableModels.map(m => ({
                  value: m.provider_model_id || m.model_id,
                  label: `${m.name} (${m.provider_model_id})`,
                }))}
                notFoundContent={boundProviderSlug ? '无可用模型' : '请选择 Provider'} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>流式输出</Typography.Text>
              <Switch size="small" checked={streamMode} onChange={setStreamMode} />
            </div>
          </Space>
        </Card>

        {/* Model Info */}
        {selectedModelInfo && (
          <Card size="small" title="模型信息">
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              <Typography.Text>
                <Tag color="blue">{providerLabel(selectedModelInfo.provider_slug)}</Tag>
                {selectedModelInfo.series_name && <Tag>{selectedModelInfo.series_name}</Tag>}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                上下文: {selectedModelInfo.context_window ? `${(selectedModelInfo.context_window / 1000).toFixed(0)}K` : 'N/A'}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                价格: ¥{(selectedModelInfo.pricing_input_cents / 100).toFixed(2)} in
                / ¥{(selectedModelInfo.pricing_output_cents / 100).toFixed(2)} out / 1M tokens
              </Typography.Text>
            </Space>
          </Card>
        )}

        <Card size="small">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <ThunderboltOutlined /> 本次消耗
          </Typography.Text>
          <div><Typography.Text>Token: {tokens.in.toLocaleString()} in / {tokens.out.toLocaleString()} out</Typography.Text></div>
        </Card>

        <Button icon={<ClearOutlined />} size="small" danger
          onClick={() => { setMessages([]); setTokens({ in: 0, out: 0 }) }}>
          清空对话
        </Button>

        {/* Unbound key warning */}
        {selectedKeyId && !hasBinding && (
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            此 Key 尚未绑定任何 Provider。请先在「API Keys」页面展开该 Key 并添加 Provider 绑定。
          </Typography.Text>
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#1677ff' }} />
          <Typography.Text strong>模型测试 — Playground</Typography.Text>
          {selectedKeyId && <Tag color="green" style={{ marginLeft: 'auto' }}>已连接</Tag>}
          {selectedModelInfo && <Tag color="blue">{selectedModelInfo.provider_model_id || selectedModelInfo.model_id}</Tag>}
          {boundProviderSlug && <Tag>{providerLabel(boundProviderSlug)}</Tag>}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#fafafa' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#bbb', marginTop: 80 }}>
              <Typography.Title level={5} type="secondary">OneLLM 模型测试</Typography.Title>
              <Typography.Text type="secondary">
                选择已绑定 Provider 的 API Key → 自动锁定厂商和可用模型 → 输入消息开始测试
                <br />当前目录: {catalogProviders.length} 家厂商，{allModels.length} 个模型
              </Typography.Text>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: msg.role === 'user' ? '#f0f0f0' : '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined style={{ color: '#1677ff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>{msg.role === 'user' ? '你' : 'AI'}</Typography.Text>
                  {msg.tokens && <Typography.Text type="secondary" style={{ fontSize: 11 }}>in:{msg.tokens.input} out:{msg.tokens.output}</Typography.Text>}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {loading && <Spin tip="AI 思考中..." />}
          <div ref={msgEndRef} />
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={input} onChange={e => setInput(e.target.value)}
              onPressEnter={handleSend}
              placeholder={model ? `输入消息，向 ${model} 发送...` : hasBinding ? '已自动选择模型' : '请先选择有绑定的 Key'}
              disabled={!model} />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}
              disabled={!input.trim() || !model}>
              发送
            </Button>
          </Space.Compact>
        </div>
      </div>
    </div>
    </div>
  )
}

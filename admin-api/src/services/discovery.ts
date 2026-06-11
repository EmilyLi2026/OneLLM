/**
 * Model Discovery Service
 *
 * Fetches publicly available model data from OpenRouter's public API.
 * Supports both Chinese-provider-only and full international model discovery.
 *
 * Modes:
 *   mode=new (default): only models created within `days` window
 *   mode=all: all models regardless of creation date
 *
 * Provider filter:
 *   chineseOnly=true (default): only Chinese providers
 *   chineseOnly=false: all known providers (Chinese + international)
 */

// ── Chinese provider prefixes (model ID prefix → internal slug) ──
const CHINESE_PROVIDER_PREFIXES: Record<string, string> = {
  'deepseek/': 'deepseek',
  'qwen/': 'alibaba',
  'glm-': 'zhipu',
  'zhipu/': 'zhipu',
  'moonshot/': 'moonshot',      // legacy — OpenRouter now uses moonshotai/
  'moonshotai/': 'moonshot',    // current OpenRouter prefix for Kimi models
  'minimax/': 'minimax',
  'ernie/': 'baidu',
  'baidu/': 'baidu',
  'doubao/': 'bytedance',
  'bytedance/': 'bytedance',
  'bytedance-seed/': 'bytedance', // ByteDance Seed model series
  'spark/': 'xunfei',
  'yi-': 'lingyi',
  '01-ai/': 'lingyi',
  'baichuan/': 'baichuan',
  'hunyuan/': 'tencent',
  'tencent/': 'tencent',
  'step-': 'stepfun',
};

// ── International provider prefixes (model ID prefix → internal slug) ──
const INTERNATIONAL_PROVIDER_PREFIXES: Record<string, string> = {
  'openai/': 'openai',
  'anthropic/': 'anthropic',
  'google/': 'google',
  'meta-llama/': 'meta',
  'mistral/': 'mistral',
  'mistralai/': 'mistral',
  'cohere/': 'cohere',
  'amazon/': 'amazon',
  'nvidia/': 'nvidia',
  'x-ai/': 'xai',
  'perplexity/': 'perplexity',
  'together/': 'together',
  'together-ai/': 'together',
  'groq/': 'groq',
  'replicate/': 'replicate',
  'ai21/': 'ai21',
  'inflection/': 'inflection',
  'phind/': 'phind',
  'recursal/': 'recursal',
  'liquid/': 'liquid',
  'sao10k/': 'sao10k',
  'nousresearch/': 'nous',
  'gryphe/': 'gryphe',
  'teuken/': 'teuken',
  'mancer/': 'mancer',
  'cognitive/': 'cognitive',
  'neversleep/': 'neversleep',
  'elyza/': 'elyza',
  'thedrummer/': 'thedrummer',
  'undi95/': 'undi95',
  'featherless/': 'featherless',
  'infermatic/': 'infermatic',
};

// ── Provider slug → display info for UI ──
const PROVIDER_DISPLAY: Record<string, { name: string; name_cn: string; region: 'cn' | 'intl' }> = {
  deepseek:     { name: 'DeepSeek',     name_cn: '深度求索',   region: 'cn' },
  alibaba:      { name: 'Alibaba',      name_cn: '阿里云',     region: 'cn' },
  zhipu:        { name: 'Zhipu AI',     name_cn: '智谱AI',     region: 'cn' },
  moonshot:     { name: 'Moonshot AI',  name_cn: '月之暗面',   region: 'cn' },
  minimax:      { name: 'MiniMax',      name_cn: '稀宇科技',   region: 'cn' },
  baidu:        { name: 'Baidu',        name_cn: '百度智能云', region: 'cn' },
  bytedance:    { name: 'ByteDance',    name_cn: '字节跳动',   region: 'cn' },
  xunfei:       { name: 'iFLYTEK',      name_cn: '科大讯飞',   region: 'cn' },
  lingyi:       { name: '01.AI',        name_cn: '零一万物',   region: 'cn' },
  baichuan:     { name: 'Baichuan AI',  name_cn: '百川智能',   region: 'cn' },
  tencent:      { name: 'Tencent',      name_cn: '腾讯混元',   region: 'cn' },
  stepfun:      { name: 'StepFun',      name_cn: '阶跃星辰',   region: 'cn' },
  openai:       { name: 'OpenAI',       name_cn: 'OpenAI',     region: 'intl' },
  anthropic:    { name: 'Anthropic',    name_cn: 'Anthropic',  region: 'intl' },
  google:       { name: 'Google',       name_cn: 'Google',     region: 'intl' },
  meta:         { name: 'Meta',         name_cn: 'Meta',       region: 'intl' },
  mistral:      { name: 'Mistral AI',   name_cn: 'Mistral AI', region: 'intl' },
  cohere:       { name: 'Cohere',       name_cn: 'Cohere',     region: 'intl' },
  amazon:       { name: 'Amazon',       name_cn: 'Amazon',     region: 'intl' },
  nvidia:       { name: 'NVIDIA',       name_cn: 'NVIDIA',     region: 'intl' },
  xai:          { name: 'xAI',          name_cn: 'xAI',        region: 'intl' },
  perplexity:   { name: 'Perplexity',   name_cn: 'Perplexity', region: 'intl' },
  together:     { name: 'Together AI',  name_cn: 'Together',   region: 'intl' },
  groq:         { name: 'Groq',         name_cn: 'Groq',       region: 'intl' },
  replicate:    { name: 'Replicate',    name_cn: 'Replicate',  region: 'intl' },
  ai21:         { name: 'AI21 Labs',    name_cn: 'AI21 Labs',  region: 'intl' },
  inflection:   { name: 'Inflection',   name_cn: 'Inflection', region: 'intl' },
  phind:        { name: 'Phind',        name_cn: 'Phind',      region: 'intl' },
  liquid:       { name: 'Liquid AI',    name_cn: 'Liquid AI',  region: 'intl' },
};

// ── Capability tags derived from model properties ──
function deriveCapabilities(m: any): Record<string, boolean> {
  const caps: Record<string, boolean> = {};
  const arch = m.architecture || {};

  // Modality-based
  const modality = (arch.modality || '').toLowerCase();
  if (modality.includes('image')) caps.vision = true;
  if (modality.includes('text->image')) caps.image_generation = true;
  if (modality.includes('audio')) caps.audio = true;

  // Tool / function calling
  if (arch.tokenizer || m.top_provider?.supported_parameters) {
    const params = m.top_provider?.supported_parameters;
    if (params) {
      if (Array.isArray(params)) {
        if (params.includes('tools') || params.includes('functions')) caps.function_calling = true;
      }
    }
  }

  // Token counts hint at capabilities
  if (m.context_length >= 100000) caps.long_context = true;
  if (m.top_provider?.max_completion_tokens >= 16384) caps.large_output = true;

  return caps;
}

// ── Modality → series slug mapping ──
function modalityToSeries(modality: string | undefined): string | null {
  if (!modality) return null;
  const m = modality.toLowerCase();
  if (m.includes('text+image+audio') || m.includes('text+image->')) return 'multimodal';
  if (m.includes('text+image') && !m.includes('->image')) return 'visual';
  if (m === 'text->text') return 'text-generation';
  if (m.includes('text->image')) return 'image-generation';
  if (m.includes('text->audio') || m.includes('text->speech')) return 'audio';
  if (m.includes('text->video')) return 'video-generation';
  if (m.includes('embedding')) return 'embedding';
  return 'text-generation';
}

// ── Exported interface ──
export interface DiscoveredModel {
  id: string;
  name: string;
  provider_slug: string;
  provider_display: string;
  provider_region: 'cn' | 'intl';
  description: string;
  context_length: number;
  max_output_tokens: number;
  pricing: { prompt: string; completion: string };
  modality: string;
  series_slug: string | null;
  capabilities: Record<string, boolean>;
  created_at: number; // unix ts
}

export interface DiscoveryOptions {
  /** Only models created within this many days (ignored when mode='all') */
  days?: number;
  /** Filter to a specific provider slug */
  provider?: string;
  /** When true (default), only Chinese providers. When false, all known providers */
  chineseOnly?: boolean;
  /** 'new' = only recent models (default), 'all' = all models */
  mode?: 'new' | 'all';
}

// ── In-memory cache: always cache the FULL set, filter on read ──
let _cache: { data: DiscoveredModel[]; ts: number } | null = null;
const CACHE_TTL = 3600_000; // 1 hour

export async function discoverModels(opts: DiscoveryOptions = {}): Promise<DiscoveredModel[]> {
  const { days = 30, provider, chineseOnly = true, mode = 'new' } = opts;

  // Ensure cache always holds the FULL dataset (all providers), then filter on read
  if (!_cache || Date.now() - _cache.ts >= CACHE_TTL) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        if (_cache) return filterModels(_cache.data, mode === 'new' ? days : undefined, provider, chineseOnly);
        throw new Error(`OpenRouter API returned ${response.status}`);
      }

      const text = await response.text();
      const allModels = JSON.parse(text);
      const modelList: any[] = Array.isArray(allModels) ? allModels : (allModels.data || []);

      // Build combined prefix map (Chinese + International) for full coverage
      const prefixMap: Record<string, string> = {
        ...CHINESE_PROVIDER_PREFIXES,
        ...INTERNATIONAL_PROVIDER_PREFIXES,
      };

      const discovered: DiscoveredModel[] = [];

      for (const m of modelList) {
        const prefix = Object.keys(prefixMap).find(p => m.id?.startsWith(p));
        if (!prefix) continue;

        const providerSlug = prefixMap[prefix];
        const display = PROVIDER_DISPLAY[providerSlug] || { name: providerSlug, name_cn: providerSlug, region: 'intl' as const };

        discovered.push({
          id: m.id,
          name: m.name || m.id,
          provider_slug: providerSlug,
          provider_display: display.name_cn || display.name,
          provider_region: display.region,
          description: m.description || '',
          context_length: m.context_length || 0,
          max_output_tokens: m.top_provider?.max_completion_tokens || 0,
          pricing: {
            prompt: m.pricing?.prompt || '0',
            completion: m.pricing?.completion || '0',
          },
          modality: m.architecture?.modality || '',
          series_slug: modalityToSeries(m.architecture?.modality),
          capabilities: deriveCapabilities(m),
          created_at: m.created || 0,
        });
      }

      discovered.sort((a, b) => b.created_at - a.created_at);
      _cache = { data: discovered, ts: Date.now() };

      const totalProviders = Object.keys(prefixMap).length;
      console.log(`[discovery] Fetched ${discovered.length} models from ${totalProviders} provider sources`);
    } catch (error: any) {
      console.error('[discovery] Fetch failed:', error.message);
      if (_cache) return filterModels(_cache.data, mode === 'new' ? days : undefined, provider, chineseOnly);
      return [];
    }
  }

  return filterModels(_cache.data, mode === 'new' ? days : undefined, provider, chineseOnly);
}

/**
 * Backward-compatible wrapper — equivalent to the old getLatestDiscoveredModels().
 */
export async function getLatestDiscoveredModels(
  days: number = 30,
  provider?: string
): Promise<DiscoveredModel[]> {
  return discoverModels({ days, provider, chineseOnly: true, mode: 'new' });
}

// ── Internal helpers ──

function filterModels(
  models: DiscoveredModel[],
  days?: number,
  provider?: string,
  chineseOnly?: boolean,
): DiscoveredModel[] {
  let filtered = models;

  if (days !== undefined) {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    filtered = filtered.filter(m => m.created_at >= cutoff);
  }

  if (provider) {
    filtered = filtered.filter(m => m.provider_slug === provider);
  }

  if (chineseOnly) {
    filtered = filtered.filter(m => m.provider_region === 'cn');
  }

  return filtered;
}

/** Export display info for consumer use (e.g., tagging models as 国产/海外) */
export function getProviderDisplay(slug: string) {
  return PROVIDER_DISPLAY[slug] || { name: slug, name_cn: slug, region: 'intl' as const };
}

// ── Rankings ──────────────────────────────────────────────────

export interface RankingEntry {
  rank: number
  model_id: string
  name: string
  provider_slug: string
  provider_name: string
  context_length: number
  max_output_tokens: number
  input_price_per_m: number   // $ per 1M tokens
  output_price_per_m: number  // $ per 1M tokens
  modality: string
  capabilities: Record<string, boolean>
}

export type RankingSort = 'context' | 'price_low' | 'output_tokens' | 'newest'

export async function getRankings(
  sort: RankingSort = 'context',
  chineseOnly: boolean = false,
  limit: number = 50,
  provider?: string,
  capability?: string,
): Promise<RankingEntry[]> {
  // Always use the full (all providers) dataset from cache
  const all = await discoverModels({ chineseOnly, mode: 'all' })

  // Deduplicate by model_id (some have duplicates across providers)
  const seen = new Set<string>()
  let unique: DiscoveredModel[] = []
  for (const m of all) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      unique.push(m)
    }
  }

  // Apply filters
  if (provider) {
    unique = unique.filter(m => m.provider_slug === provider)
  }
  if (capability) {
    unique = unique.filter(m => m.capabilities[capability] === true)
  }

  // Sort by chosen dimension
  switch (sort) {
    case 'context':
      unique.sort((a, b) => b.context_length - a.context_length)
      break
    case 'price_low':
      unique.sort((a, b) => {
        const costA = parseFloat(a.pricing.prompt || '0') + parseFloat(a.pricing.completion || '0')
        const costB = parseFloat(b.pricing.prompt || '0') + parseFloat(b.pricing.completion || '0')
        return costA - costB
      })
      break
    case 'output_tokens':
      unique.sort((a, b) => b.max_output_tokens - a.max_output_tokens)
      break
    case 'newest':
      unique.sort((a, b) => b.created_at - a.created_at)
      break
  }

  return unique.slice(0, limit).map((m, i) => ({
    rank: i + 1,
    model_id: m.id,
    name: m.name,
    provider_slug: m.provider_slug,
    provider_name: m.provider_display,
    context_length: m.context_length,
    max_output_tokens: m.max_output_tokens,
    input_price_per_m: parseFloat(m.pricing.prompt || '0') * 1_000_000,
    output_price_per_m: parseFloat(m.pricing.completion || '0') * 1_000_000,
    modality: m.modality,
    capabilities: m.capabilities,
  }))
}

/** Get all distinct provider slugs from cache for filter dropdowns */
export async function getRankingProviders(): Promise<{ slug: string; name: string; count: number }[]> {
  const all = await discoverModels({ chineseOnly: false, mode: 'all' })
  const map = new Map<string, { name: string; count: number }>()
  for (const m of all) {
    const existing = map.get(m.provider_slug)
    if (existing) {
      existing.count++
    } else {
      map.set(m.provider_slug, { name: m.provider_display, count: 1 })
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([slug, { name, count }]) => ({ slug, name, count }))
}

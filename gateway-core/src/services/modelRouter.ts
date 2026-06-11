/**
 * Model Router — resolves which Provider binding should handle a given model request.
 *
 * Strategy (in priority order):
 *   1. User explicitly specifies x-onellm-provider → use it directly (skip auto-routing)
 *   2. Binding's allowed_models explicitly lists the model → match
 *   3. Query admin-api /resolve-model → match by model_specs or prefix rules
 *   4. Return all bindings as candidates (no model filter) → best-effort
 */

import { POWERED_BY } from '../globals';

export interface ProviderBinding {
  id: string;
  provider_name: string;
  api_key: string;
  priority_order: number;
  weight: number;
  enabled: boolean;
  allowed_models: string[] | null;  // null = all models for this provider
  daily_budget_cents: number;
  monthly_budget_cents: number;
  rate_limit_rpm?: number;
}

export interface RoutingDecision {
  selected: ProviderBinding;
  allCandidates: ProviderBinding[];
  reason: 'explicit_header' | 'allowed_models_match' | 'model_specs_match' | 'all_pass' | 'no_match';
}

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3100';

/**
 * Resolve which provider binding should handle a model request.
 *
 * @param model - The requested model name (e.g., "gpt-4o")
 * @param bindings - All enabled provider bindings for the key
 * @param explicitProvider - Optional explicit provider from x-onellm-provider header
 * @returns RoutingDecision with selected binding and candidates
 */
export async function resolveModelBinding(
  model: string,
  bindings: ProviderBinding[],
  explicitProvider?: string
): Promise<RoutingDecision> {
  if (bindings.length === 0) {
    return { selected: null as any, allCandidates: [], reason: 'no_match' };
  }

  // ── 1. Explicit provider header → direct match ──
  if (explicitProvider) {
    const match = bindings.find(
      b => b.provider_name === explicitProvider
    );
    if (match) {
      return {
        selected: match,
        allCandidates: [match],
        reason: 'explicit_header',
      };
    }
  }

  // ── 2. Binding's allowed_models explicitly lists the model ──
  const allowedMatches = bindings.filter(
    b => b.allowed_models && b.allowed_models.includes(model)
  );
  if (allowedMatches.length > 0) {
    return {
      selected: allowedMatches[0],
      allCandidates: allowedMatches,
      reason: 'allowed_models_match',
    };
  }

  // ── 3. Query admin-api /resolve-model for model_specs or prefix rule match ──
  try {
    const response = await fetch(
      `${ADMIN_API_URL}/api/v1/internal/resolve-model?model=${encodeURIComponent(model)}`
    );
    const { data } = await response.json() as any;
    if (data?.providers?.length > 0) {
      const providerSlugs = data.providers.map((p: any) => p.provider_slug);
      const resolvedMatches = bindings.filter(b =>
        providerSlugs.includes(b.provider_name)
      );
      if (resolvedMatches.length > 0) {
        return {
          selected: resolvedMatches[0],
          allCandidates: resolvedMatches,
          reason: 'model_specs_match',
        };
      }
    }
  } catch {
    // Admin-api unavailable — fall through to next strategy
  }

  // ── 4. Local prefix fallback (offline mode) ──
  const localMatch = localModelPrefixMatch(model, bindings);
  if (localMatch) {
    return {
      selected: localMatch,
      allCandidates: [localMatch],
      reason: 'model_specs_match',
    };
  }

  // ── 5. Best effort: return all enabled bindings (no model filter) ──
  const enabled = bindings.filter(b => b.enabled);
  if (enabled.length > 0) {
    return {
      selected: enabled[0],
      allCandidates: enabled,
      reason: 'all_pass',
    };
  }

  return { selected: null as any, allCandidates: [], reason: 'no_match' };
}

/**
 * Local model→provider prefix mapping (used when admin-api is unreachable).
 */
const PREFIX_MAP: Record<string, string> = {
  'gpt-': 'openai',
  'o1-': 'openai',
  'o3-': 'openai',
  'o4-': 'openai',
  'claude-': 'anthropic',
  'deepseek-': 'deepseek',
  'qwen': 'dashscope',
  'glm-': 'zhipu',
  'moonshot-': 'moonshot',
  'kimi-': 'moonshot',
  'abab': 'minimax',
  'doubao-': 'bytedance',
  'ernie-': 'baidu',
  'spark-': 'xunfei',
  'yi-': 'lingyi',
  'baichuan': 'baichuan',
  'hunyuan-': 'tencent',
  'step-': 'stepfun',
  'gemini-': 'google',
  'llama': 'together-ai',
  'mixtral': 'mistral-ai',
  'mistral': 'mistral-ai',
  'dall-e': 'openai',
  'tts-': 'openai',
  'whisper-': 'openai',
};

function localModelPrefixMatch(
  model: string,
  bindings: ProviderBinding[]
): ProviderBinding | null {
  const modelLower = model.toLowerCase();
  for (const [prefix, provider] of Object.entries(PREFIX_MAP)) {
    if (modelLower.startsWith(prefix)) {
      return bindings.find(
        b => b.provider_name === provider || b.provider_name === provider.replace('-', '')
      ) || null;
    }
  }
  return null;
}

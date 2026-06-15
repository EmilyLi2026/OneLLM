import { Context, Next } from 'hono';
import { HEADER_KEYS } from '../globals';
import { env } from 'hono/adapter';

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3100';

/**
 * Handles the models request. Returns a list of models supported by the Ai gateway.
 * Allows filters in query params for the provider.
 *
 * Three modes:
 *   1. Control plane mode (ALBUS_BASEPATH set): proxies to the control plane /v2/models
 *   2. Virtual key mode (OneLLM bindings from auth middleware): returns models
 *      from the key's provider bindings' allowed_models, or queries the model catalog
 *      for the bound provider when no explicit allowed_models restriction is set.
 *      This enables Anthropic-native clients (Claude Code) and OpenAI clients to
 *      discover which models the virtual key grants access to.
 *   3. Standalone mode: passes through to next() for direct provider forwarding
 * @param c - The Hono context
 * @returns - The response
 */
export const modelsHandler = async (context: Context, next: Next) => {
  const fetchOptions: Record<string, any> = {};
  fetchOptions['method'] = context.req.method;

  const controlPlaneURL = env(context).ALBUS_BASEPATH;

  const headers = Object.fromEntries(context.req.raw.headers);

  const authHeader = headers['Authorization'] || headers['authorization'];

  const apiKey =
    headers[HEADER_KEYS.API_KEY] || authHeader?.replace('Bearer ', '');
  let config: any = headers[HEADER_KEYS.CONFIG];
  if (config && typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }
  const providerHeader = headers[HEADER_KEYS.PROVIDER];
  const virtualKey = headers[HEADER_KEYS.VIRTUAL_KEY];

  const containsProvider =
    providerHeader || virtualKey || config?.provider || config?.virtual_key;

  // ── Mode 2: Virtual key — return models from OneLLM bindings ──
  // When a request comes with an OneLLM virtual key (authenticated by onellmAuth),
  // construct a model list. Claude Code and other clients need this to discover
  // which models are available through this virtual key.
  const onellmBindings = context.get('onellm_bindings');
  if (!containsProvider && !controlPlaneURL && onellmBindings?.length > 0) {
    // Step 1: Collect model IDs from bindings that have explicit allowed_models
    const modelIds: string[] = [];
    let hasExplicitModels = false;
    for (const b of onellmBindings) {
      if (b.allowed_models && b.allowed_models.length > 0) {
        hasExplicitModels = true;
        for (const m of b.allowed_models) {
          if (!modelIds.includes(m)) modelIds.push(m);
        }
      }
    }

    // Step 2: For bindings WITHOUT explicit allowed_models (meaning "all models
    // from this provider are allowed"), query the model catalog in admin-api
    // to discover the provider's active model IDs.
    if (!hasExplicitModels) {
      const providersWithoutModels = onellmBindings
        .filter((b: any) => !b.allowed_models || b.allowed_models.length === 0)
        .map((b: any) => b.provider_name);

      for (const provider of [...new Set(providersWithoutModels)]) {
        try {
          const resp = await fetch(
            `${ADMIN_API_URL}/api/v1/internal/models-by-provider?provider=${encodeURIComponent(provider)}`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (resp.ok) {
            const body = await resp.json();
            if (body.data) {
              for (const m of body.data) {
                if (!modelIds.includes(m.id)) modelIds.push(m.id);
              }
            }
          }
        } catch {
          // Admin-api unreachable — fall through to minimal response
        }
      }
    }

    // Step 3: Build & return the model list
    if (modelIds.length === 0) {
      // Still empty (admin-api unreachable and no explicit models) — return best-effort
      const providers = [...new Set(onellmBindings.map((b: any) => b.provider_name))];
      return new Response(
        JSON.stringify({
          object: 'list',
          data: providers.map((p) => ({
            id: `models-via-${p}`,
            object: 'model',
            owned_by: p,
          })),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        object: 'list',
        data: modelIds.map((id) => ({
          id,
          object: 'model',
          owned_by: onellmBindings[0].provider_name,
        })),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }

  if (containsProvider || !controlPlaneURL) {
    return next();
  }

  // ── Mode 1: Control plane — proxy to /v2/models ──
  const urlObject = new URL(context.req.url);
  const requestRoute = `${controlPlaneURL}${context.req.path.replace('/v1/', '/v2/')}${urlObject.search}`;
  fetchOptions['headers'] = {
    [HEADER_KEYS.API_KEY]: apiKey,
  };

  const resp = await fetch(requestRoute, fetchOptions);
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'content-type': 'application/json',
    },
  });
};

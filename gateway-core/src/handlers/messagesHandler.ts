import { RouterError } from '../errors/RouterError';
import {
  constructConfigFromRequestHeaders,
  tryTargetsRecursively,
  injectOnellmProvider,
} from './handlerUtils';
import { Context } from 'hono';
import { POWERED_BY } from '../globals';
import { anthropicToOpenAI, translateOpenAIResponse } from './services/anthropicCompat';
import Providers from '../providers';

/**
 * Handles the '/messages' API request.
 *
 * Supports two modes:
 *   1. Anthropic Compat: translates Anthropic ↔ OpenAI format for non-Anthropic providers.
 *   2. Native Anthropic: forwards request as-is when an Anthropic upstream key is bound.
 *
 * @param {Context} c - The Hono context.
 * @returns {Promise<Response>} - The response (Anthropic format).
 */
export async function messagesHandler(c: Context): Promise<Response> {
  try {
    let request = await c.req.json();
    let requestHeaders = Object.fromEntries(c.req.raw.headers);

    // ── Anthropic compatibility mode ──
    // For /v1/messages requests from Anthropic-native clients (Claude Code, SDKs),
    // auto-detect the request format and route to the virtual key's bound provider.
    // If the bound provider is NOT Anthropic, translate between Anthropic ↔ OpenAI formats.
    const bindings = c.get('onellm_bindings');
    const isMessagesPath = c.req.path.startsWith('/v1/messages');
    const hasNoExplicitProvider = !requestHeaders[`x-${POWERED_BY}-provider`]
                               && !requestHeaders['x-aihub-provider']
                               && !requestHeaders['x-portkey-provider']
                               && !requestHeaders[`x-${POWERED_BY}-config`];

    if (isMessagesPath && hasNoExplicitProvider && bindings?.length > 0) {
      const primaryBinding = bindings[0];
      const providerName = primaryBinding.provider_name;

      // ── Check if bound provider supports native Anthropic messages endpoint ──
      // e.g. DeepSeek provides /anthropic/v1/messages — route directly without translation
      const providerConfig = Providers[providerName];
      const supportsNativeMessages = providerConfig?.api?.getEndpoint({
        fn: 'messages',
        c,
        providerOptions: {},
        gatewayRequestBodyJSON: request,
        gatewayRequestURL: c.req.url,
      }) !== '';

      if (supportsNativeMessages) {
        // ── Native Anthropic protocol: route directly, no translation ──
        // Map model name to binding's allowed model since Claude Code sends
        // Anthropic model names (e.g. "claude-sonnet-4-20250514") but the upstream
        // provider expects its own model names (e.g. "deepseek-chat")
        if (primaryBinding.allowed_models?.[0]) {
          request.model = primaryBinding.allowed_models[0];
        }
        requestHeaders[`x-${POWERED_BY}-provider`] = providerName;
      } else if (providerName !== 'anthropic') {
        // ── Compat mode: translate Anthropic → OpenAI → bound provider ──
        requestHeaders[`x-${POWERED_BY}-provider`] = providerName;
        const originalModel = request.model;
        request = anthropicToOpenAI(request, primaryBinding);

        injectOnellmProvider(c, requestHeaders);
        const camelCaseConfig = constructConfigFromRequestHeaders(requestHeaders);
        const response = await tryTargetsRecursively(
          c,
          camelCaseConfig ?? {},
          request,
          requestHeaders,
          'chatComplete',
          'POST',
          'config'
        );

        return translateOpenAIResponse(response, originalModel);
      } else {
        // Native Anthropic provider (anthropic): use original /v1/messages endpoint
        requestHeaders[`x-${POWERED_BY}-provider`] = 'anthropic';
      }
    }

    injectOnellmProvider(c, requestHeaders);
    const camelCaseConfig = constructConfigFromRequestHeaders(requestHeaders);
    const tryTargetsResponse = await tryTargetsRecursively(
      c,
      camelCaseConfig ?? {},
      request,
      requestHeaders,
      'messages',
      'POST',
      'config'
    );

    return tryTargetsResponse;
  } catch (err: any) {
    console.log('messages error', err.message);
    let statusCode = 500;
    let errorType = 'api_error';
    let errorMessage = 'Something went wrong';

    if (err instanceof RouterError) {
      statusCode = 400;
      errorType = 'invalid_request_error';
      errorMessage = err.message;
    }

    // Return Anthropic-compatible error format so Claude Code / SDKs can parse it
    return new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: errorType,
          message: errorMessage,
        },
      }),
      {
        status: statusCode,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

import { RouterError } from '../errors/RouterError';
import {
  constructConfigFromRequestHeaders,
  tryTargetsRecursively,
  injectOnellmProvider,
} from './handlerUtils';
import { Context } from 'hono';
import { POWERED_BY } from '../globals';
import { anthropicToOpenAI } from './services/anthropicCompat';
import Providers from '../providers';

/**
 * Handles the '/messages/count_tokens' API request by selecting the appropriate provider(s) and making the request to them.
 *
 * Supports Anthropic compatibility mode: translates request format for non-Anthropic providers.
 *
 * @param {Context} c - The Cloudflare Worker context.
 * @returns {Promise<Response>} - The response from the provider.
 * @throws Will throw an error if no provider options can be determined or if the request to the provider(s) fails.
 * @throws Will throw an 500 error if the handler fails due to some reasons
 */
export async function messagesCountTokensHandler(
  c: Context
): Promise<Response> {
  try {
    let request = await c.req.json();
    let requestHeaders = Object.fromEntries(c.req.raw.headers);

    // ── Anthropic compatibility mode ──
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
        // Map model name to binding's allowed model
        if (primaryBinding.allowed_models?.[0]) {
          request.model = primaryBinding.allowed_models[0];
        }
        requestHeaders[`x-${POWERED_BY}-provider`] = providerName;
      } else if (providerName !== 'anthropic') {
        // ── Compat mode: translate Anthropic → OpenAI → bound provider ──
        requestHeaders[`x-${POWERED_BY}-provider`] = providerName;
        request = anthropicToOpenAI(request, primaryBinding);

        injectOnellmProvider(c, requestHeaders);
        const camelCaseConfig = constructConfigFromRequestHeaders(requestHeaders);
        const tryTargetsResponse = await tryTargetsRecursively(
          c,
          camelCaseConfig ?? {},
          request,
          requestHeaders,
          'chatComplete',
          'POST',
          'config'
        );
        return tryTargetsResponse;
      } else {
        // Native Anthropic provider (anthropic)
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
      'messagesCountTokens',
      'POST',
      'config'
    );

    return tryTargetsResponse;
  } catch (err: any) {
    console.log('messagesCountTokens error', err.message);
    let statusCode = 500;
    let errorType = 'api_error';
    let errorMessage = 'Something went wrong';

    if (err instanceof RouterError) {
      statusCode = 400;
      errorType = 'invalid_request_error';
      errorMessage = err.message;
    }

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

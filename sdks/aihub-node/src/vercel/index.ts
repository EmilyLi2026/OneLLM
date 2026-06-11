/**
 * Vercel AI SDK Provider for AI Hub
 *
 * Provides a convenience wrapper around @ai-sdk/openai, pre-configured
 * to route all requests through the AI Hub gateway.
 *
 * @module vercel
 *
 * @example
 * ```typescript
 * import { createAIHub } from '@ai-hub/node/vercel';
 * import { streamText } from 'ai';
 *
 * const aihub = createAIHub({
 *   baseURL: 'https://your-gateway.aihub.com/v1',
 *   apiKey: process.env.AIHUB_API_KEY,
 * });
 *
 * const result = streamText({
 *   model: aihub('deepseek-chat'),
 *   messages: [...],
 * });
 * ```
 *
 * NOTE: This module requires `ai` and `@ai-sdk/openai` to be installed separately.
 *   npm install ai @ai-sdk/openai
 */

// ─── Local type (avoids compile-time dependency on 'ai' package) ──
// Compatible with LanguageModelV1 from 'ai' package
interface LanguageModelV1 {
  readonly specificationVersion: 'v1';
  readonly provider: string;
  readonly modelId: string;
  doGenerate(...args: any[]): PromiseLike<any>;
  doStream(...args: any[]): PromiseLike<any>;
}

// ─── Types ───────────────────────────────────────────────────

interface AIHubProviderConfig {
  /** AI Hub Gateway base URL (e.g., https://your-gateway.aihub.com/v1) */
  baseURL: string;
  /** AI Hub API Key (aihub_sk_xxx) */
  apiKey: string;
  /** Optional: Custom fetch implementation */
  fetch?: typeof globalThis.fetch;
  /** Optional: Additional headers to send with every request */
  headers?: Record<string, string>;
}

// Try to import createOpenAI — if @ai-sdk/openai is not installed,
// we provide a helpful error message
let createOpenAI: any;
try {
  createOpenAI = require('@ai-sdk/openai').createOpenAI;
} catch {
  // @ai-sdk/openai is an optional peer dependency
}

/**
 * Create an AI Hub provider for Vercel AI SDK.
 *
 * Returns a function that takes a model ID and returns a LanguageModelV1
 * compatible with the Vercel AI SDK (`ai` package).
 *
 * Supports: streamText, generateText, streamObject, generateObject,
 * and all other Vercel AI SDK core functions.
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts (Next.js App Router)
 * import { createAIHub } from '@ai-hub/node/vercel';
 * import { streamText } from 'ai';
 *
 * const aihub = createAIHub({
 *   baseURL: process.env.AIHUB_GATEWAY_URL,
 *   apiKey: process.env.AIHUB_API_KEY,
 * });
 *
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   const result = streamText({
 *     model: aihub('deepseek-chat'),
 *     messages,
 *   });
 *   return result.toDataStreamResponse();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Switcher — use different models from a single provider
 * const aihub = createAIHub({ baseURL: '...', apiKey: '...' });
 *
 * // All go through AI Hub, which routes to the correct upstream provider
 * const deepseekModel = aihub('deepseek-chat');
 * const qwenModel = aihub('qwen-plus');
 * const gptModel = aihub('gpt-4o');
 * ```
 */
export function createAIHub(config: AIHubProviderConfig): (modelId: string) => LanguageModelV1 {
  if (!createOpenAI) {
    throw new Error(
      '[@ai-hub/node/vercel] Missing peer dependency: @ai-sdk/openai.\n' +
      'Install it with: npm install @ai-sdk/openai ai'
    );
  }

  const openai = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    fetch: config.fetch,
    headers: {
      'x-onellm-api-key': config.apiKey,
      ...config.headers,
    },
  });

  return (modelId: string): LanguageModelV1 => {
    if (!modelId || typeof modelId !== 'string') {
      throw new Error('[@ai-hub/node/vercel] modelId must be a non-empty string');
    }
    return openai(modelId);
  };
}

/**
 * @deprecated Use `createAIHub` instead (shorter, cleaner name).
 */
export const createAIHubProvider = createAIHub;

export default createAIHub;

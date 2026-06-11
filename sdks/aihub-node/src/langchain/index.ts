/**
 * LangChain Integration for AI Hub Node.js SDK
 *
 * Provides automatic tracing of LangChain.js operations through AI Hub gateway.
 *
 * @module langchain
 *
 * @example
 * ```typescript
 * import { LangchainCallbackHandler } from '@ai-hub/node/langchain';
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const handler = new LangchainCallbackHandler({
 *   apiKey: process.env.AIHUB_API_KEY,
 *   baseURL: 'https://your-gateway.aihub.com/v1',
 * });
 *
 * const llm = new ChatOpenAI({
 *   model: 'deepseek-chat',
 *   callbacks: [handler],
 * });
 * ```
 */

export { LangchainCallbackHandler, default } from './callback';

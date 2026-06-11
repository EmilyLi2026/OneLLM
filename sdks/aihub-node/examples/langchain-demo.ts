/**
 * LangChain + AI Hub Integration Demo
 *
 * Demonstrates using the AI Hub LangchainCallbackHandler with LangChain.js.
 *
 * Prerequisites:
 *   npm install @langchain/core @langchain/openai
 *
 * Usage:
 *   1. Set AIHUB_API_KEY=aihub_sk_xxx
 *   2. npx tsx examples/langchain-demo.ts
 */
import { config } from 'dotenv';
config({ override: true });

import { ChatOpenAI } from '@langchain/openai';
import { LangchainCallbackHandler } from '../src/langchain';

const GATEWAY_URL = process.env['AIHUB_GATEWAY_URL'] || 'http://localhost:8787/v1';
const API_KEY = process.env['AIHUB_API_KEY'] || '';

// Create the AI Hub LangChain callback handler
const handler = new LangchainCallbackHandler({
  apiKey: API_KEY,
  baseURL: GATEWAY_URL,
  metadata: { demo: true, source: 'langchain-demo' },
});

// Initialize LangChain LLM with AI Hub as the backend
const llm = new ChatOpenAI({
  model: 'deepseek-chat',
  temperature: 0.7,
  configuration: {
    baseURL: GATEWAY_URL,
    apiKey: API_KEY,
  },
  callbacks: [handler],
});

async function main() {
  console.log('=== LangChain + AI Hub Demo ===\n');

  // 1. Basic invoke
  console.log('1. Basic invoke:');
  const response = await llm.invoke('用一句话介绍AI Hub。');
  console.log('   Response:', response.content);
  console.log('   Tokens:', response.response_metadata?.tokenUsage);

  // 2. Batch invoke
  console.log('\n2. Batch invoke:');
  const responses = await llm.batch([
    '什么是LLM网关？',
    'Agent控制平面有什么作用？',
  ]);
  responses.forEach((r, i) => {
    console.log(`   [${i + 1}] ${r.content}`);
  });

  // 3. Streaming
  console.log('\n3. Streaming:');
  const stream = await llm.stream('写一首三行诗。');
  process.stdout.write('   ');
  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }

  // Flush any remaining events
  await handler.flush();

  console.log('\n\n4. Buffered events:', handler.getEvents().length);

  console.log('\n✅ Demo complete! Check your AI Hub Dashboard for the recorded events.');
}

main().catch(console.error);

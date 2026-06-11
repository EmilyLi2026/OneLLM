/**
 * Vercel AI SDK + AI Hub Integration Demo
 *
 * Demonstrates using the createAIHub provider with the Vercel AI SDK.
 *
 * Prerequisites:
 *   npm install ai @ai-sdk/openai
 *
 * Usage:
 *   1. Set AIHUB_API_KEY=aihub_sk_xxx
 *   2. npx tsx examples/vercel-demo.ts
 */
import { config } from 'dotenv';
config({ override: true });

import { generateText, streamText } from 'ai';
import { createAIHub } from '../src/vercel';

const GATEWAY_URL = process.env['AIHUB_GATEWAY_URL'] || 'http://localhost:8787/v1';
const API_KEY = process.env['AIHUB_API_KEY'] || '';

// Create the AI Hub provider — works with any model routed through the gateway
const aihub = createAIHub({
  baseURL: GATEWAY_URL,
  apiKey: API_KEY,
});

async function main() {
  console.log('=== Vercel AI SDK + AI Hub Demo ===\n');

  // 1. generateText — non-streaming
  console.log('1. generateText:');
  const { text, usage } = await generateText({
    model: aihub('deepseek-chat'),
    prompt: '用一句话介绍AI Hub。',
  });
  console.log('   Response:', text);
  console.log('   Tokens:', usage);

  // 2. streamText — streaming
  console.log('\n2. streamText:');
  const result = streamText({
    model: aihub('deepseek-chat'),
    prompt: '写一首关于人工智能的三行诗。',
  });

  process.stdout.write('   ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  console.log('\n\n3. Multi-model switcher:');
  const models = ['deepseek-chat', 'qwen-plus'];
  for (const modelId of models) {
    const { text } = await generateText({
      model: aihub(modelId),
      prompt: '说你好',
    });
    console.log(`   [${modelId}]: ${text}`);
  }

  console.log('\n✅ Demo complete!');
}

main().catch(console.error);

/**
 * AI Hub Node SDK — Basic Usage Demo
 *
 * Demonstrates how to use the AI Hub Node.js SDK to make
 * chat completions and text completions through the AI Hub Gateway.
 *
 * Usage:
 *   1. Set environment variable: AIHUB_API_KEY=aihub_sk_xxx
 *   2. npx tsx examples/demo.ts
 */
import { config } from 'dotenv';
import Portkey from '../src';

config({ override: true });

// Initialize the AI Hub client
// - If baseURL is omitted, defaults to http://localhost:8787/v1
// - If apiKey is provided, the gateway authenticates via AI Hub key
const client = new Portkey({
  apiKey: process.env['AIHUB_API_KEY'] ?? '',
  // baseURL: 'http://localhost:8787/v1',  // default, change for your deployment
});

// ─── Chat Completion ────────────────────────────────────────
async function chatDemo() {
  console.log('=== Chat Completion ===');
  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个有帮助的AI助手。' },
      { role: 'user', content: '用一句话介绍AI Hub。' },
    ],
    max_tokens: 200,
  });

  console.log('Model:', completion.model);
  console.log('Response:', completion.choices[0]?.message?.content);
  console.log('Tokens:', completion.usage);
}

// ─── Streaming Chat ─────────────────────────────────────────
async function streamDemo() {
  console.log('\n=== Streaming Chat ===');
  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: '写一首关于人工智能的短诗。' }],
    stream: true,
  });

  process.stdout.write('Streaming: ');
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
  console.log('\n');
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  try {
    await chatDemo();
    await streamDemo();
  } catch (err: any) {
    console.error('Error:', err.message);
    if (err.message?.includes('Connection')) {
      console.error('Make sure the AI Hub Gateway is running at http://localhost:8787');
    }
  }
}

main();

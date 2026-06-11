/**
 * Semantic Summarization Service
 *
 * After a log entry is inserted, this service fire-and-forget calls an LLM
 * to semantically summarize agent_role (role title) and action_label (action intent)
 * from the raw conversation content — replacing rough regex extraction with LLM precision.
 *
 * Config via .env:
 *   SUMMARIZE_API_KEY  — API key (skip summarization if not set)
 *   SUMMARIZE_API_URL  — Base URL, default https://api.deepseek.com/v1
 *   SUMMARIZE_MODEL    — Model, default deepseek-chat (¥1/1M tokens, ~¥0.0002/call)
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

const API_KEY = process.env.SUMMARIZE_API_KEY || '';
const API_URL = (process.env.SUMMARIZE_API_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const MODEL = process.env.SUMMARIZE_MODEL || 'deepseek-chat';

/**
 * Fire-and-forget: summarize a log entry's agent_role and action_label.
 * Called right after INSERT — never awaited, never throws.
 */
export async function summarizeLogEntry(logId: number, requestInput: string | null): Promise<void> {
  if (!API_KEY || !requestInput) return;

  try {
    // Parse messages from request_input JSON
    const messages = parseMessages(requestInput);
    if (!messages) return;

    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1]?.content || '';

    if (!systemPrompt && !lastUserMsg) return;

    // Call LLM to summarize
    const result = await callSummarizeAPI(systemPrompt, lastUserMsg);
    if (!result) return;

    // Build UPDATE
    const updates: string[] = [];
    const params: any[] = [];

    if (result.agent_role) {
      updates.push('agent_role = ?');
      params.push(result.agent_role.trim());
    }
    if (result.action_label) {
      updates.push('action_label = ?');
      params.push(result.action_label.trim());
    }

    if (updates.length === 0) return;

    params.push(logId);
    await pool.query(`UPDATE request_logs SET ${updates.join(', ')} WHERE id = ?`, params);
  } catch {
    // Silently ignore — summarization is best-effort
  }
}

/**
 * Call the LLM to semantically summarize agent_role and action_label.
 * Returns null on any error (caller handles graceful degradation).
 */
async function callSummarizeAPI(systemPrompt: string, userMessage: string): Promise<{ agent_role?: string; action_label?: string } | null> {
  const prompt = `分析以下 AI 对话内容，提炼两个关键信息。

系统指令（System Prompt）：
${systemPrompt.substring(0, 1500)}

用户消息（User Message）：
${userMessage.substring(0, 1500)}

请以 JSON 格式返回，不要任何其他内容：
{
  "agent_role": "智能体的角色名称（15字以内）",
  "action_label": "用户当前的操作意图（30字以内）"
}`;

  const response = await fetch(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.05,
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return null;

  const data = await response.json() as any;
  const content: string = data?.choices?.[0]?.message?.content || '';

  // Extract JSON from response (handle possible markdown fences)
  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/** Parse request_input JSON to extract messages array */
function parseMessages(requestInput: string): any[] | null {
  try {
    const parsed = JSON.parse(requestInput);
    // Could be { messages: [...] } or just [...]
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.messages && Array.isArray(parsed.messages)) return parsed.messages;
    return null;
  } catch {
    return null;
  }
}

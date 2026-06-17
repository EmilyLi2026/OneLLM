/**
 * Semantic Summarization Service
 *
 * After a log entry is inserted, this service fire-and-forget refines
 * agent_role (scene/workflow label) and action_label (task summary).
 *
 * Strategy (Plan E — hybrid layered):
 *   agent_role  = scene label derived from system prompt fingerprint
 *                 → same prompt template = cached label, only classify once
 *   action_label = tool info (priority) or LLM one-sentence task summary
 *
 * Config via .env:
 *   SUMMARIZE_API_KEY  — API key (skip summarization if not set)
 *   SUMMARIZE_API_URL  — Base URL, default https://api.deepseek.com/v1
 *   SUMMARIZE_MODEL    — Model, default deepseek-chat
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

const API_KEY = process.env.SUMMARIZE_API_KEY || '';
const API_URL = (process.env.SUMMARIZE_API_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const MODEL = process.env.SUMMARIZE_MODEL || 'deepseek-chat';

/** In-memory cache: prompt fingerprint → scene label */
const promptFingerprintCache = new Map<string, string | null>();

/**
 * Compute a deterministic fingerprint for a system prompt.
 * Must match the algorithm in gateway-core/src/middlewares/log/index.ts
 */
function computeFingerprint(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim().substring(0, 500);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) & 0xffffffff;
  }
  return 'fp_' + (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fire-and-forget: refine a log entry's agent_role and action_label.
 *
 * @param logId        - request_logs row id
 * @param requestInput - JSON string of request messages
 * @param toolName     - from agent framework (x-onellm-tool-name)
 * @param toolAction   - from agent framework (x-onellm-tool-action)
 */
export async function summarizeLogEntry(
  logId: number,
  requestInput: string | null,
  toolName?: string | null,
  toolAction?: string | null
): Promise<void> {
  if (!API_KEY || !requestInput) return;

  try {
    const messages = parseMessages(requestInput);
    if (!messages) return;

    const systemPrompt = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1]?.content || '';

    if (!systemPrompt && !lastUserMsg && !toolName) return;

    const updates: string[] = [];
    const params: any[] = [];

    // ── action_label: tool info takes absolute priority ──
    if (toolName) {
      const action = toolAction || '调用';
      updates.push('action_label = ?');
      params.push(`${action} ${toolName}`);
    } else if (lastUserMsg) {
      // No tool → LLM one-sentence task summary
      const taskSummary = await callTaskSummarizeAPI(lastUserMsg);
      if (taskSummary) {
        updates.push('action_label = ?');
        params.push(taskSummary.trim());
      }
    }

    // ── agent_role: fingerprint cache → LLM scene classify if miss ──
    if (systemPrompt) {
      const fp = computeFingerprint(systemPrompt);

      let sceneLabel: string | null | undefined = promptFingerprintCache.get(fp);

      if (sceneLabel === undefined) {
        // Cache miss → ask LLM to classify the scene
        sceneLabel = await callSceneClassifyAPI(systemPrompt);
        // Cache even null results so we don't retry failed classifications
        promptFingerprintCache.set(fp, sceneLabel);
      }

      if (sceneLabel) {
        updates.push('agent_role = ?');
        params.push(sceneLabel.trim());
      }
    } else if (lastUserMsg) {
      // No system prompt → fallback scene classification from user context
      const sceneLabel = await callSceneClassifyAPI(lastUserMsg.substring(0, 1500));
      if (sceneLabel) {
        updates.push('agent_role = ?');
        params.push(sceneLabel.trim());
      }
    }

    if (updates.length === 0) return;

    params.push(logId);
    await pool.query(
      `UPDATE request_logs SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  } catch {
    // Silently ignore — summarization is best-effort
  }
}

/**
 * Classify the application scene from a system prompt (or user message fallback).
 * Uses fingerprint caching so identical prompts are only classified once.
 * Returns null on any error.
 */
async function callSceneClassifyAPI(systemPrompt: string): Promise<string | null> {
  const prompt = `分析以下 AI 智能体的系统指令，判断它属于哪种应用场景。
只返回一个场景分类标签（10字以内），例如：
客服对话、数据分析、代码助手、文档撰写、翻译服务、内容审核、知识问答、创意写作、邮件处理、订单管理、售后处理、数据查询、报告生成、内容摘要、任务规划

系统指令：
${systemPrompt.substring(0, 1500)}

场景标签：`;

  try {
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
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content || '';

    // Clean: remove quotes, newlines, extra whitespace
    return content.replace(/["'\n\r]/g, '').trim().substring(0, 30) || null;
  } catch {
    return null;
  }
}

/**
 * Summarize a user message into a one-sentence task description.
 * Used only when no tool info is available.
 * Returns null on any error.
 */
async function callTaskSummarizeAPI(userMessage: string): Promise<string | null> {
  const prompt = `用一句话概括用户的核心任务（20字以内），只返回任务描述，不要其他内容。

用户消息：
${userMessage.substring(0, 1000)}

任务：`;

  try {
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
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content || '';

    return content.replace(/["'\n\r]/g, '').trim().substring(0, 60) || null;
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

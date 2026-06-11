/**
 * Internal Routes — used by gateway-core for auth & logging
 * No JWT required (internal service-to-service)
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { checkWorkspaceBudget, checkAgentBudget, checkAllBudgets } from '../services/budget';
import { summarizeLogEntry } from '../services/summarize';
import { decrypt } from '../utils/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'onellm-dev-secret-change-in-production';

export const internalRouter = Router();

interface KeyRow extends RowDataPacket {
  id: string; user_id: string; workspace_id: string; key_hash: string;
  scopes: any; revoked: number;
  provider_credential_id: string; rate_limit_rpm: number; monthly_budget_cents: number; daily_budget_cents: number;
}

/**
 * POST /api/v1/internal/validate-key
 * Validates an API key or Agent key against the database.
 * Called by gateway-core on each request.
 */
internalRouter.post('/validate-key', async (req, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key) {
      return res.json({ valid: false, reason: 'missing_key' });
    }

    // Try api_keys table first
    const [keys] = await pool.query<KeyRow[]>(
      'SELECT id, user_id, workspace_id, key_hash, scopes, revoked, provider_credential_id, rate_limit_rpm, monthly_budget_cents, daily_budget_cents FROM api_keys WHERE revoked = 0'
    );

    for (const key of keys) {
      const match = await bcrypt.compare(api_key, key.key_hash);
      if (match) {
        // Update last_used_at
        await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [key.id]);

        // ── Load all Provider bindings (new 1:N model) ──
        const [bindingRows] = await pool.query<RowDataPacket[]>(
          `SELECT kpb.id, kpb.priority_order, kpb.weight, kpb.enabled,
                  kpb.allowed_models, kpb.daily_budget_cents, kpb.monthly_budget_cents,
                  pc.provider_name, pc.api_key_encrypted
           FROM key_provider_bindings kpb
           JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
           WHERE kpb.api_key_id = ? AND kpb.enabled = 1
           ORDER BY kpb.priority_order ASC`,
          [key.id]
        );

        // ── Fetch per-binding spending for budget enforcement ──
        const bindingSpendingMap = new Map<string, { daily: number; monthly: number }>();
        if (bindingRows.length > 0) {
          const bindingIds = bindingRows.map((b: any) => b.id);
          try {
            // Daily spending per binding
            const [dailySpending] = await pool.query<RowDataPacket[]>(
              `SELECT binding_id, COALESCE(SUM(cost_cents), 0) as total
               FROM request_logs
               WHERE binding_id IN (${bindingIds.map(() => '?').join(',')})
                 AND DATE(created_at) = CURDATE()
               GROUP BY binding_id`,
              bindingIds
            );
            for (const row of dailySpending) {
              const existing = bindingSpendingMap.get(row.binding_id) || { daily: 0, monthly: 0 };
              existing.daily = Number(row.total);
              bindingSpendingMap.set(row.binding_id, existing);
            }
            // Monthly spending per binding
            const [monthlySpending] = await pool.query<RowDataPacket[]>(
              `SELECT binding_id, COALESCE(SUM(cost_cents), 0) as total
               FROM request_logs
               WHERE binding_id IN (${bindingIds.map(() => '?').join(',')})
                 AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())
               GROUP BY binding_id`,
              bindingIds
            );
            for (const row of monthlySpending) {
              const existing = bindingSpendingMap.get(row.binding_id) || { daily: 0, monthly: 0 };
              existing.monthly = Number(row.total);
              bindingSpendingMap.set(row.binding_id, existing);
            }
          } catch {
            // binding_id column may not exist yet — spending will be 0
          }
        }

        let bindings: any[] = bindingRows.map((b: any) => {
          const spending = bindingSpendingMap.get(b.id) || { daily: 0, monthly: 0 };
          return {
            id: b.id,
            provider_name: b.provider_name,
            api_key: decrypt(b.api_key_encrypted),
            priority_order: b.priority_order,
            weight: b.weight,
            enabled: true,
            allowed_models: b.allowed_models || null,
            daily_budget_cents: Number(b.daily_budget_cents),
            monthly_budget_cents: Number(b.monthly_budget_cents),
            daily_spent_cents: spending.daily,
            monthly_spent_cents: spending.monthly,
          };
        });

        // ── Backward compat: if no bindings in new table, fall back to old FK ──
        if (bindings.length === 0 && key.provider_credential_id) {
          const [creds] = await pool.query<RowDataPacket[]>(
            `SELECT provider_name, api_key_encrypted
             FROM provider_credentials
             WHERE id = ? AND workspace_id = ?`,
            [key.provider_credential_id, key.workspace_id]
          );
          if (creds.length > 0) {
            bindings = [{
              id: 'legacy',
              provider_name: creds[0].provider_name,
              api_key: decrypt(creds[0].api_key_encrypted),
              priority_order: 1,
              weight: 100,
              enabled: true,
              allowed_models: null,
              daily_budget_cents: Number(key.daily_budget_cents),
              monthly_budget_cents: Number(key.monthly_budget_cents),
              daily_spent_cents: 0,
              monthly_spent_cents: 0,
            }];
          }
        }

        // Budget enforcement check (with agent_id from request if available)
        const agentId = req.body.agent_id || null;
        const budgetResult = await checkAllBudgets(key.workspace_id, key.id, agentId);

        // If throttling, mark bindings with reduced rate
        if (budgetResult?.level === 'throttle') {
          bindings = bindings.map(b => ({
            ...b,
            rate_limit_rpm: Math.max(1, Math.floor((key.rate_limit_rpm || 60) / 2)),
          }));
        }

        return res.json({
          valid: budgetResult?.level !== 'cutoff',  // cutoff = invalid
          key_type: 'api_key',
          api_key_id: key.id,
          user_id: key.user_id,
          workspace_id: key.workspace_id,
          scopes: key.scopes,
          bindings,
          budget: budgetResult ? {
            level: budgetResult.level,
            budget_name: budgetResult.budget_name,
            percent: budgetResult.percent,
            message: budgetResult.message,
          } : null,
        });
      }
    }

    // Try agents table
    const [agents] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, workspace_id, api_key_hash, status FROM agents WHERE status = ?', ['active']
    );
    for (const agent of agents) {
      if (!agent.api_key_hash) continue;
      const match = await bcrypt.compare(api_key, agent.api_key_hash);
      if (match) {
        return res.json({
          valid: true,
          key_type: 'agent_key',
          agent_id: agent.id,
          user_id: agent.user_id,
          workspace_id: agent.workspace_id,
        });
      }
    }

    return res.json({ valid: false, reason: 'invalid_key' });
  } catch (error: any) {
    return res.status(500).json({ valid: false, reason: error.message });
  }
});

/**
 * POST /api/v1/internal/get-key-value
 * Returns the raw API key value for a given key_id.
 * Requires JWT — only the key owner can retrieve it.
 */
internalRouter.post('/get-key-value', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { sub: string; workspace_id?: string };

    const { key_id } = req.body;
    if (!key_id) return res.status(400).json({ status: 'error', message: 'key_id required' });

    // Find the key and verify ownership
    const [keys] = await pool.query<RowDataPacket[]>(
      'SELECT id, key_hash, provider_credential_id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked = 0',
      [key_id, payload.workspace_id]
    );
    if (keys.length === 0) return res.status(404).json({ status: 'error', message: 'Key not found' });

    // If this key is bound to a provider credential, return the decrypted upstream key
    if (keys[0].provider_credential_id) {
      const [creds] = await pool.query<RowDataPacket[]>(
        'SELECT api_key_encrypted FROM provider_credentials WHERE id = ? AND workspace_id = ?',
        [keys[0].provider_credential_id, payload.workspace_id]
      );
      if (creds.length > 0) {
        return res.json({
          status: 'success',
          data: {
            api_key: decrypt(creds[0].api_key_encrypted),
            workspace_id: payload.workspace_id,
            user_id: payload.sub,
          },
        });
      }
    }
    // ── Fallback: find first enabled binding (new 1:N model) ──
    const [bindings] = await pool.query<RowDataPacket[]>(
      `SELECT kpb.id, pc.api_key_encrypted, pc.provider_name
       FROM key_provider_bindings kpb
       JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
       WHERE kpb.api_key_id = ? AND kpb.enabled = 1
       ORDER BY kpb.priority_order ASC LIMIT 1`,
      [key_id]
    );
    if (bindings.length > 0) {
      return res.json({
        status: 'success',
        data: {
          api_key: decrypt(bindings[0].api_key_encrypted),
          provider_name: bindings[0].provider_name,
          binding_id: bindings[0].id,
          workspace_id: payload.workspace_id,
          user_id: payload.sub,
        },
      });
    }
    return res.status(404).json({ status: 'error', message: 'No provider binding found for this API key' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/v1/internal/get-binding-key
 * Returns the decrypted upstream key for a specific binding.
 * Used by the Playground to call the gateway directly.
 */
internalRouter.post('/get-binding-key', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { sub: string; workspace_id?: string };

    const { binding_id } = req.body;
    if (!binding_id) return res.status(400).json({ status: 'error', message: 'binding_id required' });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT kpb.id, kpb.api_key_id, pc.api_key_encrypted, pc.provider_name
       FROM key_provider_bindings kpb
       JOIN provider_credentials pc ON kpb.provider_credential_id = pc.id
       JOIN api_keys ak ON kpb.api_key_id = ak.id
       WHERE kpb.id = ? AND ak.workspace_id = ? AND kpb.enabled = 1`,
      [binding_id, payload.workspace_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Binding not found' });
    }

    return res.json({
      status: 'success',
      data: {
        binding_id: rows[0].id,
        api_key: decrypt(rows[0].api_key_encrypted),
        provider_name: rows[0].provider_name,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/v1/internal/resolve-model
 * Resolve a model name to its provider(s), used by gateway routing.
 * Looks up model_specs table first, then falls back to prefix rules.
 */
internalRouter.get('/resolve-model', async (req, res) => {
  try {
    const model = req.query.model as string;
    if (!model) return res.status(400).json({ status: 'error', message: 'model query param required' });

    // Catalog slug → gateway adapter mapping (catalog may use OpenRouter-aligned slugs)
    const CATALOG_TO_GATEWAY: Record<string, string> = {
      'alibaba': 'dashscope',
    };

    // Try model_specs first
    const [specs] = await pool.query<RowDataPacket[]>(
      `SELECT ms.model_id, mp.slug as provider_slug, mp.name as provider_name
       FROM model_specs ms JOIN model_providers mp ON ms.provider_id = mp.id
       WHERE ms.model_id = ? AND ms.status = 'active'`,
      [model]
    );
    if (specs.length > 0) {
      // Translate catalog slug to gateway adapter name if needed
      const providers = specs.map((s: any) => ({
        ...s,
        provider_slug: CATALOG_TO_GATEWAY[s.provider_slug] || s.provider_slug,
      }));
      return res.json({ status: 'success', data: { model, providers } });
    }

    // Prefix fallback rules (known model name → provider patterns)
    const prefixMap: Record<string, string> = {
      'gpt-': 'openai',
      'o1-': 'openai',
      'o3-': 'openai',
      'o4-': 'openai',
      'claude-': 'anthropic',
      'deepseek-': 'deepseek',
      'qwen': 'dashscope',
      'glm-': 'zhipu',
      'moonshot-': 'moonshot',
      'kimi-': 'moonshot',
      'abab': 'minimax',
      'doubao-': 'bytedance',
      'ernie-': 'baidu',
      'spark-': 'xunfei',
      'yi-': 'lingyi',
      'baichuan': 'baichuan',
      'hunyuan-': 'tencent',
      'step-': 'stepfun',
      'gemini-': 'google',
      'llama': 'together-ai',
      'mixtral': 'mistral-ai',
      'mistral': 'mistral-ai',
    };
    for (const [prefix, provider] of Object.entries(prefixMap)) {
      if (model.toLowerCase().startsWith(prefix)) {
        return res.json({
          status: 'success',
          data: { model, providers: [{ model_id: model, provider_slug: provider, provider_name: provider }] },
        });
      }
    }

    return res.json({ status: 'success', data: { model, providers: [] } });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * POST /api/v1/internal/log-request
 * Gateway submits request logs to be stored in MySQL.
 */
internalRouter.post('/log-request', async (req, res) => {
  try {
    const log = req.body;
    const [insertResult] = await pool.query<any>(
      `INSERT INTO request_logs
       (workspace_id, user_id, agent_id, action_label, conversation_turn, agent_role, session_id, request_id,
        model, provider, binding_id, api_key_id, tokens_in, tokens_out, cost_cents, latency_ms,
        status, error_message, tool_name, tool_action, execution_tier, request_input, request_output)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.workspace_id || null, log.user_id || null, log.agent_id || null,
        log.action_label || null, log.conversation_turn || null,
        log.agent_role || null, log.session_id || null,
        log.request_id || null,
        log.model || 'unknown', log.provider || 'unknown', log.binding_id || null,
        log.api_key_id || null,
        log.tokens_in || 0, log.tokens_out || 0, log.cost_cents || 0,
        log.latency_ms || 0, log.status || 200, log.error_message || null,
        log.tool_name || null, log.tool_action || null, log.execution_tier || null,
        log.request_input || null, log.request_output || null,
      ]
    );

    // Fire-and-forget: semantically summarize agent_role / action_label via LLM
    const logId = insertResult?.insertId;
    if (logId && log.request_input) {
      summarizeLogEntry(logId, log.request_input);
    }

    // Trigger budget checks (fire-and-forget)
    if (log.workspace_id) {
      checkWorkspaceBudget(log.workspace_id).catch(() => {});
      if (log.agent_id) checkAgentBudget(log.agent_id, log.workspace_id).catch(() => {});
    }

    return res.json({ status: 'ok' });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

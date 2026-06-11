/**
 * OneLLM Gateway Auth Middleware
 *
 * Validates API Keys / Agent Keys by calling the admin-api internal endpoint.
 * Sets user context (user_id, workspace_id, agent_id) on successful validation.
 *
 * Phase 1: Validates every request
 * Phase 2: Adds rate limiting and budget checks
 */

import { Context, Next } from 'hono';

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3100';

interface BudgetInfo {
  level: 'normal' | 'warning' | 'throttle' | 'cutoff';
  budget_name: string;
  percent: number;
  message: string;
}

interface KeyValidation {
  valid: boolean;
  reason?: string;
  key_type?: 'api_key' | 'agent_key';
  user_id?: string;
  workspace_id?: string;
  agent_id?: string;
  scopes?: string[];
  budget?: BudgetInfo | null;
  bindings?: Array<{
    id: string;
    provider_name: string;
    api_key: string;
    priority_order: number;
    weight: number;
    enabled: boolean;
    allowed_models: string[] | null;
    daily_budget_cents: number;
    monthly_budget_cents: number;
    rate_limit_rpm?: number;
  }>;
}

async function validateKey(apiKey: string): Promise<KeyValidation> {
  try {
    const response = await fetch(`${ADMIN_API_URL}/api/v1/internal/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    return await response.json() as KeyValidation;
  } catch (error) {
    console.error('Auth validation error:', error);
    return { valid: false, reason: 'validation_service_unavailable' };
  }
}

/**
 * Hono middleware: validates the request API key and sets context.
 *
 * Accepts key from:
 *   1. Authorization: Bearer <key> header (standard)
 *   2. x-onellm-api-key header (convenience)
 *   3. x-aihub-api-key header (old compat, deprecated)
 *   4. x-portkey-api-key header (legacy compat)
 */
export async function onellmAuth(c: Context, next: Next) {
  // Skip auth for health check and public endpoints
  const path = c.req.path;
  if (path === '/' || path.startsWith('/public/') || path.startsWith('/api/')) {
    return next();
  }

  // Extract API key
  const authHeader = c.req.header('Authorization');
  let apiKey = '';

  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  } else {
    // Try new header first, fallback to old (backward compat), then legacy Portkey
    apiKey = c.req.header('x-onellm-api-key')
          || c.req.header('x-aihub-api-key')
          || c.req.header('x-portkey-api-key')
          || '';
  }

  if (!apiKey) {
    c.set('onellm_auth', { authenticated: false, reason: 'no_key' });
    return next();
  }

  // Only validate OneLLM keys; let provider keys (sk-*, claude-*, etc.) pass through
  // Phase 2: recognize both new (onellm_*) and old (aihub_*) key prefixes for backward compat
  const isOneLLMKey = apiKey.startsWith('onellm_sk_') || apiKey.startsWith('onellm_ag_')
                   || apiKey.startsWith('aihub_sk_') || apiKey.startsWith('aihub_ag_');

  if (isOneLLMKey) {
    const result = await validateKey(apiKey);

    if (!result.valid) {
      // Budget cutoff → 402 Payment Required
      if (result.budget?.level === 'cutoff') {
        return c.json({
          status: 'error',
          code: 'budget_exceeded',
          message: result.budget.message,
          budget: result.budget,
        }, 402);
      }
      return c.json({
        status: 'error',
        message: `Invalid OneLLM API key: ${result.reason}`,
      }, 401);
    }

    // Set auth context for downstream handlers and logging
    c.set('onellm_auth', {
      authenticated: true,
      key_type: result.key_type,
      api_key_id: (result as any).api_key_id || null,
      user_id: result.user_id,
      workspace_id: result.workspace_id,
      agent_id: result.agent_id,
      scopes: result.scopes,
    });

    // Store bindings for auto-injection (virtual key → real provider keys, 1:N)
    if (result.bindings && result.bindings.length > 0) {
      c.set('onellm_bindings', result.bindings);
    }

    // Budget warning/throttle → add response headers for client awareness
    if (result.budget) {
      c.header('x-onellm-budget-level', result.budget.level);
      c.header('x-onellm-budget-message', encodeURIComponent(result.budget.message));
      // Backward compat: also send old header names
      c.header('x-aihub-budget-level', result.budget.level);
      c.header('x-aihub-budget-message', encodeURIComponent(result.budget.message));
    }
  } else {
    // Provider key — pass through, mark as external
    c.set('onellm_auth', { authenticated: false, reason: 'external_provider_key' });
  }

  return next();
}

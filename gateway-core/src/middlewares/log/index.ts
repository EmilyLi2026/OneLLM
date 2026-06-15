import { Context } from 'hono';
import { getRuntimeKey } from 'hono/adapter';
import { calculateCost } from '../../services/pricingService';

const ADMIN_API_URL = process.env.ADMIN_API_URL || 'http://localhost:3100';

let logId = 0;
const MAX_RESPONSE_LENGTH = 100000;

// Map to store all connected log clients
const logClients: Map<string | number, any> = new Map();

const addLogClient = (clientId: any, client: any) => {
  logClients.set(clientId, client);
};

const removeLogClient = (clientId: any) => {
  logClients.delete(clientId);
};

const sanitizeHeaders = (headers: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.keys(headers).map((key) => [key, '[REDACTED]']));

const ALLOWED_PROVIDER_OPTION_KEYS = new Set([
  'provider',
  'overrideParams',
  'retry',
  'cache',
  'requestURL',
  'rubeusURL',
]);

const sanitizeProviderOptions = (
  providerOptions: Record<string, unknown> = {}
) =>
  Object.fromEntries(
    Object.entries(providerOptions).map(([key, value]) => [
      key,
      ALLOWED_PROVIDER_OPTION_KEYS.has(key) ? value : '[REDACTED]',
    ])
  );

const sanitizeRequestOption = (requestOption: any) => {
  if (!requestOption || typeof requestOption !== 'object') return requestOption;

  const sanitizedOption = { ...requestOption };

  if (
    sanitizedOption.providerOptions &&
    typeof sanitizedOption.providerOptions === 'object'
  ) {
    sanitizedOption.providerOptions = sanitizeProviderOptions(
      sanitizedOption.providerOptions as Record<string, unknown>
    );
  }

  if (
    sanitizedOption.transformedRequest &&
    typeof sanitizedOption.transformedRequest === 'object'
  ) {
    sanitizedOption.transformedRequest = {
      ...sanitizedOption.transformedRequest,
    };
    if (sanitizedOption.transformedRequest.headers) {
      sanitizedOption.transformedRequest.headers = sanitizeHeaders(
        sanitizedOption.transformedRequest.headers as Record<string, unknown>
      );
    }
  }

  if (
    sanitizedOption.responseHeaders &&
    typeof sanitizedOption.responseHeaders === 'object'
  ) {
    sanitizedOption.responseHeaders = sanitizeHeaders(
      sanitizedOption.responseHeaders as Record<string, unknown>
    );
  }

  return sanitizedOption;
};

const broadcastLog = async (log: any) => {
  const message = {
    data: log,
    event: 'log',
    id: String(logId++),
  };

  const deadClients: any = [];

  // Run all sends in parallel
  await Promise.all(
    Array.from(logClients.entries()).map(async ([id, client]) => {
      try {
        await Promise.race([
          client.sendLog(message),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Send timeout')), 1000)
          ),
        ]);
      } catch (error: any) {
        console.error(`Failed to send log to client ${id}:`, error.message);
        deadClients.push(id);
      }
    })
  );

  // Remove dead clients after iteration
  deadClients.forEach((id: any) => {
    removeLogClient(id);
  });
};

/**
 * Extract Agent-specific metadata from request headers.
 * Phase 0: these headers are optional and default to null.
 * Phase 2: these become mandatory for Agent-originated requests.
 */
function extractAgentContext(c: Context): Record<string, string | number | null> {
  return {
    agent_id: c.req.header('x-onellm-agent-id') || c.req.header('x-aihub-agent-id') || null,
    tool_name: c.req.header('x-onellm-tool-name') || c.req.header('x-aihub-tool-name') || null,
    tool_action: c.req.header('x-onellm-tool-action') || c.req.header('x-aihub-tool-action') || null,
    execution_tier: c.req.header('x-onellm-execution-tier')
      ? parseInt(c.req.header('x-onellm-execution-tier')!, 10)
      : c.req.header('x-aihub-execution-tier')
        ? parseInt(c.req.header('x-aihub-execution-tier')!, 10)
        : null,
    // User/Workspace context (set by admin-console Playground)
    workspace_id: c.req.header('x-onellm-workspace-id') || c.req.header('x-aihub-workspace-id') || null,
    user_id: c.req.header('x-onellm-user-id') || c.req.header('x-aihub-user-id') || null,
  };
}

/**
 * Extract plain text from message content, which may be:
 *   - OpenAI format: string (e.g. "Hello")
 *   - Anthropic format: array of content blocks (e.g. [{type:"text", text:"Hello"}])
 */
function extractTextContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text' && block.text)
      .map((block: any) => block.text)
      .join('\n');
  }
  return '';
}

/**
 * Derive conversation labels from the request messages — no client cooperation needed.
 * Uses rule-based extraction to semantically distill key info from prompts.
 * Extracts: agent_role (role title), action_label (action intent),
 * conversation_turn (message count), session_id (fingerprint for grouping).
 */
function deriveLabelsFromMessages(requestOptionsArray: any[]): Record<string, any> {
  const messages = requestOptionsArray[0]?.requestParams?.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { agent_role: null, action_label: null, conversation_turn: null, session_id: null };
  }

  // Find system prompt → agent's role/identity
  // Anthropic: system is top-level, not in messages. Check top-level system field too.
  const systemMsg = messages.find((m: any) => m.role === 'system');
  const systemContent = extractTextContent(systemMsg?.content)
    || extractTextContent(requestOptionsArray[0]?.requestParams?.system)
    || '';

  // Find user messages → current action
  const userMessages = messages.filter((m: any) => m.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1];

  // Simple session fingerprint: hash the unique conversation identity
  const sessionSource = systemContent || extractTextContent(lastUserMsg?.content) || '';
  const sessionId = sessionSource
    ? `sess_${simpleHash(sessionSource.substring(0, 200))}`
    : null;

  return {
    agent_role: extractAgentRole(systemContent),
    action_label: extractActionLabel(extractTextContent(lastUserMsg?.content)),
    conversation_turn: userMessages.length || null,
    session_id: sessionId,
  };
}

/**
 * Semantically extract just the agent's role title from system prompt.
 * Rules (in priority order):
 *   1. "- Role: XXX" → "XXX"
 *   2. "你是XXX" / "你是一个XXX" → "XXX"
 *   3. First sentence, truncated
 */
function extractAgentRole(content: string): string | null {
  if (!content) return null;

  // Pattern 1: "- Role: 角色名 -" (common in structured prompts)
  const roleMatch = content.match(/-\s*Role:\s*(.+?)(?:\s*-\s*|\n|$)/);
  if (roleMatch) return roleMatch[1].trim();

  // Pattern 2a: "你是XXX" (end at first punctuation)
  const youAre = content.match(/你是(?:一个?|专业的?|)?(.{2,50}?)[，,。\.!！;；]/);
  if (youAre) return youAre[1].trim();

  // Pattern 2b: "你是一个XXX" (no following punctuation, take up to 40 chars)
  const youAreSimple = content.match(/你是(?:一个?|专业的?|)(.{2,40})$/);
  if (youAreSimple) return youAreSimple[1].trim();

  // Fallback: clean and take first 80 chars
  return content.replace(/\s+/g, ' ').trim().substring(0, 80);
}

/**
 * Semantically extract the action intent from the user message.
 * Rules (in priority order):
 *   1. Text before structured data ({, 【, 根据如下)
 *   2. First sentence
 *   3. Truncated
 */
function extractActionLabel(content: string): string | null {
  if (!content) return null;

  // Clean but preserve structure
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  // Pattern 1: text before structured data markers
  const structMarkers = ['{', '【', '根据如下', '如下内容'];
  let beforeStruct = cleaned;
  for (const marker of structMarkers) {
    const idx = cleaned.indexOf(marker);
    if (idx > 10) {
      const candidate = cleaned.substring(0, idx).trim();
      if (candidate.length >= 4) {
        beforeStruct = candidate;
        break;
      }
    }
  }

  // If action text before structured data is reasonable, use it
  if (beforeStruct.length >= 4 && beforeStruct.length <= 200) {
    return stripTrailingPunct(beforeStruct);
  }

  // Pattern 2: first sentence (up to 150 chars)
  const firstSentence = cleaned.split(/[。！？\n]/)[0].trim();
  if (firstSentence.length <= 150) return stripTrailingPunct(firstSentence);

  // Fallback: truncate
  return stripTrailingPunct(firstSentence.substring(0, 150)) + '…';
}

/** Strip trailing colon, comma, semicolon from extracted text */
function stripTrailingPunct(s: string): string {
  return s.replace(/[：:，,；;、\s]+$/, '').trim();
}

/** Cross-runtime simple string hash (no Buffer needed) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
}

async function processLog(c: Context, start: number) {
  const ms = Date.now() - start;
  if (!c.req.url.includes('/v1/')) return;

  const requestOptionsArray = c.get('requestOptions');
  if (!requestOptionsArray?.length) {
    return;
  }

  // Extract Agent context and auth context (moved up for stream usage access)
  const agentContext = extractAgentContext(c);
  const authContext = c.get('onellm_auth') || {};

  try {
    let response: any;
    if (requestOptionsArray[0]?.requestParams?.stream) {
      // For streaming responses, await the usage + output promises set by streamHandler
      const usagePromise = c.get('streamUsagePromise') as Promise<any> | undefined;
      const outputPromise = c.get('streamOutputPromise') as Promise<string> | undefined;

      if (usagePromise || outputPromise) {
        const [streamUsage, streamOutput] = await Promise.all([
          usagePromise || Promise.resolve(null),
          outputPromise || Promise.resolve(null),
        ]);

        // Build synthetic response so downstream extractors can read usage + content
        const syntheticResponse: any = {};
        if (streamUsage) syntheticResponse.usage = streamUsage;
        if (streamOutput) {
          syntheticResponse.choices = [{ message: { content: streamOutput } }];
        }
        requestOptionsArray[0].response = syntheticResponse;
        response = syntheticResponse;
      } else {
        response = { message: 'The response was a stream.' };
      }
    } else {
      response = await c.res.clone().json();
    }

    const responseString = JSON.stringify(response);
    if (responseString.length > MAX_RESPONSE_LENGTH) {
      requestOptionsArray[0].response =
        responseString.substring(0, MAX_RESPONSE_LENGTH) + '...';
    } else {
      requestOptionsArray[0].response = response;
    }
  } catch (error) {
    console.error('Error processing log:', error);
  }

  // Extract token usage from response (if available)
  const responseBody = requestOptionsArray[0]?.response;
  let tokensIn = 0, tokensOut = 0;
  if (responseBody?.usage) {
    // OpenAI format: prompt_tokens / completion_tokens
    // Anthropic format: input_tokens / output_tokens
    tokensIn = responseBody.usage.prompt_tokens || responseBody.usage.input_tokens || 0;
    tokensOut = responseBody.usage.completion_tokens || responseBody.usage.output_tokens || 0;
  }

  // Calculate cost
  const model = requestOptionsArray[0]?.requestParams?.model || 'unknown';
  const provider = requestOptionsArray[0]?.providerOptions?.provider
    || requestOptionsArray[0]?.provider
    || 'unknown';
  const costCents = calculateCost(provider, model, tokensIn, tokensOut);

  // Resolve binding_id: prefer response header (set by fallback handler), fall back to context
  const bindingId = (c.res.headers.get('x-onellm-binding-id') as string)
    || (c.res.headers.get('x-aihub-binding-id') as string)
    || (c.get('onellm_binding_id') as string)
    || null;

  // Resolve api_key_id from auth context (permanent key attribution)
  const apiKeyId = authContext.api_key_id || null;

  // Derive conversation labels from request messages (zero-cost, from in-memory request body)
  const derivedLabels = deriveLabelsFromMessages(requestOptionsArray);

  // Extract full input/output content for conversation logging (MEDIUMTEXT)
  const messages = requestOptionsArray[0]?.requestParams?.messages || [];
  const requestInput = messages.length > 0
    ? JSON.stringify({ messages })
    : null;
  const requestOutput = responseBody?.choices?.[0]?.message?.content
    || responseBody?.content
    || null;

  // Build log entry
  const logEntry = {
    time: new Date().toLocaleString(),
    method: c.req.method,
    endpoint: c.req.url.split(':8787')[1],
    status: c.res.status,
    duration: ms,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_cents: costCents,
    model,
    provider,
    // Auth context
    user_id: authContext.user_id || null,
    workspace_id: authContext.workspace_id || null,
    agent_id: authContext.agent_id || null,
    // Agent context
    agent: agentContext,
    requestOptions: requestOptionsArray.map(sanitizeRequestOption),
    // OneLLM failover tracking
    onellm_binding_id: bindingId,
    onellm_fallback_attempts: c.res.headers.get('x-onellm-fallback-attempts') || c.res.headers.get('x-aihub-fallback-attempts') || '0',
  };

  // Highlight failover events in console
  const fallbackAttempts = c.res.headers.get('x-onellm-fallback-attempts') || c.res.headers.get('x-aihub-fallback-attempts') || '0';
  if (bindingId && fallbackAttempts !== '0') {
    console.log(
      `\n🔄 [OneLLM LOG] Fallback used! binding=${bindingId} attempts=${fallbackAttempts} model=${model} final_provider=${provider} status=${c.res.status}`
    );
  }

  // Broadcast to local UI
  await broadcastLog(JSON.stringify(logEntry));

  // Forward to admin-api for persistent storage (fire-and-forget)
  fetch(`${ADMIN_API_URL}/api/v1/internal/log-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: authContext.workspace_id || agentContext.workspace_id || null,
      user_id: authContext.user_id || agentContext.user_id || null,
      agent_id: authContext.agent_id || agentContext.agent_id || null,
      action_label: derivedLabels.action_label || null,
      conversation_turn: derivedLabels.conversation_turn || null,
      agent_role: derivedLabels.agent_role || null,
      session_id: derivedLabels.session_id || null,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      model: model,
      provider: provider,
      binding_id: bindingId,
      api_key_id: apiKeyId,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_cents: costCents,
        latency_ms: ms,
        status: c.res.status,
        tool_name: agentContext.tool_name,
        tool_action: agentContext.tool_action,
        execution_tier: agentContext.execution_tier,
        request_input: requestInput,
        request_output: requestOutput,
      }),
    }).catch(() => {}); // Silently ignore forward failures
}

export const logHandler = () => {
  return async (c: Context, next: any) => {
    c.set('addLogClient', addLogClient);
    c.set('removeLogClient', removeLogClient);

    const start = Date.now();

    await next();

    const runtime = getRuntimeKey();

    if (runtime == 'workerd') {
      c.executionCtx.waitUntil(processLog(c, start));
    } else if (['node', 'bun', 'deno'].includes(runtime)) {
      processLog(c, start).then().catch(console.error);
    }
  };
};

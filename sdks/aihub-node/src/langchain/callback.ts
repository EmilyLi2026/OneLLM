/**
 * LangChain Callback Handler for AI Hub
 *
 * Provides automatic tracing of LangChain LLM calls, chain executions,
 * tool invocations, and retriever queries through the AI Hub gateway.
 *
 * @module langchain/callback
 *
 * @example
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { LangchainCallbackHandler } from '@ai-hub/node/langchain';
 *
 * const handler = new LangchainCallbackHandler({
 *   apiKey: 'your-aihub-key',
 *   baseURL: 'https://your-gateway.aihub.com/v1',
 * });
 *
 * const llm = new ChatOpenAI({
 *   model: 'deepseek-chat',
 *   configuration: {
 *     baseURL: 'https://your-gateway.aihub.com/v1',
 *   },
 *   callbacks: [handler],
 * });
 * ```
 *
 * NOTE: This module requires `@langchain/core` to be installed separately.
 *   npm install @langchain/core
 */

// ─── Types ───────────────────────────────────────────────────

interface CallbackConfig {
  /** AI Hub API Key (aihub_sk_xxx or aihub_ag_xxx) */
  apiKey: string;
  /** AI Hub Gateway base URL (default: http://localhost:8787/v1) */
  baseURL?: string;
  /** Optional metadata to attach to all log events */
  metadata?: Record<string, unknown>;
}

interface LLMOutput {
  llmOutput?: {
    tokenUsage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number };
    modelName?: string;
  };
  generations?: Array<Array<{ text?: string; message?: { content?: string } }>>;
}

interface ChainInput {
  [key: string]: unknown;
}

interface ChainOutput {
  [key: string]: unknown;
}

interface Document {
  pageContent?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Event types ─────────────────────────────────────────────

type EventType = 'llm' | 'chain' | 'tool' | 'retriever';

interface LogEvent {
  _source: 'langchain';
  _source_type: 'agent';
  event_type: EventType;
  event_name: string;
  start_time: number;
  end_time: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  run_id: string;
  parent_run_id?: string;
  error?: string;
}

// ─── Handler ─────────────────────────────────────────────────

export class LangchainCallbackHandler {
  public name = 'aihub_langchain_callback';

  private apiKey: string;
  private baseURL: string;
  private metadata: Record<string, unknown>;
  private eventMap: Map<string, LogEvent> = new Map();
  private eventArray: LogEvent[] = [];

  constructor(config: CallbackConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'http://localhost:8787/v1';
    this.metadata = {
      _source: 'langchain',
      _source_type: 'Agent',
      ...config.metadata,
    };
  }

  // ── LLM events ───────────────────────────────────────────

  async handleLLMStart(
    llm: { name?: string; _modelType?: string; [key: string]: unknown },
    prompts: string[],
    runId: string,
    parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    const modelName = (llm as any).model || (llm as any).modelName || llm.name || 'unknown';
    const event: LogEvent = {
      _source: 'langchain',
      _source_type: 'agent',
      event_type: 'llm',
      event_name: `${modelName}.start`,
      start_time: Date.now(),
      end_time: 0,
      input: { prompts, model: modelName, model_kwargs: { ...llm } },
      run_id: runId,
      parent_run_id: parentRunId,
    };
    this.eventMap.set(runId, event);
  }

  async handleLLMEnd(
    output: LLMOutput,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.output = {
      generations: output.generations?.map((gen) =>
        gen.map((g) => ({
          text: g.text || g.message?.content || '',
        }))
      ),
      token_usage: output.llmOutput?.tokenUsage,
      model_name: output.llmOutput?.modelName,
    };

    this.eventMap.delete(runId);
    this.eventArray.push(event);

    // If this is a top-level event (no parent), flush
    if (!parentRunId) {
      await this.flush();
    }
  }

  async handleLLMError(
    err: Error | string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.error = typeof err === 'string' ? err : err.message;
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  // ── Chain events ─────────────────────────────────────────

  async handleChainStart(
    chain: { name?: string; [key: string]: unknown },
    inputs: ChainInput,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    const chainName = chain.name || 'unknown_chain';
    const event: LogEvent = {
      _source: 'langchain',
      _source_type: 'agent',
      event_type: 'chain',
      event_name: `${chainName}.start`,
      start_time: Date.now(),
      end_time: 0,
      input: inputs as Record<string, unknown>,
      run_id: runId,
      parent_run_id: parentRunId,
    };
    this.eventMap.set(runId, event);
  }

  async handleChainEnd(
    outputs: ChainOutput,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.output = outputs;
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  async handleChainError(
    err: Error | string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.error = typeof err === 'string' ? err : err.message;
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  // ── Tool events ──────────────────────────────────────────

  async handleToolStart(
    tool: { name?: string; [key: string]: unknown },
    input: string,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    const toolName = tool.name || 'unknown_tool';
    const event: LogEvent = {
      _source: 'langchain',
      _source_type: 'agent',
      event_type: 'tool',
      event_name: `${toolName}.start`,
      start_time: Date.now(),
      end_time: 0,
      input: { tool_input: input, tool_name: toolName },
      run_id: runId,
      parent_run_id: parentRunId,
    };
    this.eventMap.set(runId, event);
  }

  async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.output = { tool_output: output };
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  async handleToolError(
    err: Error | string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.error = typeof err === 'string' ? err : err.message;
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  // ── Retriever events ─────────────────────────────────────

  async handleRetrieverStart(
    retriever: { name?: string; [key: string]: unknown },
    query: string,
    runId: string,
    parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    const retrieverName = retriever.name || 'unknown_retriever';
    const event: LogEvent = {
      _source: 'langchain',
      _source_type: 'agent',
      event_type: 'retriever',
      event_name: `${retrieverName}.start`,
      start_time: Date.now(),
      end_time: 0,
      input: { query, retriever_name: retrieverName },
      run_id: runId,
      parent_run_id: parentRunId,
    };
    this.eventMap.set(runId, event);
  }

  async handleRetrieverEnd(
    documents: Document[],
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.output = {
      documents: documents.map((d) => ({
        page_content: d.pageContent?.substring(0, 500) || '',
        metadata: d.metadata || {},
      })),
      document_count: documents.length,
    };
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  async handleRetrieverError(
    err: Error | string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event = this.eventMap.get(runId);
    if (!event) return;

    event.end_time = Date.now();
    event.error = typeof err === 'string' ? err : err.message;
    this.eventMap.delete(runId);
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  // ── Agent events (LangChain AgentExecutor) ───────────────

  async handleAgentAction(
    action: { tool?: string; toolInput?: unknown; log?: string; [key: string]: unknown },
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    const event: LogEvent = {
      _source: 'langchain',
      _source_type: 'agent',
      event_type: 'tool',
      event_name: `agent_action.${action.tool || 'unknown'}`,
      start_time: Date.now(),
      end_time: Date.now(),
      input: { tool: action.tool, tool_input: action.toolInput, log: action.log },
      run_id: runId,
      parent_run_id: parentRunId,
    };
    this.eventArray.push(event);

    if (!parentRunId) {
      await this.flush();
    }
  }

  // ── Text (for backward compatibility with older LangChain) ──

  async handleText(
    text: string,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    // No-op: handleText is a legacy callback, we don't track raw text
    void text;
    void runId;
    void parentRunId;
  }

  // ── Flush ────────────────────────────────────────────────

  /**
   * Send all accumulated events to the AI Hub gateway.
   * Called automatically when a top-level event completes.
   */
  async flush(): Promise<void> {
    if (this.eventArray.length === 0) return;

    const events = [...this.eventArray];
    this.eventArray = [];

    try {
      await fetch(`${this.baseURL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onellm-api-key': this.apiKey,
          'x-aihub-api-key': this.apiKey, // backward compat
          'x-portkey-api-key': this.apiKey,
        },
        body: JSON.stringify({
          events,
          metadata: this.metadata,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Silently fail — don't break the user's LangChain app
      // Events are stored in memory and can be re-flushed manually
    }
  }

  /**
   * Get all currently buffered events (for manual inspection)
   */
  getEvents(): LogEvent[] {
    return [...this.eventArray, ...this.eventMap.values()];
  }

  /**
   * Clear all buffered events without sending
   */
  clearEvents(): void {
    this.eventArray = [];
    this.eventMap.clear();
  }
}

export default LangchainCallbackHandler;

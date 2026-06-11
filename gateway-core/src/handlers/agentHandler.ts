/**
 * Agent API Handler — Phase 0 MVP
 *
 * Provides simple Agent registration and cost tracking API.
 * Phase 0 uses in-memory storage. Phase 1 migrates to PostgreSQL.
 */

import { Context } from 'hono';

// ── In-Memory Agent Store (Phase 0) ──

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  created_at: string;
  // Cost tracking
  total_tokens: number;
  total_cost: number;
  // Token breakdown
  tokens_by_model: Record<string, { tokens: number; cost: number }>;
  tasks: Record<string, { tokens: number; cost: number; last_active: string }>;
}

const agentStore: Map<string, Agent> = new Map();

// Simple ID generator
function generateId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ── Route Handlers ──

/** POST /api/v1/agents — Register a new Agent */
export async function registerAgent(c: Context) {
  try {
    const body = await c.req.json();
    const id = generateId();

    const agent: Agent = {
      id,
      name: body.name || 'Unnamed Agent',
      description: body.description || '',
      model: body.model || 'default',
      created_at: new Date().toISOString(),
      total_tokens: 0,
      total_cost: 0,
      tokens_by_model: {},
      tasks: {},
    };

    agentStore.set(id, agent);

    return c.json({
      status: 'success',
      data: {
        id: agent.id,
        name: agent.name,
        created_at: agent.created_at,
        api_key: `aihub_${id}`, // Phase 1: proper JWT key generation
      },
    }, 201);
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 400);
  }
}

/** GET /api/v1/agents — List all registered Agents with cost summary */
export async function listAgents(c: Context) {
  const agents = Array.from(agentStore.values()).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    model: a.model,
    created_at: a.created_at,
    total_tokens: a.total_tokens,
    total_cost: a.total_cost,
    task_count: Object.keys(a.tasks).length,
  }));

  return c.json({ status: 'success', data: agents });
}

/** GET /api/v1/agents/:id — Get single Agent details */
export async function getAgent(c: Context) {
  const id = c.req.param('id');
  const agent = agentStore.get(id);

  if (!agent) {
    return c.json({ status: 'error', message: 'Agent not found' }, 404);
  }

  return c.json({ status: 'success', data: agent });
}

/** GET /api/v1/agents/:id/cost — Get detailed cost breakdown for an Agent */
export async function getAgentCost(c: Context) {
  const id = c.req.param('id');
  const agent = agentStore.get(id);

  if (!agent) {
    return c.json({ status: 'error', message: 'Agent not found' }, 404);
  }

  // Parse optional time range
  const period = c.req.query('period') || 'all'; // all | today | week | month
  const taskFilter = c.req.query('task_id');

  let tasks = Object.entries(agent.tasks);
  if (taskFilter) {
    tasks = tasks.filter(([tid]) => tid === taskFilter);
  }

  return c.json({
    status: 'success',
    data: {
      agent_id: agent.id,
      agent_name: agent.name,
      period,
      summary: {
        total_tokens: agent.total_tokens,
        total_cost: agent.total_cost,
      },
      by_model: agent.tokens_by_model,
      by_task: tasks.map(([taskId, t]) => ({
        task_id: taskId,
        tokens: t.tokens,
        cost: t.cost,
        last_active: t.last_active,
      })),
    },
  });
}

/**
 * Internal function: update agent cost stats from log data.
 * Called by the log middleware when agent_id header is present.
 * Phase 0: manual cost calculation from pricing data.
 * Phase 1: real-time pricing integration with models data.
 */
export function recordAgentUsage(
  agentId: string,
  taskId: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  estimatedCost: number
) {
  const agent = agentStore.get(agentId);
  if (!agent) return; // Unknown agent, skip silently

  const tokens = tokensIn + tokensOut;

  // Update totals
  agent.total_tokens += tokens;
  agent.total_cost += estimatedCost;

  // Update by-model breakdown
  if (!agent.tokens_by_model[model]) {
    agent.tokens_by_model[model] = { tokens: 0, cost: 0 };
  }
  agent.tokens_by_model[model].tokens += tokens;
  agent.tokens_by_model[model].cost += estimatedCost;

  // Update by-task breakdown
  if (!agent.tasks[taskId]) {
    agent.tasks[taskId] = { tokens: 0, cost: 0, last_active: '' };
  }
  agent.tasks[taskId].tokens += tokens;
  agent.tasks[taskId].cost += estimatedCost;
  agent.tasks[taskId].last_active = new Date().toISOString();
}

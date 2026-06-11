# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneLLM is an LLM Gateway → Agent Control Plane product built on the Portkey open-source gateway engine. It provides unified API access to 50+ model providers, cost tracking, enterprise governance (RBAC/SSO/audit), and Agent control (budget circuit-breaker, dead-loop detection, tiered execution).

Current phase: **M0 (foundation)** → transitioning to **M1 (core gateway productization)**.

## Monorepo Structure

```
onellm/
├── gateway-core/       # Core gateway engine (TypeScript + Hono) — 50+ LLM provider adapters
├── admin-api/          # Management backend API (Node.js + Express + TypeScript + MySQL)
├── admin-console/      # Management dashboard UI (React + TypeScript + Ant Design + Vite)
├── frontend/           # Public marketing site / OneLLM frontend (React + Tailwind + Vite)
├── agent-control-plane/ # Agent Control Plane (Phase 2, planned — currently empty src/)
├── sdks/               # Client SDKs: aihub-node, aihub-python
├── dev-tools/smoke-test/ # Provider connectivity smoke tests
├── deploy/charts/      # K8s Helm charts
├── docs/               # Integration examples & documentation
└── docker-compose.yml  # Dev environment: gateway + Redis (PostgreSQL planned)
```

## Common Commands

### Start Development Services

```bash
# Gateway (default port 8787)
cd gateway-core && npm run dev:node
# Or with custom port:
npx tsx src/start-server.ts --port=9799

# Admin API (default port 3100)
cd admin-api && npx tsx src/index.ts

# Admin Console (default port 3101)
cd admin-console && npx vite

# Public frontend
cd frontend && npm run dev
```

### Testing

```bash
# Gateway unit tests
cd gateway-core && npm run test:gateway
cd gateway-core && npm run test:plugins

# Provider smoke test (requires gateway running)
cd dev-tools/smoke-test
npx tsx provider-smoke.ts                    # all providers
npx tsx provider-smoke.ts -p deepseek        # single provider
npx tsx provider-smoke.ts --json -f          # CI mode: JSON, failures only
```

### Database

```bash
# Run migrations (creates/alters tables)
cd admin-api && npx tsx src/db/migrate.ts

# Manual MySQL connection (credentials in admin-api .env)
mysql -u icp_user -p -h 123.249.47.125 -P 13306 portkey
```

### Docker

```bash
docker-compose up -d    # gateway + Redis
```

### Build

```bash
cd gateway-core && npm run build    # Rollup bundle
cd admin-api && npm run build       # tsc
cd admin-console && npm run build   # vite build
```

## Architecture & Key Design Decisions

### Authentication Flow (two code paths)

1. **Provider Key (backward compat)**: Request with `x-portkey-api-key: sk-xxx` → gateway forwards directly to upstream LLM provider. No auth check.

2. **AI Hub Key (new)**: Request with `x-aihub-api-key: aihub_sk_xxx` or `aihub_ag_xxx` → `aihubAuth.ts` middleware in gateway → calls `admin-api /api/v1/internal/validate-key` → returns decrypted provider key + bindings → gateway forwards with real provider key.

### Key Types

| Prefix | Type | Purpose |
|--------|------|---------|
| `aihub_sk_` | API Key | General API access, can bind to multiple providers |
| `aihub_ag_` | Agent Key | Agent-specific, carries agent_id in auth context |

### Key ↔ Provider Binding (1:N)

A single AI Hub key can bind to multiple provider credentials. Bindings are stored in `key_provider_bindings` table. The `x-aihub-provider` header selects which binding to use; if omitted, the first active binding is used.

### Gateway Middleware Pipeline

Request → `requestValidator` → `aihubAuth` (if OneLLM key detected) → handler → provider adapter → upstream LLM

### Admin API Route Structure

- `/api/v1/auth/*` — public: register, login (JWT)
- `/api/v1/internal/*` — service-to-service: validate-key, log-request (no JWT)
- `/api/v1/keys`, `/api/v1/agents`, `/api/v1/providers`, etc. — protected (JWT required)
- `/api/v1/models/rankings` — public: OpenRouter model rankings
- `/api/v1/public/plans` — public: pricing plans

### Database

MySQL 8.0 at `123.249.47.125:13306`, database `portkey`. Key tables:
- `users`, `workspaces`, `workspace_members` — multi-tenant isolation
- `api_keys`, `agent_keys` — key hashes stored with bcrypt
- `provider_credentials` — encrypted provider API keys
- `key_provider_bindings` — 1:N key→provider mapping
- `request_logs` — gateway call logs with agent_id, cost tracking
- `audit_logs` — all admin operations (immutable, append-only)
- `budget_alerts` — 80%/100% threshold alerts
- `model_specs`, `model_providers`, `model_series` — synced from OpenRouter

### Budget System

Workspace-level monthly/daily budget in cents. When a request log is written, the budget service checks against thresholds:
- 80% → `workspace_monthly_80` alert
- 100% → `workspace_monthly_100` alert, `is_exceeded: true`
- Budget of `0` = unlimited (no alerts)

## Provider Adapters

Located in `gateway-core/src/providers/`. Each provider is a config object implementing `ProviderConfigs` interface. New providers are registered in `providers/index.ts`. The smoke test (`dev-tools/smoke-test/provider-smoke.ts`) has a corresponding `PROVIDER_CONFIGS` array for validation.

## Adding a New Provider

1. Create `gateway-core/src/providers/<name>/` with provider config
2. Register in `gateway-core/src/providers/index.ts`
3. Add smoke test entry in `dev-tools/smoke-test/provider-smoke.ts`
4. Add pricing data if available in `gateway-core/pricing/`

## Port Conventions

| Service | Default Port | Custom Port |
|---------|-------------|-------------|
| gateway-core | 8787 | 9799 (used in test scripts) |
| admin-api | 3000 | 3100 (used in dev) |
| admin-console | — | 3101 (vite) |

## Project Status

- M0 (W0-W2): ✅ Gateway runs, 50+ providers, Agent API endpoints, Docker Compose
- M1 (W3-W6): 🔄 In progress — admin API + console MVP, enterprise features
- M2-M5: 📋 Planned — see `PROJECT_PLAN.md`

## Based On

This product builds on MIT-licensed Portkey open-source projects:
- [Portkey AI Gateway](https://github.com/Portkey-AI/gateway) — core routing engine
- [Portkey Models](https://github.com/Portkey-AI/models) — model pricing data
- [Portkey MCP Tool Filter](https://github.com/Portkey-AI/mcp-tool-filter) — MCP tool filtering

<p align="center">
  <h1 align="center">🚀 OneLLM</h1>
  <p align="center">
    <strong>One API, Every Model. Under Control.</strong>
  </p>
  <p align="center">
    ai-gateway  llm-gateway agent-control openai-compatible
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/providers-84-orange" alt="84 Providers">
</p>

---

Consolidate all your scattered LLM API keys into a single entry point — with cost tracking, access control, and audit logging built in.

```bash
# Before: one key per provider, scattered everywhere
OPENAI_KEY=sk-xxx
DEEPSEEK_KEY=sk-yyy
GLM_KEY=sk-zzz

# After: one key to rule them all
curl http://your-gateway:8787/v1/chat/completions \
  -H "x-aihub-api-key: aihub_sk_xxx" \
  -H "x-aihub-provider: deepseek" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## 💡 Why OneLLM

| Problem | Without OneLLM | With OneLLM |
|---------|---------------|-------------|
| Adding a new model | Apply for key → change code → redeploy | Bind provider in dashboard, code stays the same |
| Who's burning API credits | Surprise bill at end of month | Real-time dashboard + budget alerts |
| Agent runaway spending | Discovered after quota blown | Workspace-level hard budget limits |
| Teammate leaves | Rotate keys across every provider | Revoke one AI Hub key |
| Compliance & audit | ❌ No visibility | ✅ Immutable audit logs |
| Switch providers | Rewrite code, redeploy | Change one request header |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌────────────────────────────────────┐
│   Your App   │ ──→ │        gateway-core :8787          │
│  Your Agent  │     │    ┌──────────────────────────┐    │
│  Your Script │     │    │ Auth → Route → Log → Forward │  │
└─────────────┘     │    └──────────────────────────┘    │
                    │              │                      │
                    │    ┌─────────┴──────────┐          │
                    │    ▼                    ▼          │
                    │  80+ Provider Adapters   Request Logs │
                    │  OpenAI·Claude·DeepSeek·GLM·Qwen···│
                    │  Baichuan·Moonshot·MiniMax·Doubao···│
                    └────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
      │  admin-api   │    │    Redis     │    │   MySQL 8.0      │
      │  Management  │    │  Cache/Queue │    │  Users·Keys·     │
      │  :3100       │    │              │    │  Audit·Budgets   │
      └──────┬───────┘    └──────────────┘    └──────────────────┘
             │
             ▼
      ┌──────────────┐
      │admin-console │
      │  Dashboard   │
      │  :3101       │
      │React+Ant Des │
      └──────────────┘
```

---

## ✨ Highlights

- **OpenAI-compatible API** — Zero-effort migration, not a single line of code to change
- **84 providers, one endpoint** — Chinese and international, bind whichever you need
- **Virtual key system** — `aihub_sk_` for API calls / `aihub_ag_` for agents, one key → multiple providers
- **Multi-tenant workspaces** — Team isolation, member invitations, RBAC
- **Budget controls** — Monthly/daily budgets + 80%/100% threshold alerts + hard circuit breaker
- **Immutable audit logs** — Every admin action recorded append-only — who did what and when
- **Provider smoke tests** — One-click connectivity check across all vendors, CI-friendly
- **K8s ready** — Helm Charts included; Docker Compose for quick dev
- **Native SDKs** — Node.js & Python, auth logic wrapped, plug and play

---

## ⚡ Up and running in one minute

### Prerequisites

- Node.js ≥ 18
- Docker (for Redis & MySQL)
- MySQL 8.0

### 1. Gateway only (quick test)

```bash
git clone https://github.com/EmilyLi2026/OneLLM.git
cd OneLLM/gateway-core
npm install
docker-compose up -d redis
npm run dev:node

# Send a test request
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: deepseek" \
  -H "x-portkey-api-key: your-deepseek-key" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Explain AI in one sentence"}]}'
```

### 2. Full stack (Gateway + Admin API + Console)

```bash
# Step A: Set up MySQL and create the database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS onellm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Step B: Configure and run the admin API
cd admin-api
cp .env.example .env          # edit .env — fill in DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
npm install
npx tsx src/db/migrate.ts     # run schema migrations (creates tables + seed data)
npx tsx src/index.ts          # start admin API → http://localhost:3100

# Step C: Start the admin console
cd ../admin-console
npm install
npx vite                      # → http://localhost:3101
```

The schema is defined in [`admin-api/src/db/schema.sql`](admin-api/src/db/schema.sql) — it covers 10+ tables including users, workspaces, API keys, provider credentials, agents, request logs, audit logs, budget alerts, and a model catalog with 12 Chinese providers pre-seeded.

---

## 📦 Project Structure

```
OneLLM/
├── gateway-core/           # Core gateway — 84 provider adapters
├── admin-api/              # Management backend — users, keys, workspaces, audit
├── admin-console/          # Management dashboard — React + Ant Design
├── agent-control-plane/    # Agent Control Plane (Phase 2)
├── frontend/               # Marketing site
├── sdks/                   # Client SDKs (Node.js / Python)
├── dev-tools/smoke-test/   # Provider connectivity smoke tests
├── deploy/charts/          # Kubernetes Helm Charts
├── docs/                   # Integration docs & examples
└── docker-compose.yml      # One-command startup
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Gateway Engine | TypeScript + Hono |
| Admin API | Node.js + Express + TypeScript |
| Admin Frontend | React + TypeScript + Ant Design + Vite |
| Database | MySQL 8.0 |
| Cache | Redis |
| Deployment | Docker + Kubernetes (Helm) |

---

## 🗺️ Roadmap

| Phase | Focus | Status |
|-------|-------|:--:|
| M0 | Gateway engine, 15+ Chinese provider adapters, Agent API endpoints | ✅ |
| M1 | Admin API + Console MVP, RBAC, audit logs, budget alerts | 🔄 |
| M2 | Agent identity system, MCP Gateway, tool-level permissions | 📋 |
| M3 | dead-loop detection, tiered execution | 📋 |
| M4 | On-prem deployment enhancements, Agent visualization dashboard | 📋 |

---

## 🤝 Contributing

Issues and PRs are welcome! To add a new provider adapter, check out the existing implementations under [gateway-core/src/providers/](gateway-core/src/providers/). A PR template is on the way.

---

## 💬 Community & Contact

- **Issues & Feature Requests** → [GitHub Issues](https://github.com/EmilyLi2026/OneLLM/issues)
- **Enterprise / Commercial Inquiries** → `18610768620@163.com`
- **WeChat** → `wxid_m4ffy544c8z322`

  <img src="assets/kefu1.png" width="200">

> 👋 I'm the maintainer. If you're a team or company looking to manage LLM calls at scale, I'd love to hear about your use case — and happy to help with deployment, customization, or commercial licensing.

---

## 📄 License

[MIT](LICENSE) © OneLLM

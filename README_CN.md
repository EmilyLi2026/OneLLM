[![EN](https://img.shields.io/badge/lang-English-blue)](README.md)
[![ZH](https://img.shields.io/badge/lang-简体中文-green)](README_CN.md)
<p align="center">
  <h1 align="center">🚀 OneLLM</h1>
  <p align="center">
    <strong>One API, Every Model. Under Control.</strong>
  </p>
  <p align="center">
    一个入口接入 15+ 国产模型厂商 | 用得好更要管得住
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/providers-84-orange" alt="84 Providers">
</p>

---

帮你把散落各处的 LLM API Key 收拢成一个入口，顺便把成本、权限、审计也管了。

```bash
# 以前：每个模型一个 Key，散落各地
OPENAI_KEY=sk-xxx
DEEPSEEK_KEY=sk-yyy
GLM_KEY=sk-zzz

# 现在：一个 Key 打天下
curl http://your-gateway:8787/v1/chat/completions \
  -H "x-aihub-api-key: aihub_sk_xxx" \
  -H "x-aihub-provider: deepseek" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "你好"}]}'
```

---

## 💡 解决什么问题

| 场景 | 没有 OneLLM | 有了 OneLLM |
|------|------------|------------|
| 接入新模型 | 申请 Key → 改代码 → 部署 | 网关后台绑定，代码不动 |
| 谁在狂刷 API | 月底看账单傻眼 | 实时看板 + 预算告警 |
| Agent 失控 | 发现时已刷爆额度 | 工作空间预算硬限制 |
| 同事离职 | 挨个厂商轮换 Key | 吊销一个 AI Hub Key 就行 |
| 合规审计 | ❌ 无从下手 | ✅ 不可变审计日志 |
| 切换厂商 | 改代码重新上线 | 请求头改一个参数 |

---

## 🏗️ 架构

```
┌─────────────┐     ┌────────────────────────────────────┐
│   你的应用    │ ──→ │         gateway-core :8787         │
│   你的 Agent  │     │    ┌──────────────────────────┐   │
│   你的脚本    │     │    │ 认证 → 路由 → 日志 → 转发   │   │
└─────────────┘     │    └──────────────────────────┘   │
                    │              │                      │
                    │    ┌─────────┴──────────┐          │
                    │    ▼                    ▼          │
                    │  80+ 厂商适配器      请求日志        │
                    │  OpenAI·Claude·DeepSeek·GLM·Qwen··│
                    │  Baichuan·Moonshot·MiniMax·豆包··· │
                    └────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
      │  admin-api   │    │    Redis     │    │   MySQL 8.0      │
      │  管理后端     │    │   缓存/队列   │    │  用户·Key·审计·   │
      │  :3100       │    │              │    │  预算·日志       │
      └──────┬───────┘    └──────────────┘    └──────────────────┘
             │
             ▼
      ┌──────────────┐
      │admin-console │
      │  管理控制台   │
      │  :3101       │
      │React+Ant Des │
      └──────────────┘
```

---

## ✨ 亮点

- **OpenAI 兼容 API** — 零成本切换，一行代码不改
- **84 家厂商一个入口** — 国产/国际，要用哪个绑哪个
- **虚拟 Key 体系** — `aihub_sk_`（API 调用）/ `aihub_ag_`（Agent 专用），一个 Key 绑定多家厂商
- **多租户工作空间** — 团队隔离、成员邀请、RBAC 角色权限
- **预算管控** — 月/日预算 + 80%/100% 阈值告警 + 硬熔断
- **不可变审计** — 所有管理操作 append-only，谁在什么时候做了什么一目了然
- **Provider 冒烟测试** — 一键检测所有厂商连通性，CI 友好
- **K8s 就绪** — Helm Charts 开箱即用，也支持 Docker Compose 快速体验
- **原生 SDK** — Node.js / Python，封装认证逻辑，即装即用

---

## ⚡ 一分钟跑起来

### 前置条件

- Node.js ≥ 18
- Docker（用于 Redis 和 MySQL）
- MySQL 8.0

### 1. 仅启动网关（快速体验）

```bash
git clone https://github.com/EmilyLi2026/OneLLM.git
cd OneLLM/gateway-core
npm install
docker-compose up -d redis
npm run dev:node

# 发个请求试试
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: deepseek" \
  -H "x-portkey-api-key: 你的DeepSeek-Key" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "用一句话介绍人工智能"}]}'
```

### 2. 完整链路（网关 + 管理后台 + 控制台）

```bash
# 第一步：准备 MySQL 并建库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS onellm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 第二步：配置并启动管理 API
cd admin-api
cp .env.example .env          # 编辑 .env，填入 DB_HOST、DB_USER、DB_PASSWORD、DB_NAME
npm install
npx tsx src/db/migrate.ts     # 执行数据库迁移（建表 + 种子数据）
npx tsx src/index.ts          # 启动管理 API → http://localhost:3100

# 第三步：启动管理控制台
cd ../admin-console
npm install
npx vite                      # → http://localhost:3101
```

数据库 Schema 定义在 [`admin-api/src/db/schema.sql`](admin-api/src/db/schema.sql)，包含 10+ 张表：用户、工作空间、API Key、厂商凭证、Key↔Provider 绑定、Agent、请求日志、审计日志、预算告警，以及预置了 15+ 家中国模型厂商的模型目录。

---

## 📦 项目结构

```
OneLLM/
├── gateway-core/           # 核心网关 — 84 家厂商适配器
├── admin-api/              # 管理后端 — 用户/Key/工作空间/审计
├── admin-console/          # 管理控制台 — React + Ant Design
├── agent-control-plane/    # Agent 控制平面（Phase 2）
├── frontend/               # 产品官网
├── sdks/                   # 客户端 SDK（Node.js / Python）
├── dev-tools/smoke-test/   # Provider 连通性冒烟测试
├── deploy/charts/          # Kubernetes Helm Charts
├── docs/                   # 集成文档 & 示例
└── docker-compose.yml      # 一键启动
```

---

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| 网关引擎 | TypeScript + Hono |
| 管理 API | Node.js + Express + TypeScript |
| 管理前端 | React + TypeScript + Ant Design + Vite |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis |
| 部署 | Docker + Kubernetes (Helm) |

---

## 🗺️ 路线图

| 阶段 | 内容 | 状态 |
|------|------|:--:|
| M0 | 网关引擎、15+ 中国厂商适配、Agent API 端点 | ✅ |
| M1 | Admin API + Console MVP、RBAC、审计、预算告警 | 🔄 |
| M2 | Agent 身份体系、MCP Gateway、工具级权限 | 📋 |
| M3 | 死循环检测、分级管控 | 📋 |
| M4 | 私有化部署增强、Agent 可视化看板 | 📋 |

---

## 🤝 贡献

欢迎 Issue 和 PR！如果你想新增 Provider 适配器，参考 [gateway-core/src/providers/](gateway-core/src/providers/) 下的现有实现，PR 模板正在准备中。

---

## 💬 社区 & 联系

- **Issue / 功能建议** → [GitHub Issues](https://github.com/EmilyLi2026/OneLLM/issues)

- **企业 / 商业合作** → `18610768620@163.com`

- **微信** → `wxid_m4ffy544c8z322`

  <img src="assets/kefu1.png" width="200">

> 👋 我是项目维护者。如果你的团队或企业在规模化使用 LLM，欢迎聊聊你的场景——我可以协助部署、定制化开发，也支持商业授权。

---

## 📄 License

[MIT](LICENSE) © OneLLM

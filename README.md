# OneLLM

> LLM Gateway → Agent Control Plane  
> 基于 Portkey 开源引擎构建，从"帮团队管好模型调用"起步，进化为"帮企业管住 Agent 不烧钱不闯祸"。

---

## 产品愿景

```
Phase 1 (当前)          Phase 2 (未来)
═══════════════          ═══════════════

统一 API 接入            Agent 身份体系
多模型路由               MCP Gateway
成本追踪                 工具级权限
管理控制台               预算硬熔断
企业治理                 执行分级管控
私有化部署               死循环检测
                         Agent 可视化
```

## 架构

```
ai-hub/
├── gateway-core/          # 核心网关引擎 (基于 Portkey gateway-main)
│   ├── src/
│   │   ├── providers/     # 30+ 模型提供商适配器
│   │   ├── handlers/      # API 端点处理器
│   │   ├── middlewares/   # 请求/响应中间件
│   │   └── services/      # 内部服务
│   ├── pricing/           # 模型定价数据 (基于 Portkey models)
│   └── plugins/           # 护栏插件
│
├── admin-api/             # 管理后台 API (自建)
│   └── src/
│       ├── routes/        # workspace, keys, users...
│       └── services/      # auth, billing, audit...
│
├── admin-console/         # 管理控制台前端 (自建)
│   └── src/
│       └── pages/         # Dashboard, Keys, Teams...
│
├── agent-control-plane/   # Agent 控制平面 (Phase 2)
│   └── src/
│       ├── identity/      # Agent 身份 + 委托链
│       ├── policy/        # OPA 策略引擎
│       ├── budget/        # Token 预算熔断
│       └── tiering/       # 执行分级管控
│
├── sdks/                  # 客户端 SDK
│   ├── aihub-node/        # Node.js SDK
│   └── aihub-python/      # Python SDK
│
├── dev-tools/             # 开发工具
├── deploy/                # 部署配置 (K8s/Docker)
└── docs/                  # 文档与集成示例
```

## 快速开始

### 启动网关

```bash
cd gateway-core
npm install
npm run dev:node
# → http://localhost:8787
```

### 测试调用

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-portkey-api-key: sk-your-key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Docker 部署

```bash
docker-compose up -d
```

## 研发阶段

| 阶段 | 时间 | 目标 |
|------|------|------|
| **Phase 0** | 第 0-1 月 | 地基搭建：网关运行 + Agent 日志字段预留 |
| **Phase 1** | 第 1-4 月 | Portkey 能力覆盖：管理控制台 + 企业治理 |
| **Phase 2** | 第 4-7 月 | Agent 控制平面：MCP GW + 身份 + 权限 + 预算 |

## 技术栈

| 组件 | 技术 |
|------|------|
| 网关核心 | TypeScript + Hono |
| 管理后台 API | Node.js |
| 管理控制台 | React + Ant Design |
| 数据库 | PostgreSQL + ClickHouse |
| 缓存 | Redis |
| 策略引擎 | OPA |

## 基于的开源项目

本产品基于以下 MIT 许可的开源项目构建：

- [Portkey AI Gateway](https://github.com/Portkey-AI/gateway) — 核心路由引擎
- [Portkey Models](https://github.com/Portkey-AI/models) — 模型定价数据
- [Portkey MCP Tool Filter](https://github.com/Portkey-AI/mcp-tool-filter) — MCP 工具语义过滤
- [Portkey Hoot](https://github.com/Portkey-AI/hoot) — MCP 测试工具
- Portkey Node/Python SDKs — 客户端库

## License

MIT

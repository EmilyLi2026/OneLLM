# OneLLM — 产品研发计划

> 基于 Portkey 开源引擎构建，从 LLM Gateway 到 Agent Control Plane 的完整产品研发路线图。

---

## 总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   M0           M1            M2           M3            M4         M5    │
│   ├─────┼──────┼──────┼──────┼─────┼──────┼─────┼──────┼──────┼────┤    │
│   │ W0-2 │ W3-6   │ W7-10   │ W11-14  │ W15-18   │ W19-22  │ W23-26│    │
│   │      │        │         │         │          │         │       │    │
│   │ 地基  │ 核心网关│ 企业治理  │ MCP网关  │ Agent管控 │ 可视化   │ 发布  │    │
│   └──────┴────────┴─────────┴─────────┴──────────┴─────────┴───────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

| 里程碑 | 代号 | 时间 | 产出物 | 验收标准 |
|--------|------|------|--------|---------|
| **M0** | 地基搭建 | W0-W2 | 可运行的网关 + Agent API | 网关启动，Agent API 可用 |
| **M1** | 核心网关 | W3-W6 | 完整的 LLM Gateway 产品 | 统一API + 管理控制台 MVP |
| **M2** | 企业治理 | W7-W10 | 企业级管理能力 | RBAC/SSO/审计/成本管控 |
| **M3** | MCP 网关 | W11-W14 | MCP Gateway 核心 | 工具注册/发现/权限/过滤 |
| **M4** | Agent 管控 | W15-W18 | Agent 控制平面 | 身份链/预算熔断/死循环检测 |
| **M5** | 可视化与发布 | W19-W26 | 完整产品 v1.0 | Agent 可视化 + 国产化 + 正式发布 |

---

## M0 — 地基搭建（第 0-2 周）

### 目标
把 Portkey 开源代码改造成可运行的产品代码库，打通端到端调用链路。

### 当前状态
- [x] gateway-core 可启动，33 个提供商可用
- [x] Agent API 端点可用（注册/列表/成本查询）
- [x] 日志中间件已预留 Agent 字段
- [x] Monorepo 目录结构已建立
- [x] Docker Compose 已配置

### 待完成

#### 调整 0.1：中文化与品牌去 Portkey

| 文件 | 改动 | 说明 |
|------|------|------|
| `gateway-core/src/index.ts` | 修改注释和启动日志文字 | OneLLM 品牌替换 Portkey |
| `gateway-core/src/start-server.ts` | 修改启动 banner | 改为 OneLLM banner |
| `gateway-core/src/public/index.html` | 修改 Admin UI 标题 | 本地管理页面品牌更新 |
| `gateway-core/package.json` | 修改 name/description/author | `@onellm/gateway` |
| `gateway-core/conf.json` | 修改默认配置 | 只启用需要的插件 |

#### 调整 0.2：端到端 Demo 验证

| 任务 | 产出 | 验收 |
|------|------|------|
| 用 Dify 创建一个简单 Agent | Demo Agent 配置 | Agent 能正常调用 LLM |
| Agent 通过网关调用模型 | 调用链路：Agent → 网关 → 模型 | 网关日志包含 agent_id |
| 写入 Agent 成本数据 | Agent 成本页面有数据 | recordAgentUsage 被正确调用 |
| 接入 hoot MCP 测试工具 | 网关 + hoot 协作 | 能用 hoot 测试网关后的 MCP Server |

#### 调整 0.3：SDK 初步改造

| 任务 | 产出 |
|------|------|
| portkey-node-sdk → sdks/aihub-node/ | 改 baseURL 默认指向本地网关 |
| portkey-python-sdk → sdks/aihub-python/ | 改 baseURL 默认指向本地网关 |
| 两个 SDK 安装并验证端到端调用 | SDK 示例脚本能调用自己的网关 |

**M0 验收标准：**
```
✅ 网关启动，打印 OneLLM banner
✅ 33 个提供商可用，其中 6 个国产模型可正常调用
✅ Agent API 四个端点全部可用
✅ Dify Agent 通过网关调用模型，日志中能看到 agent_id
✅ 两个 SDK 可连接到自己的网关
✅ Docker Compose 一键启动开发环境
```

---

## M1 — 核心网关产品化（第 3-6 周）

### 目标
做出一个可以给客户展示的"LLM Gateway"产品——统一的 Web 管理控制台 + 完整的 API。

### 调整 1.1：管理后台 API 搭建

**新建 `admin-api/`，技术栈：Node.js + Express + TypeScript**

| 模块 | 路由 | 功能 |
|------|------|------|
| **用户系统** | `POST /api/v1/auth/register` | 用户注册 |
| | `POST /api/v1/auth/login` | 用户登录，返回 JWT |
| | `GET /api/v1/auth/me` | 获取当前用户信息 |
| **API Key 管理** | `POST /api/v1/keys` | 创建 API Key |
| | `GET /api/v1/keys` | 列出我的 API Keys |
| | `DELETE /api/v1/keys/:id` | 吊销 API Key |
| **Provider 配置** | `POST /api/v1/providers` | 配置上游 Provider 密钥 |
| | `GET /api/v1/providers` | 列出已配置的 Providers |
| | `PUT /api/v1/providers/:id` | 更新 Provider 配置 |
| **虚拟密钥** | `POST /api/v1/virtual-keys` | 创建虚拟密钥（映射到 Provider） |
| | `GET /api/v1/virtual-keys` | 列出虚拟密钥 |
| **网关日志** | `GET /api/v1/logs` | 查询调用日志（支持 agent_id 筛选） |
| | `GET /api/v1/logs/stats` | 日志统计（按模型/时间/Agent） |

**数据库：PostgreSQL**

```sql
-- 核心表设计
users (id, email, password_hash, name, created_at)
api_keys (id, user_id, key_hash, name, scopes, revoked, created_at)
providers (id, user_id, provider_name, api_key_encrypted, created_at)
virtual_keys (id, user_id, provider_id, name, scopes, created_at)
agents (id, user_id, name, description, model, api_key_hash, created_at)
request_logs (
  id, user_id, agent_id, task_id, step_number,
  model, provider, tokens_in, tokens_out, cost,
  latency_ms, status, tool_name, created_at
)
```

#### 调整 1.2：管理控制台前端搭建

**新建 `admin-console/`，技术栈：React + TypeScript + Ant Design**

| 页面 | 路由 | 内容 |
|------|------|------|
| 登录/注册 | `/login` `/register` | 用户认证 |
| 总览 Dashboard | `/` | 今日调用量/花费/活跃 Agent 概览卡片 |
| API Keys | `/keys` | 创建/查看/删除 API Key |
| Provider 配置 | `/providers` | 配置上游模型厂商的 API Key |
| 虚拟密钥 | `/virtual-keys` | 管理虚拟密钥映射 |
| 调用日志 | `/logs` | 查询/筛选调用记录 |
| 成本分析 | `/costs` | 按模型/时间维度的成本趋势图 |
| Agent 管理（灰态入口） | `/agents` | 显示"即将推出"，预埋页面结构 |

#### 调整 1.3：网关核心增强

| 改动 | 位置 | 说明 |
|------|------|------|
| 认证中间件 | `gateway-core/src/middlewares/auth.ts` 🆕 | 验证请求中的 API Key（查 admin-api） |
| 成本计算增强 | `gateway-core/src/handlers/handlerUtils.ts` | 基于 models 定价数据实时计算每次调用成本 |
| 日志持久化 | `gateway-core/src/middlewares/log/index.ts` | 将日志写入 PostgreSQL（通过 admin-api） |
| 国产模型增强 | `gateway-core/src/providers/` | 为 DeepSeek/Qwen/Zhipu 增加默认配置优化 |

#### 调整 1.4：部署与文档

| 任务 | 产出 |
|------|------|
| 完善 Docker Compose | 含 gateway + admin-api + admin-console + PG + Redis |
| 编写产品文档 | API 参考 / 快速开始 / 部署指南 |
| 录制 3 分钟产品 Demo 视频 | 展示核心功能 |

**M1 验收标准：**
```
✅ 用户可注册/登录管理控制台
✅ 创建 API Key → 通过网关调用模型 → 控制台看到调用日志和成本
✅ 支持配置多个 Provider → 创建虚拟密钥 → 按路由规则分发
✅ 成本分析页面显示按模型/时间的趋势图表
✅ Docker 一键部署完整产品
✅ 找 2-3 个种子用户试用并获得反馈
```

---

## M2 — 企业治理（第 7-10 周）

### 目标
让产品具备企业级治理能力——团队协作、权限控制、合规审计。

### 调整 2.1：多团队/工作区

| 改动 | 说明 |
|------|------|
| 数据库增加 `workspaces` 表 | 多租户隔离 |
| Admin API 增加 `/api/v1/workspaces` | 创建/管理 Workspace |
| 用户与 Workspace 关联 | 一个用户可属于多个 Workspace |
| 资源归属到 Workspace | API Key / Provider / Agent 属于某个 Workspace |

### 调整 2.2：RBAC 权限系统

| 角色 | 权限 |
|------|------|
| **Owner** | 管理 Workspace + 成员 + 所有资源 |
| **Admin** | 管理资源 + 查看所有数据 |
| **Member** | 创建 API Key + Agent，查看自己数据 |
| **Viewer** | 只读查看 Dashboard 和日志 |

| 改动 | 说明 |
|------|------|
| 数据库增加 `roles` / `permissions` 表 | RBAC 数据模型 |
| 网关认证中间件增加权限检查 | 验证 API Key 的 scope |
| 管理控制台增加成员管理页面 | 邀请/移除/角色分配 |

### 调整 2.3：SSO 单点登录

| 功能 | 实现方式 |
|------|---------|
| OIDC 集成 | 支持通用 OIDC Provider |
| 企业微信登录 | OAuth 2.0 集成 |
| 飞书登录 | OAuth 2.0 集成 |
| 钉钉登录 | OAuth 2.0 集成 |

### 调整 2.4：审计与合规

| 改动 | 说明 |
|------|------|
| 审计日志表 `audit_logs` | 记录所有管理操作（谁在什么时候做了什么） |
| 审计日志查询 API | 支持时间范围/操作人/操作类型筛选 |
| 审计日志页面 | 管理控制台中查看/导出审计报告 |
| 日志保留策略 | 可配置保留天数，默认 180 天 |

### 调整 2.5：预算告警

| 功能 | 说明 |
|------|------|
| Workspace 月度预算设置 | 管理员设置月预算上限 |
| 80% / 100% 阈值告警 | 邮件 + 站内通知 |
| 按 Agent 的预算拆分 | 每个 Agent 子预算上限 |

**M2 验收标准：**
```
✅ 多团队可在同一平台独立使用，数据隔离
✅ 不同角色有不同权限，权限边界清晰
✅ 至少支持一种国内 IM（企微/飞书/钉钉）SSO 登录
✅ 审计日志可追溯所有管理操作
✅ 预算超限时发送告警通知
```

---

## M3 — MCP 网关（第 11-14 周）

### 目标
让网关具备 MCP 协议支持——Agent 的工具调用从此有了统一的控制点。

### 调整 3.1：MCP Gateway 核心

**新建模块：`agent-control-plane/src/mcp-gateway/`**

| 功能 | 说明 |
|------|------|
| **MCP Server 注册** | `POST /api/v1/mcp-servers` 注册 MCP Server |
| **工具发现** | 拦截 `tools/list` 响应，缓存工具列表 |
| **工具过滤** | 集成 `mcp-tool-filter`，语义过滤工具列表 |
| **传输转换** | STDIO ↔ HTTP/SSE 协议转换 |
| **工具代理** | 代理 `tools/call` 请求到目标 MCP Server |
| **OAuth 2.1 支持** | MCP 标准认证流程 |

### 调整 3.2：工具权限管理

| 功能 | 说明 |
|------|------|
| **工具级 ACL** | 哪个 Agent 可以调用哪个工具的哪个操作 |
| **工具白名单/黑名单** | 全局或按 Agent 的工具允许列表 |
| **参数限制** | 限制工具调用的参数范围（如 `limit` max 100） |
| **读写分离** | 自动识别工具的读写属性 |

### 调整 3.3：MCP 管理界面

| 页面 | 内容 |
|------|------|
| **MCP Server 管理** | 注册/连接状态/工具列表浏览 |
| **工具浏览器**（基于 hoot 改造） | 可视化查看所有已注册工具，手动测试调用 |
| **权限矩阵页面** | Agent ↔ 工具的权限配置表格 |

**M3 验收标准：**
```
✅ MCP Server 可通过 API 注册到网关
✅ Agent 连接 MCP Gateway 后，只看到被授权调用的工具
✅ 1000+ 工具 → 语义过滤 → 只返回最相关的 20 个
✅ 工具浏览器可可视化浏览和测试工具
✅ Agent 尝试调用未授权工具 → 被网关拦截并记录
```

---

## M4 — Agent 控制平面（第 15-18 周）

### 目标
让企业真正"管住 Agent"——身份追溯、预算硬熔断、死循环检测、执行分级。

### 调整 4.1：Agent 身份与委托链

| 功能 | 实现 |
|------|------|
| **Agent 身份注册** | 每个 Agent 注册获得唯一 `agent_id` + 签名密钥 |
| **委托链 JWT** | `{sub, delegation_chain: [...], scope, exp}` |
| **链追溯验证** | Gateway 验证整条委托链的每一层 |
| **成本归属到原始用户** | 穿透 N 层 Agent 追溯到发起任务的用户 |

### 调整 4.2：Token 预算硬熔断

| 预算层级 | 超过上限的行为 |
|---------|--------------|
| **任务级** (> 50,000 token) | 立即终止当前任务 |
| **Agent 日级** (> 5,000,000 token) | 该 Agent 当日暂停服务 |
| **Workspace 月级** (> 预算额度) | 需 Admin 审批解锁 |

| 改动 | 说明 |
|------|------|
| 网关增加 `budgetCheck` 中间件 | 每次调用前检查预算余额 |
| 超限返回 `402 Payment Required` | 标准 HTTP 状态码 |
| Redis 实时计数 | 基于 Redis 的滑动窗口计数器 |
| 管理控制台预算配置页面 | 可视化配置各层级预算 |

### 调整 4.3：死循环检测

| 检测算法 | 实现 |
|------|------|
| 滑动窗口指纹匹配 | 最近 10 次调用中 ≥ 6 次相同 error fingerprint → 判定死循环 |
| 自动终止 | 判定后立即终止 + 返回 599 状态码 |
| 误杀豁免 | 参数不同或用户标记"非死循环"→ 加入白名单 |
| 告警 | 企微/钉钉/飞书/邮件通知 Agent Owner |

### 调整 4.4：执行分级管控

| Tier | 操作类型 | 策略 |
|------|---------|------|
| **1** | 只读查询 | 自动放行 |
| **2** | 可逆写操作 | 自动放行 + 审计记录 |
| **3** | 生产变更 | 需人工审批 |
| **4** | 不可逆/受监管 | 强制人工确认 + 双人复核 |

| 改动 | 说明 |
|------|------|
| 网关增加 `tieringCheck` 中间件 | 判定操作的 Tier 等级 |
| 审批工作流 | Tier 3/4 操作推送审批到企微/钉钉/飞书 |
| `tier_rules` 配置表 | 管理员可自定义工具对应的 Tier |

**M4 验收标准：**
```
✅ Agent 请求的委托链可追溯 N 层到原始用户
✅ 任务超 token 预算 → 立即终止（不是发邮件）
✅ Agent 陷入死循环 → 6 次相同错误后自动终止 + 告警
✅ 写操作需审批 → 推送审批通知 → 审批通过后才执行
✅ 所有拦截事件记录在审计日志中
```

---

## M5 — 可视化与 v1.0 发布（第 19-26 周）

### 目标
完善 Agent 可观测性、完成国产化适配、正式发布 v1.0。

### 调整 5.1：Agent 可观测性面板

| 可视化 | 说明 |
|------|------|
| **Agent 调用拓扑图** | 可视化 Agent → LLM → Tool 的调用链路 |
| **Token 消耗热力图** | 按时间/Agent/模型的 Token 消耗分布 |
| **成本归因报表** | 按 Agent → Task → Step 的成本下钻 |
| **异常检测告警** | 死循环/用量突增/非授权工具调用的实时告警 |
| **Agent 性能基准** | 延迟分布 / 成功率 / 错误类型分布 |

### 调整 5.2：国产化适配

| 适配项 | 说明 |
|------|------|
| **CAMIP 协议** | 支持国产 Agent 通信协议（与 MCP 双协议支持） |
| **国密加密 SM2/SM3/SM4** | API Key 存储加密 / 传输加密 |
| **信创环境** | 适配麒麟/统信 OS + 国产 CPU（鲲鹏/飞腾/海光） |
| **等保三级** | 安全配置文档 + 协助客户通过等保测评 |

### 调整 5.3：框架适配

| Agent 框架 | 适配方式 |
|------|------|
| **Dify** | 官方插件市场上的 OneLLM 插件 |
| **扣子（Coze）** | 插件 + 配置指南 |
| **LangChain** | Callback 集成 SDK |
| **CrewAI** | Callback 集成 SDK |
| **AutoGen** | 网关配置指南 |

### 调整 5.4：正式发布

| 发布项 | 说明 |
|------|------|
| **产品官网** | landing page + 文档站 |
| **定价方案** | 免费版 / Pro ¥999/月 / Enterprise ¥9,999/月 |
| **私有化部署包** | Docker 镜像 + K8s Helm Chart + 部署手册 |
| **客户成功** | 3 个标杆客户案例 + 上线支持流程 |
| **安全审计** | 第三方渗透测试 + 漏洞修复 |

**M5 验收标准：**
```
✅ Agent 可观测性面板完整可用（拓扑图/热力图/成本下钻/告警）
✅ 国产化适配完成（CAMIP + 国密 + 信创环境测试通过）
✅ 至少 3 个 Agent 框架有官方适配指南
✅ 产品官网 + 文档站上线
✅ 3 个付费客户在生产环境使用
✅ v1.0 正式版本发布
```

---

## 依赖关系

```
M0 ──→ M1 ──→ M2 ──→ M3 ──→ M4 ──→ M5
 │                        │               │
 └── 基础能力 ────────────┘               │
      (网关核心)                           │
                                          │
 M3 和 M4 可部分并行：                     │
   M3 (MCP Gateway) ──→ M4 依赖 M3 的工具注册能力
                     ──→ M4 的预算/分级也需要 M3 的 MCP 拦截点
```

---

## 团队配置建议

| 角色 | 人数 | M0 | M1 | M2 | M3 | M4 | M5 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 全栈/后端 Lead | 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 前端工程师 | 1 | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 后端工程师 | 1 | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| DevOps/测试 | 1 | — | — | ✅ | ✅ | ✅ | ✅ |
| 产品/设计 | 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 风险与应对

| 风险 | 概率 | 影响里程碑 | 应对 |
|------|:---:|:---:|------|
| gateway-main 大版本 breaking change | 中 | M1-M5 | Fork 后独立维护核心，选择性合并 |
| MCP 协议演进不兼容 | 中 | M3-M4 | 协议抽象层，支持多协议 |
| 大厂免费 Agent 网关 | 高 | M4-M5 | 不做通用版，深耕垂直行业 |
| 种子客户获取困难 | 中 | M1-M3 | M1 就开始内容营销 + 社区建设 |
| 信创适配周期超预期 | 中 | M5 | 提前在 M3 开始环境调研 |

---

## 版本规划

| 版本 | 里程碑 | 发布日期 | 核心卖点 |
|------|--------|---------|---------|
| **v0.1** | M0 | W2 | 内部验证版 |
| **v0.5** | M1 | W6 | 种子用户试用：统一 API + 管理控制台 |
| **v0.7** | M2 | W10 | 企业公测：多团队 + RBAC + SSO |
| **v0.8** | M3 | W14 | Agent 预览：MCP Gateway + 工具权限 |
| **v0.9** | M4 | W18 | Agent 内测：预算熔断 + 执行分级 |
| **v1.0** | M5 | W26 | 正式发布：完整 Agent 控制平面 |

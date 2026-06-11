# OneLLM — 系统测试方案

> 覆盖 M0+M1+M2 全部功能，包含 API 测试、集成测试、UI 测试

---

## 一、测试环境准备

### 1.1 启动所有服务

```bash
# 终端 1: 启动 admin-api
cd D:/DDongAI/onellm/admin-api
npx tsx src/index.ts
# → http://localhost:3100

# 终端 2: 启动 gateway
cd D:/DDongAI/onellm/gateway-core
npx tsx src/start-server.ts --port=9799
# → http://localhost:9799

# 终端 3: 启动 admin-console
cd D:/DDongAI/onellm/admin-console
npx vite --port 3101
# → http://localhost:3101
```

### 1.2 环境检查

```bash
# 确认 MySQL 可连接
mysql -u icp_user -p -h 123.249.47.125 -P 13306 portkey -e "SHOW TABLES;"

# 确认服务健康
curl http://localhost:3100/api/health          # → {"status":"ok"}
curl http://localhost:9799/                    # → "AI Gateway says hey!"
curl http://localhost:3101/                    # → HTML 页面
```

---

## 二、模块一：用户认证系统

### TC-1.1: 注册新用户

```bash
curl -s -X POST http://localhost:3100/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aihub.io","password":"Test123456","name":"测试用户"}'
```

**期望结果:**
- HTTP 201
- 返回 user 对象 (id, email, name)
- 返回 JWT token
- 返回 workspace_id
- MySQL users 表新增 1 行
- MySQL workspaces 表新增 1 行 (自动创建默认工作区)
- MySQL workspace_members 表新增 1 行 (owner 角色)

```bash
# 验证数据库
mysql -u icp_user -p -h 123.249.47.125 -P 13306 portkey \
  -e "SELECT id,email,name FROM users WHERE email='test@aihub.io';"
```

### TC-1.2: 重复注册

```bash
curl -s -X POST http://localhost:3100/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aihub.io","password":"Test123456","name":"重复用户"}'
```

**期望结果:** HTTP 409, message: "User already exists"

### TC-1.3: 登录

```bash
curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aihub.io","password":"Test123456"}'
```

**期望结果:**
- HTTP 200
- 返回 JWT token (含 workspace_id)
- 返回 user 对象

### TC-1.4: 错误密码登录

```bash
curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aihub.io","password":"WrongPassword"}'
```

**期望结果:** HTTP 401, message: "Invalid email or password"

### TC-1.5: Token 持久化验证

```bash
# 1. 注册 → 拿到 token
# 2. 重启 admin-api
# 3. 用 token 请求受保护接口 → 应返回 200 (非 401)
```

**期望结果:** 重启后 token 仍有效，数据不丢失

---

## 三、模块二：API Key 管理

### TC-2.1: 创建 API Key

```bash
# 先登录获取 TOKEN
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aihub.io","password":"Test123456"}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['token'])")

curl -s -X POST http://localhost:3100/api/v1/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"production-key"}'
```

**期望结果:**
- HTTP 201
- 返回完整 key (aihub_sk_ 前缀)
- 返回 key_preview (前15字符)
- 返回 warning 提示
- MySQL api_keys 表 key_hash 为 bcrypt 哈希值

### TC-2.2: 列出 API Keys

```bash
curl -s http://localhost:3100/api/v1/keys \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- HTTP 200
- 返回列表，每个 key 不含完整 key 值 (只含 key_prefix)

### TC-2.3: 吊销 API Key

```bash
KEY_ID=$(curl -s http://localhost:3100/api/v1/keys -H "Authorization: Bearer $TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X DELETE "http://localhost:3100/api/v1/keys/$KEY_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- HTTP 200
- MySQL api_keys 表 revoked = 1

### TC-2.4: 无认证访问

```bash
curl -s http://localhost:3100/api/v1/keys
```

**期望结果:** HTTP 401

---

## 四、模块三：Agent 管理

### TC-3.1: 创建 Agent

```bash
curl -s -X POST http://localhost:3100/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"客服Agent","description":"处理客户咨询与退款","default_model":"gpt-4o"}'
```

**期望结果:**
- HTTP 201
- 返回 agent_id + 专属 API Key (aihub_ag_ 前缀)
- 返回 warning
- MySQL agents 表 api_key_hash 为 bcrypt 哈希

### TC-3.2: 列出 Agent

```bash
curl -s http://localhost:3100/api/v1/agents \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- HTTP 200
- 返回 Agent 列表，包含 name, default_model, status, execution_tier
- 不含 api_key

### TC-3.3: Agent 详情

```bash
AGENT_ID=$(curl -s http://localhost:3100/api/v1/agents -H "Authorization: Bearer $TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")

curl -s "http://localhost:3100/api/v1/agents/$AGENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:** HTTP 200, 返回完整 Agent 信息

### TC-3.4: Agent 成本查询 (无数据)

```bash
curl -s "http://localhost:3100/api/v1/agents/$AGENT_ID/cost?period=all" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- HTTP 200
- total_tokens: 0, total_cost_yuan: "0.00"

### TC-3.5: 更新 Agent

```bash
curl -s -X PATCH "http://localhost:3100/api/v1/agents/$AGENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"客服Agent-更新版","execution_tier":3}'
```

**期望结果:** HTTP 200, MySQL agents 表数据已更新

---

## 五、模块四：网关认证

### TC-5.1: Provider Key 放行 (向后兼容)

```bash
curl -s -X POST http://localhost:9799/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-portkey-api-key: sk-test123" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

**期望结果:** HTTP 200 (或上游模型返回的错误，不是 401)

### TC-5.2: OneLLM Key 认证通过

```bash
# 创建 key，拿到完整 key
APIKEY=$(curl -s -X POST http://localhost:3100/api/v1/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"gateway-test"}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['key'])")

curl -s -X POST http://localhost:9799/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-aihub-api-key: $APIKEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

**期望结果:** HTTP 200 (或上游错误)，但不应返回 401

**验证:**
- gateway 日志中包含 aihub_auth: {authenticated: true, workspace_id, user_id}
- MySQL request_logs 表新增记录

### TC-5.3: 无效 Key 被拦截

```bash
curl -s -X POST http://localhost:9799/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-aihub-api-key: aihub_sk_fake_key_12345" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

**期望结果:** HTTP 401, message 包含 "Invalid OneLLM API key"

### TC-5.4: Agent Key 认证通过

```bash
AGENTKEY=$(curl -s -X POST http://localhost:3100/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"gateway-agent-test","default_model":"gpt-4o-mini"}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['data']['api_key'])")

curl -s -X POST http://localhost:9799/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-aihub-api-key: $AGENTKEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```

**期望结果:**
- HTTP 200 (或上游错误，非 401)
- 网关日志 auth 含 agent_id
- MySQL request_logs 含 agent_id

---

## 六、模块五：日志与成本追踪

### TC-6.1: 请求日志写入

```bash
# 通过网关发送请求后，检查日志
curl -s http://localhost:3100/api/v1/logs \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import json,sys;d=json.load(sys.stdin)['data'];print(f'Total: {d[\"total\"]}')"
```

**期望结果:** total > 0，日志含 model, provider, tokens_in/out, cost_cents, latency_ms 字段

### TC-6.2: 日志统计

```bash
curl -s "http://localhost:3100/api/v1/logs/stats?group_by=model" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- total_tokens > 0, total_cost_cents > 0, total_requests > 0
- breakdown 数组按 model 聚合

### TC-6.3: Agent 成本更新

```bash
# 用 Agent Key 通过网关发几个请求后
AGENT_ID=$(curl -s http://localhost:3100/api/v1/agents -H "Authorization: Bearer $TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")

curl -s "http://localhost:3100/api/v1/agents/$AGENT_ID/cost" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:** total_tokens > 0, total_cost_yuan > 0 (当有实际调用后)

### TC-6.4: 成本计算验证

手动验证：向 internal/log-request 提交已知数据，检查 cost_cents 计算是否正确。

```bash
curl -s -X POST http://localhost:3100/api/v1/internal/log-request \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"test_ws","model":"gpt-4o","provider":"openai","tokens_in":1000,"tokens_out":500,"cost_cents":5,"status":200}'
```

**期望结果:** HTTP 200，MySQL request_logs 新增记录

---

## 七、模块六：审计日志

### TC-7.1: 操作产生审计记录

```bash
# 执行以下操作后检查审计日志:
# 1. 创建一个 Agent
# 2. 创建一个 Key
# 3. 吊销一个 Key

curl -s http://localhost:3100/api/v1/audit \
  -H "Authorization: Bearer $TOKEN" \
  | python -c "import json,sys;d=json.load(sys.stdin)['data'];print(f'审计记录总数: {d[\"total\"]}')"
```

**期望结果:**
- 每创建一个资源产生一条审计记录
- 记录包含 action, resource_type, resource_id, user_id, ip_address

### TC-7.2: 审计记录不可删除/修改

```bash
curl -s -X DELETE http://localhost:3100/api/v1/audit/1 \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:** HTTP 404 (只读接口，无 DELETE 路由)

---

## 八、模块七：预算告警

### TC-8.1: 设置预算

```bash
WSID=$(curl -s http://localhost:3100/api/v1/workspaces -H "Authorization: Bearer $TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")

# 设置预算为 100 分 (1 元)
curl -s -X PUT "http://localhost:3100/api/v1/workspaces/$WSID/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthly_budget_cents":100}'
```

**期望结果:** HTTP 200, MySQL workspaces 表 budget 更新

### TC-8.2: 触发 80% 告警

```bash
# 1. 清空 request_logs 和 budget_alerts
# 2. 提交 cost_cents=85 的日志
curl -s -X POST http://localhost:3100/api/v1/internal/log-request \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WSID\",\"model\":\"gpt-4o\",\"provider\":\"openai\",\"tokens_in\":10000,\"tokens_out\":5000,\"cost_cents\":85,\"status\":200}"

# 3. 检查告警
curl -s "http://localhost:3100/api/v1/budget/alerts" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- budget_alerts 表有 workspace_monthly_80 记录
- budget/status 返回 percent≈85%

### TC-8.3: 触发 100% 告警

```bash
curl -s -X POST http://localhost:3100/api/v1/internal/log-request \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WSID\",\"model\":\"gpt-4o\",\"provider\":\"openai\",\"tokens_in\":1000,\"tokens_out\":500,\"cost_cents\":20,\"status\":200}"

curl -s "http://localhost:3100/api/v1/budget/alerts" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:**
- budget_alerts 表包含 workspace_monthly_80 和 workspace_monthly_100
- budget/status 返回 is_exceeded: true

### TC-8.4: 无限预算 (不触发告警)

```bash
# 设置 budget=0 (无限)
curl -s -X PUT "http://localhost:3100/api/v1/workspaces/$WSID/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthly_budget_cents":0}'
```

**期望结果:** 提交任意花费后，不产生新告警，budget/status 返回 percent: 0

---

## 九、模块八：成员管理

### TC-9.1: 列出成员

```bash
curl -s "http://localhost:3100/api/v1/workspaces/$WSID/members" \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:** 至少包含 owner 角色的当前用户

### TC-9.2: 邀请成员

```bash
# 先注册一个新用户
curl -s -X POST http://localhost:3100/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aihub.io","password":"Test123456","name":"团队成员"}' > /dev/null

# 邀请加入工作区
curl -s -X POST "http://localhost:3100/api/v1/workspaces/$WSID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aihub.io","role":"member"}'
```

**期望结果:**
- HTTP 201
- workspace_members 表新增记录
- audit_logs 产生 member.invited 记录

### TC-9.3: 重复邀请

```bash
curl -s -X POST "http://localhost:3100/api/v1/workspaces/$WSID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"member@aihub.io","role":"admin"}'
```

**期望结果:** HTTP 409, message: "User already in workspace"

---

## 十、模块九：Provider 凭证加密

### TC-10.1: 添加加密凭证

```bash
curl -s -X POST http://localhost:3100/api/v1/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_name":"openai","api_key":"sk-proj-secret-key-1234567890"}'
```

**期望结果:**
- HTTP 201
- 返回 api_key_preview: "sk-proj-...7890"
- MySQL provider_credentials 表 api_key_encrypted 为加密后密文 (非明文)

### TC-10.2: 列出凭证 (不含明文)

```bash
curl -s http://localhost:3100/api/v1/providers \
  -H "Authorization: Bearer $TOKEN"
```

**期望结果:** 返回列表不含 api_key 原始值

---

## 十一、端到端集成测试

### E2E-1: 完整链路

```
测试流程:
  1. 用户注册/登录 → 获得 JWT Token
  2. 创建 API Key → 获得 aihub_sk_xxx
  3. 设置月度预算 → ¥10
  4. 用 API Key 通过网关调用 LLM
  5. 验证:
     ✓ 网关返回响应 (或上游错误，非 401)
     ✓ MySQL request_logs 有记录 (含 cost_cents)
     ✓ Dashboard 统计更新
     ✓ 预算告警触发 (如果超过阈值)
     ✓ 审计日志记录 "key.created" 和请求日志
```

### E2E-2: 数据持久化

```
测试流程:
  1. 注册用户 A，创建 3 个 Agent，2 个 Key
  2. 重启 admin-api 和 gateway
  3. 登录 → 检查 Agents 和 Keys 列表 → 应全部存在
  4. 验证 MySQL 数据完整性
```

### E2E-3: 多租户隔离

```
测试流程:
  1. 用户 A 创建工作区 W1，创建 Agent A1
  2. 用户 B 注册，自动创建工作区 W2
  3. 用户 B 登录后:
     ✓ 看不到 Agent A1 (属于 W1)
     ✓ 看不到 W1 的 API Keys
     ✓ 看不到 W1 的调用日志
```

---

## 十二、UI 功能测试

| 页面 | 测试点 | 预期 |
|------|--------|------|
| **登录页** `/login` | 输入 demo2@aihub.io / demo123456 → 登录 | 跳转 Dashboard |
| | 输入错误密码 → 登录 | 显示错误提示 |
| | 切换到注册标签 → 注册新用户 | 注册成功自动登录 |
| **总览** `/` | 统计卡片显示数值 | 非全 0 |
| | Agent 列表 | 显示已创建的 Agent |
| | 模型排行表 | 显示调用过的模型 |
| **Agent 管理** `/agents` | 列表显示 | 显示所有 Agent |
| | 新建 Agent | 弹窗 → 填表 → 创建成功 |
| | 点击 Agent 名 → 详情 | 跳转详情页 |
| **API Keys** `/keys` | 创建 Key | 弹窗显示完整 Key（仅一次） |
| | 吊销 Key | 点击后列表刷新 |
| **成本分析** `/costs` | 表格显示 | 有数据时显示模型费用拆解 |
| **调用日志** `/logs` | 表格显示 | 显示请求记录 |
| **审计日志** `/audit` | 表格显示 | 显示操作记录 |
| **设置** `/settings` | 预算进度条 | 显示百分比 |
| | 团队成员列表 | 显示成员 |
| | 告警历史 | 显示触发的告警 |

---

## 十三、回归测试 Checklist

```
□ 注册 → 自动创建 Workspace
□ 登录 → 获得含 workspace_id 的 JWT
□ 创建 Agent → 返回专属 Key
□ 创建 API Key → 返回完整 Key (仅一次)
□ Agent Key 可通过网关认证
□ API Key 可通过网关认证
□ 错误 Key 被 401 拦截
□ Provider Key 直接放行
□ 请求日志写入 MySQL (含 cost_cents)
□ Dashboard 统计数据正确
□ 审计日志记录所有管理操作
□ 预算 80%/100% 阈值触发告警
□ 成员邀请/移除正常
□ Provider 凭证加密存储
□ 重启后数据不丢失
□ 多租户数据隔离
```

---

## 十四、执行命令

```bash
# 一键运行全量 API 测试
# 保存为 test.sh，在 bash 中执行

# === 配置 ===
API="http://localhost:3100"
GW="http://localhost:9799"
EMAIL="e2e_test_$(date +%s)@aihub.io"
PASS="Test123456"

echo "=== 1. Auth ==="
REG=$(curl -s -X POST $API/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"E2E Test\"}")
echo "Register: $(echo $REG | python -c 'import json,sys;print(json.load(sys.stdin)["status"])')"
TOKEN=$(echo $REG | python -c "import json,sys;print(json.load(sys.stdin)['data']['token'])")

LGN=$(curl -s -X POST $API/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "Login: $(echo $LGN | python -c 'import json,sys;print(json.load(sys.stdin)["status"])')"

echo "=== 2. Keys ==="
KEY=$(curl -s -X POST $API/api/v1/keys -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"e2e-key"}' | python -c "import json,sys;print(json.load(sys.stdin)['data']['key'])")
echo "Key created: ${KEY:0:15}..."

echo "=== 3. Agent ==="
AGENTKEY=$(curl -s -X POST $API/api/v1/agents -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"e2e-agent","default_model":"gpt-4o-mini"}' | python -c "import json,sys;print(json.load(sys.stdin)['data']['api_key'])")
echo "Agent created: ${AGENTKEY:0:15}..."

echo "=== 4. Gateway Auth ==="
GW1=$(curl -s -o /dev/null -w "%{http_code}" -X POST $GW/v1/chat/completions -H "Content-Type: application/json" -H "x-portkey-provider: openai" -H "x-portkey-api-key: sk-test" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}')
echo "Provider key: HTTP $GW1 (expect 200 or 4xx from upstream)"

GW2=$(curl -s -o /dev/null -w "%{http_code}" -X POST $GW/v1/chat/completions -H "Content-Type: application/json" -H "x-portkey-provider: openai" -H "x-aihub-api-key: $AGENTKEY" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}')
echo "Agent key: HTTP $GW2 (expect not-401)"

GW3=$(curl -s -o /dev/null -w "%{http_code}" -X POST $GW/v1/chat/completions -H "Content-Type: application/json" -H "x-portkey-provider: openai" -H "x-aihub-api-key: bad_key" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}')
echo "Bad key: HTTP $GW3 (expect 401)"

echo "=== 5. Logs & Cost ==="
LOG=$(curl -s "$API/api/v1/logs/stats?group_by=model" -H "Authorization: Bearer $TOKEN")
echo "Logs: $(echo $LOG | python -c 'import json,sys;d=json.load(sys.stdin)["data"];print(f"requests={d[\"total_requests\"]} tokens={d[\"total_tokens\"]}")')"

echo "=== 6. Budget ==="
WSID=$(curl -s $API/api/v1/workspaces -H "Authorization: Bearer $TOKEN" | python -c "import json,sys;print(json.load(sys.stdin)['data'][0]['id'])")
curl -s -X PUT "$API/api/v1/workspaces/$WSID/settings" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"monthly_budget_cents":100}' > /dev/null
BUD=$(curl -s "$API/api/v1/budget/status" -H "Authorization: Bearer $TOKEN")
echo "Budget status: $(echo $BUD | python -c 'import json,sys;d=json.load(sys.stdin)["data"];print(f"budgeted={d[\"budgeted\"]} pct={d[\"percent\"]}%")')"

echo "=== 7. Audit ==="
AUD=$(curl -s "$API/api/v1/audit" -H "Authorization: Bearer $TOKEN")
echo "Audit records: $(echo $AUD | python -c 'import json,sys;print(json.load(sys.stdin)["data"]["total"])')"

echo "=== 8. Members ==="
MEM=$(curl -s "$API/api/v1/workspaces/$WSID/members" -H "Authorization: Bearer $TOKEN")
echo "Members: $(echo $MEM | python -c 'import json,sys;print(len(json.load(sys.stdin)["data"]))')"

echo ""
echo "=========================="
echo "  E2E Test Complete"
echo "  User: $EMAIL"
echo "=========================="
```

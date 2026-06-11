# OneLLM Provider Smoke Test

验证所有已集成的外部 LLM Provider 在网关层面是否连通。

## 快速开始

```bash
# 1. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你有 Key 的厂商

# 2. 确保网关在运行
cd ../../gateway-core
npm run dev:node     # → http://localhost:8787

# 3. 运行冒烟测试
cd ../dev-tools/smoke-test
npx tsx provider-smoke.ts
```

## 输出示例

```
══════════════════════════════════════════════════════════
  OneLLM Provider Smoke Test  |  2026-06-10 15:30:00
  Gateway: http://localhost:8787  |  Mode: 直连 (网关→Provider)
══════════════════════════════════════════════════════════

Provider                 Status      HTTP    Latency   Model                      Detail
──────────────────────────────────────────────────────────────────────────────
✅ DeepSeek 深度求索       PASS        200     847ms     deepseek-chat              OK
✅ 阿里云 通义千问         PASS        200     1203ms    qwen-turbo                 OK
✅ 智谱AI GLM             PASS        200     560ms     glm-4-flash                好的
⚠️ 百度智能云 文心         AUTH        403     312ms     ernie-speed-128k           Invalid API key
❌ 科大讯飞 星火           UNREACH     ---     15002ms   spark-lite                 ENOTFOUND: spark-api-open.xf-yun.com
⏭️ 零一万物 Yi             SKIPPED     ---     ---       yi-lightning               No API key configured
──────────────────────────────────────────────────────────────────────────────
  ✅ 3 passed  ⚠️ 1 warning  ❌ 1 failed  ⏭️ 1 skipped
══════════════════════════════════════════════════════════
```

## 两种测试模式

### 直连模式（默认）
每个 Provider 用其真实 API Key 直接通过网关调用：
```bash
npx tsx provider-smoke.ts
# 需要在 .env 中配置各厂商的 ONELLM_<PROVIDER>_KEY
```

### 全链路模式
使用 OneLLM 平台创建的虚拟 Key，走完整的"虚拟 Key → 绑定 → Provider"链路：
```bash
ONELLM_GATEWAY_KEY=aihub_sk_xxx npx tsx provider-smoke.ts
# 虚拟 Key 需要在 admin-console 中提前配置好 Provider 绑定
```

## 常用命令

```bash
# 只测试单个 Provider
npx tsx provider-smoke.ts -p deepseek
npx tsx provider-smoke.ts -p 智谱

# 指定网关地址
npx tsx provider-smoke.ts -g http://localhost:9799

# JSON 输出（CI/CD 集成）
npx tsx provider-smoke.ts --json

# 仅显示失败的
npx tsx provider-smoke.ts -f

# CI 集成：JSON + 仅失败 + 非零退出码
npx tsx provider-smoke.ts --json -f
```

## 状态含义

| 状态 | 图标 | 含义 | 处理建议 |
|------|:---:|------|---------|
| **PASS** | ✅ | Provider 完全正常 | 无需操作 |
| **AUTH** | ⚠️ | Provider 可达但认证失败 | 检查 API Key 是否正确/过期 |
| **MODEL** | ⚠️ | Provider 可达但模型不存在 | 检查模型名是否已变更/下线 |
| **UNREACH** | ❌ | DNS/网络不通 | 检查 Provider API 域名是否变更 |
| **TIMEOUT** | ⏱️ | 请求超时 | 检查网络/Provider 官方状态 |
| **ERROR** | ❌ | 其他错误 | 查看 Detail 列的错误信息 |
| **SKIPPED** | ⏭️ | 未配置 API Key | 在 .env 中配置对应环境变量 |

## 覆盖的 Provider

| 分类 | Provider | 测试模型 | 免费额度 |
|------|----------|---------|:---:|
| 🇨🇳 P0 | DeepSeek 深度求索 | deepseek-chat | ❌ |
| 🇨🇳 P0 | 阿里云 通义千问 | qwen-turbo | ❌ |
| 🇨🇳 P0 | 智谱AI GLM | glm-4-flash | ✅ |
| 🇨🇳 P0 | 月之暗面 Kimi | moonshot-v1-8k | ❌ |
| 🇨🇳 P0 | MiniMax 稀宇 | abab6.5s | ❌ |
| 🇨🇳 P0 | 百度智能云 文心 | ernie-speed-128k | ✅ |
| 🇨🇳 P0 | 字节跳动 豆包 | doubao-lite-32k | ❌ |
| 🇨🇳 P1 | 科大讯飞 星火 | spark-lite | ❌ |
| 🇨🇳 P1 | 百川智能 | Baichuan4 | ❌ |
| 🇨🇳 P1 | 腾讯混元 | hunyuan-lite | ❌ |
| 🇨🇳 P1 | 零一万物 Yi | yi-lightning | ❌ |
| 🇨🇳 P1 | 硅基流动 | Qwen/Qwen2.5-7B-Instruct | ✅ |
| 🌍 | OpenAI | gpt-4o-mini | ❌ |
| 🌍 | Anthropic Claude | claude-3-5-haiku | ❌ |
| 🌍 | Google Gemini | gemini-2.0-flash | ✅ |
| 🌍 | Groq | llama-3.3-70b-versatile | ✅ |
| 🌍 | Mistral AI | mistral-small-latest | ❌ |
| 🌍 | Together AI | Llama-3.2-3B | ✅ |

## 原理说明

```
直连模式:
  Smoke Test → Gateway (:8787) → [x-aihub-provider: deepseek]
                                 [Authorization: Bearer sk-xxx]
                                 → https://api.deepseek.com/v1/chat/completions

全链路模式:
  Smoke Test → Gateway (:8787) → [Authorization: Bearer aihub_sk_xxx]
                                 → aihubAuth 中间件
                                 → admin-api /internal/validate-key
                                 → 返回 bindings (含解密后的 Provider API Key)
                                 → Gateway 用真实 Key 转发到上游
```

## 扩展到新 Provider

在 `provider-smoke.ts` 的 `PROVIDER_CONFIGS` 数组中添加一项：

```ts
{
  adapter: 'new-provider',           // gateway-core 中的 provider 名称
  displayName: 'New AI Lab',
  testModel: 'new-model-lite',       // 该 provider 最便宜的模型
  keyEnvVar: 'ONELLM_NEWPROVIDER_KEY', // 环境变量名
  category: 'chinese',
  notes: 'https://console.newai.com/api-keys',
}
```

同时在 `.env.example` 中添加对应的变量声明即可。

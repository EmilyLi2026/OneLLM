/**
 * OneLLM — Provider Connectivity Smoke Test
 *
 * 验证所有已集成的外部 LLM Provider 在网关层面是否连通。
 *
 * 测试方式:
 *   通过 OneLLM Gateway 向每个 Provider 发送一个最小 chat/completions 请求，
 *   根据响应判断 Provider 是否可达、鉴权是否有效。
 *
 * 用法:
 *   # 测试所有 Provider（需要先配置 .env 中的 API Key）
 *   npx tsx provider-smoke.ts
 *
 *   # 测试单个 Provider
 *   npx tsx provider-smoke.ts --provider deepseek
 *
 *   # 指定网关地址
 *   npx tsx provider-smoke.ts --gateway http://localhost:9799
 *
 *   # 输出 JSON 格式（便于 CI 集成）
 *   npx tsx provider-smoke.ts --json
 *
 *   # 仅显示失败项
 *   npx tsx provider-smoke.ts --failures-only
 *
 * 环境变量:
 *   每个 Provider 需要一个真实 API Key，命名规则: ONELLM_<PROVIDER>_KEY
 *   详见下方 PROVIDER_CONFIGS 或 .env.example
 *
 *   # 或者直接通过网关的虚拟 Key 机制测试（全链路）
 *   ONELLM_GATEWAY_KEY=aihub_sk_xxx   # OneLLM 虚拟 Key（已绑定多个 Provider）
 *   # 此时会走 "虚拟 Key → 绑定 → Provider" 完整链路
 */

import * as fs from 'fs';
import * as path from 'path';

// 内置 .env 加载（零依赖）
function loadEnv(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // 只设置尚未被 process.env 覆盖的变量
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env 不存在，静默跳过 — 依赖 process.env
  }
}

// 尝试从多个位置加载 .env
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'dev-tools/smoke-test/.env'),
];
for (const p of envPaths) {
  loadEnv(p);
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ProviderConfig {
  /** 网关适配器名称 (x-onellm-provider 的值) */
  adapter: string;
  /** 厂商显示名称 */
  displayName: string;
  /** 用于测试的模型 ID（选最便宜的） */
  testModel: string;
  /** 环境变量名（存储 API Key） */
  keyEnvVar: string;
  /** 厂商分类 */
  category: 'chinese' | 'international' | 'embedding' | 'cloud';
  /** 描述 */
  notes?: string;
}

interface TestResult {
  provider: string;
  displayName: string;
  adapter: string;
  model: string;
  status: 'PASS' | 'AUTH_ERR' | 'MODEL_ERR' | 'UNREACHABLE' | 'TIMEOUT' | 'ERROR';
  httpStatus: number | null;
  latencyMs: number;
  errorMessage?: string;
  responsePreview?: string;
}

interface SmokeOptions {
  gateway: string;
  provider?: string;       // 只测试指定 provider
  timeout: number;         // 单个请求超时 (ms)
  json: boolean;           // JSON 输出
  failuresOnly: boolean;   // 仅显示失败
  useVirtualKey: boolean;  // 使用 OneLLM 虚拟 Key 走全链路
}

// ═══════════════════════════════════════════════════════════════
// Provider Registry
// ═══════════════════════════════════════════════════════════════

const PROVIDER_CONFIGS: ProviderConfig[] = [
  // ── 国产厂商 P0 (核心) ──
  {
    adapter: 'deepseek',
    displayName: 'DeepSeek 深度求索',
    testModel: 'deepseek-chat',
    keyEnvVar: 'ONELLM_DEEPSEEK_KEY',
    category: 'chinese',
    notes: 'https://platform.deepseek.com/api_keys',
  },
  {
    adapter: 'dashscope',
    displayName: '阿里云 通义千问',
    testModel: 'qwen-turbo',
    keyEnvVar: 'ONELLM_DASHSCOPE_KEY',
    category: 'chinese',
    notes: 'https://dashscope.console.aliyun.com/apiKey',
  },
  {
    adapter: 'zhipu',
    displayName: '智谱AI GLM',
    testModel: 'glm-4-flash',
    keyEnvVar: 'ONELLM_ZHIPU_KEY',
    category: 'chinese',
    notes: 'https://open.bigmodel.cn/usercenter/apikeys (免费模型)',
  },
  {
    adapter: 'moonshot',
    displayName: '月之暗面 Kimi',
    testModel: 'moonshot-v1-8k',
    keyEnvVar: 'ONELLM_MOONSHOT_KEY',
    category: 'chinese',
    notes: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    adapter: 'minimax',
    displayName: 'MiniMax 稀宇',
    testModel: 'abab6.5s-chat',
    keyEnvVar: 'ONELLM_MINIMAX_KEY',
    category: 'chinese',
    notes: 'https://platform.minimaxi.com/user-center/basic-information/interface-key (需充值)',
  },
  {
    adapter: 'baidu',
    displayName: '百度智能云 文心',
    testModel: 'ernie-4.0-turbo-8k',
    keyEnvVar: 'ONELLM_BAIDU_KEY',
    category: 'chinese',
    notes: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
  },
  {
    adapter: 'bytedance',
    displayName: '字节跳动 豆包',
    testModel: 'doubao-1-5-lite-32k-250115',
    keyEnvVar: 'ONELLM_BYTEDANCE_KEY',
    category: 'chinese',
    notes: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey (需在控制台激活模型)',
  },

  // ── 国产厂商 P1 (扩展) ──
  {
    adapter: 'xunfei',
    displayName: '科大讯飞 星火',
    testModel: 'spark-lite',
    keyEnvVar: 'ONELLM_XUNFEI_KEY',
    category: 'chinese',
    notes: 'https://console.xfyun.cn/app/myapp',
  },
  {
    adapter: 'baichuan',
    displayName: '百川智能',
    testModel: 'Baichuan4',
    keyEnvVar: 'ONELLM_BAICHUAN_KEY',
    category: 'chinese',
    notes: 'https://platform.baichuan-ai.com/console/apikey',
  },
  {
    adapter: 'tencent',
    displayName: '腾讯混元',
    testModel: 'hunyuan-lite',
    keyEnvVar: 'ONELLM_TENCENT_KEY',
    category: 'chinese',
    notes: 'https://console.cloud.tencent.com/hunyuan/start',
  },
  {
    adapter: 'lingyi',
    displayName: '零一万物 Yi',
    testModel: 'yi-lightning',
    keyEnvVar: 'ONELLM_LINGYI_KEY',
    category: 'chinese',
    notes: 'https://platform.lingyiwanwu.com/apikeys',
  },
  {
    adapter: 'siliconflow',
    displayName: '硅基流动 SiliconFlow',
    testModel: 'Qwen/Qwen2.5-7B-Instruct',
    keyEnvVar: 'ONELLM_SILICONFLOW_KEY',
    category: 'chinese',
    notes: 'https://cloud.siliconflow.cn/account/ak (有免费额度)',
  },

  // ── 国际主流 (扩展测试) ──
  {
    adapter: 'openai',
    displayName: 'OpenAI',
    testModel: 'gpt-4o-mini',
    keyEnvVar: 'ONELLM_OPENAI_KEY',
    category: 'international',
    notes: 'https://platform.openai.com/api-keys',
  },
  {
    adapter: 'anthropic',
    displayName: 'Anthropic Claude',
    testModel: 'claude-3-5-haiku-20241022',
    keyEnvVar: 'ONELLM_ANTHROPIC_KEY',
    category: 'international',
    notes: 'https://console.anthropic.com/settings/keys',
  },
  {
    adapter: 'google',
    displayName: 'Google Gemini',
    testModel: 'gemini-2.0-flash',
    keyEnvVar: 'ONELLM_GOOGLE_KEY',
    category: 'international',
    notes: 'https://aistudio.google.com/app/apikey',
  },
  {
    adapter: 'groq',
    displayName: 'Groq',
    testModel: 'llama-3.3-70b-versatile',
    keyEnvVar: 'ONELLM_GROQ_KEY',
    category: 'international',
    notes: 'https://console.groq.com/keys',
  },
  {
    adapter: 'mistral-ai',
    displayName: 'Mistral AI',
    testModel: 'mistral-small-latest',
    keyEnvVar: 'ONELLM_MISTRAL_KEY',
    category: 'international',
    notes: 'https://console.mistral.ai/api-keys/',
  },
  {
    adapter: 'together-ai',
    displayName: 'Together AI',
    testModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    keyEnvVar: 'ONELLM_TOGETHER_KEY',
    category: 'international',
    notes: 'https://api.together.xyz/settings/api-keys',
  },
];

// ═══════════════════════════════════════════════════════════════
// CLI Argument Parsing
// ═══════════════════════════════════════════════════════════════

function parseArgs(): SmokeOptions {
  const args = process.argv.slice(2);
  const opts: SmokeOptions = {
    gateway: process.env.ONELLM_GATEWAY_URL || 'http://localhost:8787',
    timeout: parseInt(process.env.ONELLM_SMOKE_TIMEOUT || '30000'),
    json: false,
    failuresOnly: false,
    useVirtualKey: !!process.env.ONELLM_GATEWAY_KEY,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gateway':
      case '-g':
        opts.gateway = args[++i];
        break;
      case '--provider':
      case '-p':
        opts.provider = args[++i];
        break;
      case '--timeout':
      case '-t':
        opts.timeout = parseInt(args[++i]) * 1000;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--failures-only':
      case '-f':
        opts.failuresOnly = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
OneLLM — Provider Smoke Test 使用说明
──────────────────────────────────────
用法:
  npx tsx provider-smoke.ts [选项]

选项:
  -p, --provider <name>  只测试指定 Provider（支持 adapter 名或中文名模糊匹配）
  -g, --gateway <url>    指定网关地址（默认 http://localhost:8787）
  -t, --timeout <sec>    单个请求超时秒数（默认 30）
  --json                 输出 JSON 格式（适合 CI/CD）
  -f, --failures-only    仅显示失败的 Provider
  -h, --help             显示此帮助

环境变量:
  每个 Provider 需要一个 API Key，命名规则: ONELLM_<PROVIDER>_KEY
  完整列表见 .env.example 或脚本内 PROVIDER_CONFIGS

  可选:
  ONELLM_GATEWAY_URL      网关地址（默认 http://localhost:8787）
  ONELLM_GATEWAY_KEY      OneLLM 虚拟 Key（若设置则走全链路测试）
  ONELLM_SMOKE_TIMEOUT    超时毫秒数（默认 30000）

示例:
  # 先复制 .env.example 为 .env，填入你有 Key 的厂商
  # 测试所有已配置 Key 的 Provider
  npx tsx provider-smoke.ts

  # 只测 DeepSeek
  npx tsx provider-smoke.ts -p deepseek

  # 指定网关 + JSON 输出
  npx tsx provider-smoke.ts -g http://localhost:9799 --json

  # CI 集成：仅输出失败项 + 非零退出码
  npx tsx provider-smoke.ts --json --failures-only
`);
}

// ═══════════════════════════════════════════════════════════════
// Test Execution
// ═══════════════════════════════════════════════════════════════

function getApiKey(config: ProviderConfig): string | undefined {
  return process.env[config.keyEnvVar] || undefined;
}

function classifyResult(httpStatus: number | null, errorMessage?: string): TestResult['status'] {
  if (httpStatus === null) {
    if (errorMessage?.includes('timeout') || errorMessage?.includes('ETIMEDOUT')) {
      return 'TIMEOUT';
    }
    if (errorMessage?.includes('ENOTFOUND') || errorMessage?.includes('ECONNREFUSED')
        || errorMessage?.includes('EAI_AGAIN')) {
      return 'UNREACHABLE';
    }
    return 'ERROR';
  }

  if (httpStatus === 200 || httpStatus === 201) return 'PASS';
  if (httpStatus === 401 || httpStatus === 403) return 'AUTH_ERR';
  if (httpStatus === 404) return 'MODEL_ERR';
  if (httpStatus >= 400 && httpStatus < 500) return 'ERROR';
  if (httpStatus >= 500) return 'ERROR';
  return 'ERROR';
}

async function testProvider(
  config: ProviderConfig,
  apiKey: string,
  gateway: string,
  timeout: number,
  useVirtualKey: boolean
): Promise<TestResult> {
  const start = Date.now();
  let httpStatus: number | null = null;
  let errorMessage: string | undefined;
  let responsePreview: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useVirtualKey) {
      // 全链路模式：使用 OneLLM 虚拟 Key
      headers['Authorization'] = `Bearer ${apiKey}`;
      // 不设 x-onellm-provider，让网关根据虚拟 Key 的绑定自动路由
    } else {
      // 直连模式：直接指定 Provider
      headers['x-onellm-provider'] = config.adapter;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = JSON.stringify({
      model: config.testModel,
      messages: [{ role: 'user', content: 'Reply with just the word "OK".' }],
      max_tokens: 5,
      stream: false,
    });

    const res = await fetch(`${gateway}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    httpStatus = res.status;

    const text = await res.text();
    // 尝试截取响应预览
    try {
      const json = JSON.parse(text);
      if (json.choices?.[0]?.message?.content) {
        responsePreview = json.choices[0].message.content.substring(0, 80);
      } else if (json.error?.message) {
        errorMessage = json.error.message;
      } else if (json.message) {
        errorMessage = json.message;
      }
    } catch {
      responsePreview = text.substring(0, 100);
    }

  } catch (err: any) {
    if (err.name === 'AbortError') {
      errorMessage = 'Request timeout';
    } else if (err.cause) {
      errorMessage = `${err.message}: ${err.cause}`;
    } else {
      errorMessage = err.message;
    }
  }

  const latencyMs = Date.now() - start;

  return {
    provider: config.adapter,
    displayName: config.displayName,
    adapter: config.adapter,
    model: config.testModel,
    status: classifyResult(httpStatus, errorMessage),
    httpStatus,
    latencyMs,
    errorMessage,
    responsePreview,
  };
}

// ═══════════════════════════════════════════════════════════════
// Formatting
// ═══════════════════════════════════════════════════════════════

const STATUS_ICONS: Record<TestResult['status'], string> = {
  PASS: '✅',
  AUTH_ERR: '⚠️',
  MODEL_ERR: '⚠️',
  UNREACHABLE: '❌',
  TIMEOUT: '⏱️',
  ERROR: '❌',
};

const STATUS_LABELS: Record<TestResult['status'], string> = {
  PASS: 'PASS',
  AUTH_ERR: 'AUTH',
  MODEL_ERR: 'MODEL',
  UNREACHABLE: 'UNREACH',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
};

function colorText(text: string, color: number): string {
  return `\x1b[${color}m${text}\x1b[0m`;
}

function statusColor(status: TestResult['status']): number {
  switch (status) {
    case 'PASS': return 32;   // green
    case 'AUTH_ERR': return 33; // yellow
    case 'MODEL_ERR': return 33; // yellow
    case 'TIMEOUT': return 35;   // magenta
    case 'UNREACHABLE': return 31; // red
    case 'ERROR': return 31;    // red
  }
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printResultsTable(results: TestResult[], options: SmokeOptions) {
  const mode = options.useVirtualKey ? '全链路 (虚拟Key→网关→Provider)' : '直连 (网关→Provider)';
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  OneLLM Provider Smoke Test  |  ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
  console.log(`  Gateway: ${options.gateway}  |  Mode: ${mode}`);
  console.log(`${'═'.repeat(90)}`);

  // 表头
  const header = `${
    'Provider'.padEnd(24)
  }${
    'Status'.padEnd(12)
  }${
    'HTTP'.padEnd(7)
  }${
    'Latency'.padEnd(10)
  }${
    'Model'.padEnd(26)
  }Detail`;
  console.log(`\n${colorText(header, 1)}\n${'─'.repeat(90)}`);

  // 分类统计
  let passCount = 0, failCount = 0, warnCount = 0, skipCount = 0;

  // 按状态排序: PASS → AUTH_ERR/MODEL_ERR → TIMEOUT → UNREACHABLE → ERROR → SKIPPED
  const statusOrder: Record<string, number> = {
    'PASS': 0, 'AUTH_ERR': 1, 'MODEL_ERR': 2, 'TIMEOUT': 3, 'UNREACHABLE': 4, 'ERROR': 5, 'SKIPPED': 6,
  };

  const sorted = [...results].sort((a, b) => {
    const sa = a.errorMessage?.includes('No API key configured') ? 'SKIPPED' : a.status;
    const sb = b.errorMessage?.includes('No API key configured') ? 'SKIPPED' : b.status;
    return (statusOrder[sa] ?? 9) - (statusOrder[sb] ?? 9);
  });

  for (const r of sorted) {
    const isSkipped = r.errorMessage?.includes('No API key configured');
    const statusLabel = isSkipped ? 'SKIPPED' : STATUS_LABELS[r.status];
    const icon = isSkipped ? '⏭️' : STATUS_ICONS[r.status];
    const clr = isSkipped ? 36 : statusColor(r.status); // cyan for skipped

    // 统计
    if (isSkipped) skipCount++;
    else if (r.status === 'PASS') passCount++;
    else if (r.status === 'AUTH_ERR' || r.status === 'MODEL_ERR') warnCount++;
    else failCount++;

    // 跳过硬过滤
    if (options.failuresOnly && r.status === 'PASS') continue;
    if (options.failuresOnly && isSkipped) continue;

    const row = `${
      colorText(`${icon} ${r.displayName}`.padEnd(24), clr)
    }${
      colorText(statusLabel.padEnd(12), clr)
    }${
      r.httpStatus ? String(r.httpStatus).padEnd(7) : '---'.padEnd(7)
    }${
      formatLatency(r.latencyMs).padEnd(10)
    }${
      r.model.padEnd(26)
    }${
      r.errorMessage || r.responsePreview || ''
    }`;

    console.log(row);
  }

  console.log(`${'─'.repeat(90)}`);
  const summary = [
    passCount > 0 ? colorText(`✅ ${passCount} passed`, 32) : '',
    warnCount > 0 ? colorText(`⚠️ ${warnCount} warning`, 33) : '',
    failCount > 0 ? colorText(`❌ ${failCount} failed`, 31) : '',
    skipCount > 0 ? colorText(`⏭️ ${skipCount} skipped (no key)`, 36) : '',
  ].filter(Boolean).join('  ');
  console.log(`  ${summary}`);
  console.log(`${'═'.repeat(90)}\n`);
}

function printResultsJson(results: TestResult[], options: SmokeOptions) {
  const summary = {
    timestamp: new Date().toISOString(),
    gateway: options.gateway,
    mode: options.useVirtualKey ? 'virtual_key' : 'direct',
    total: results.length,
    passed: results.filter(r => r.status === 'PASS' && !r.errorMessage?.includes('No API key configured')).length,
    warnings: results.filter(r => (r.status === 'AUTH_ERR' || r.status === 'MODEL_ERR') && !r.errorMessage?.includes('No API key configured')).length,
    failed: results.filter(r => ['UNREACHABLE', 'TIMEOUT', 'ERROR'].includes(r.status) && !r.errorMessage?.includes('No API key configured')).length,
    skipped: results.filter(r => r.errorMessage?.includes('No API key configured')).length,
    results: results.map(r => ({
      provider: r.provider,
      display_name: r.displayName,
      model: r.model,
      status: r.errorMessage?.includes('No API key configured') ? 'SKIPPED' : r.status,
      http_status: r.httpStatus,
      latency_ms: r.latencyMs,
      error: r.errorMessage || null,
      response_preview: r.responsePreview || null,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  const options = parseArgs();

  // 过滤 Provider
  let configs = PROVIDER_CONFIGS;
  if (options.provider) {
    const query = options.provider.toLowerCase();
    configs = configs.filter(c =>
      c.adapter.toLowerCase().includes(query) ||
      c.displayName.toLowerCase().includes(query) ||
      c.keyEnvVar.toLowerCase().includes(query)
    );
    if (configs.length === 0) {
      console.error(`\n❌ No provider matching "${options.provider}" found.`);
      console.error('   Available providers:');
      for (const c of PROVIDER_CONFIGS) {
        console.error(`   - ${c.adapter.padEnd(16)} ${c.displayName}`);
      }
      process.exit(1);
    }
  }

  const virtualKey = process.env.ONELLM_GATEWAY_KEY;

  if (!options.json) {
    // 启动 Banner
    console.log(colorText(`
  █████╗ ██╗    ██╗  ██╗██╗   ██╗██████╗
 ██╔══██╗██║    ██║  ██║██║   ██║██╔══██╗
 ███████║██║    ███████║██║   ██║██████╔╝
 ██╔══██║██║    ██╔══██║██║   ██║██╔══██╗
 ██║  ██║██║    ██║  ██║╚██████╔╝██████╔╝
 ╚═╝  ╚═╝╚═╝    ╚═╝  ╚═╝ ╚═════╝ ╚═════╝
    Provider Connectivity Smoke Test
`, 36));

    if (!virtualKey && !options.useVirtualKey) {
      console.log(colorText('  ℹ Direct mode: testing each provider individually with real API keys.', 36));
      console.log(colorText('  ℹ Tip: Set ONELLM_GATEWAY_KEY=aihub_sk_... to test full virtual-key→binding→provider flow.\n', 36));
    }
  }

  // 决定测试模式
  const useVirtualKey = options.useVirtualKey && !!virtualKey;

  // 收集需要测试的 Provider + 对应的 API Key
  const testPlan: Array<{ config: ProviderConfig; apiKey: string }> = [];

  for (const config of configs) {
    const apiKey = useVirtualKey ? virtualKey! : getApiKey(config);
    if (apiKey) {
      testPlan.push({ config, apiKey });
    } else {
      // 无 API Key — 记录为 SKIPPED
      results.push({
        provider: config.adapter,
        displayName: config.displayName,
        adapter: config.adapter,
        model: config.testModel,
        status: 'ERROR' as TestResult['status'], // will be overridden by skip logic
        httpStatus: null,
        latencyMs: 0,
        errorMessage: `No API key configured. Set ${config.keyEnvVar} in .env${useVirtualKey ? ' or provide ONELLM_GATEWAY_KEY' : ''}`,
      });
    }
  }

  if (testPlan.length === 0) {
    console.error('\n❌ No API keys configured. Please set up .env file first:');
    console.error('   cp dev-tools/smoke-test/.env.example dev-tools/smoke-test/.env');
    console.error('   # Then edit .env and add your real API keys\n');
    process.exit(1);
  }

  if (!options.json) {
    console.log(`  Testing ${testPlan.length} provider(s), timeout=${options.timeout / 1000}s per request...\n`);
  }

  // 并发执行测试（用小并发避免触发限流）
  const CONCURRENCY = 3;
  for (let i = 0; i < testPlan.length; i += CONCURRENCY) {
    const batch = testPlan.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(({ config, apiKey }) =>
        testProvider(config, apiKey, options.gateway, options.timeout, useVirtualKey)
      )
    );
    results.push(...batchResults);

    // 实时输出进度（非 JSON 模式）
    if (!options.json) {
      for (const r of batchResults) {
        const isSkipped = r.errorMessage?.includes('No API key configured');
        const icon = isSkipped ? '⏭️' : STATUS_ICONS[r.status];
        console.log(`  ${icon} ${r.displayName.padEnd(20)} ${(STATUS_LABELS[r.status] || '').padEnd(10)} ${formatLatency(r.latencyMs)}`);
      }
    }
  }

  // 输出汇总
  if (options.json) {
    printResultsJson(results, options);
  } else {
    printResultsTable(results, options);
  }

  // 退出码：有任何 UNREACHABLE/TIMEOUT/ERROR → 非零
  const hasFailure = results.some(r =>
    !r.errorMessage?.includes('No API key configured') &&
    ['UNREACHABLE', 'TIMEOUT', 'ERROR'].includes(r.status)
  );
  if (hasFailure) process.exit(1);
}

// 全局结果收集
const results: TestResult[] = [];

main().catch(err => {
  console.error('Smoke test fatal error:', err);
  process.exit(2);
});

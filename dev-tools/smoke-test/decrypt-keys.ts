/**
 * 临时脚本：从数据库解密 Provider 密钥，生成 smoke-test/.env 文件
 * 用法: cd admin-api && npx tsx ../dev-tools/smoke-test/decrypt-keys.ts
 */
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const JWT_SECRET = process.env.JWT_SECRET || 'onellm-dev-secret-change-in-production';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(JWT_SECRET).digest();
}

function decrypt(encrypted: string): string {
  const key = getKey();
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const data = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

// Provider slug → env var name mapping
const ENV_MAP: Record<string, string> = {
  deepseek: 'ONELLM_DEEPSEEK_KEY',
  dashscope: 'ONELLM_DASHSCOPE_KEY',
  zhipu: 'ONELLM_ZHIPU_KEY',
  moonshot: 'ONELLM_MOONSHOT_KEY',
  minimax: 'ONELLM_MINIMAX_KEY',
  baidu: 'ONELLM_BAIDU_KEY',
  bytedance: 'ONELLM_BYTEDANCE_KEY',
  xunfei: 'ONELLM_XUNFEI_KEY',
  baichuan: 'ONELLM_BAICHUAN_KEY',
  tencent: 'ONELLM_TENCENT_KEY',
  lingyi: 'ONELLM_LINGYI_KEY',
  siliconflow: 'ONELLM_SILICONFLOW_KEY',
  openai: 'ONELLM_OPENAI_KEY',
  anthropic: 'ONELLM_ANTHROPIC_KEY',
  google: 'ONELLM_GOOGLE_KEY',
  groq: 'ONELLM_GROQ_KEY',
  'mistral-ai': 'ONELLM_MISTRAL_KEY',
  'together-ai': 'ONELLM_TOGETHER_KEY',
};

// Catalog slug → gateway adapter mapping
const SLUG_TO_ADAPTER: Record<string, string> = {
  alibaba: 'dashscope',
};

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'onellm',
  });

  const [rows] = await conn.query<any[]>(
    `SELECT pc.provider_name, pc.api_key_encrypted, mp.slug
     FROM provider_credentials pc
     LEFT JOIN model_providers mp ON pc.provider_name = mp.slug
        OR pc.provider_name = mp.name
        OR mp.slug IS NULL
     WHERE pc.workspace_id IS NOT NULL
     GROUP BY pc.provider_name, pc.api_key_encrypted, mp.slug`
  );

  const envLines: string[] = [];
  const found: string[] = [];

  for (const row of rows) {
    const providerName = (row.provider_name || '').toLowerCase();
    let slug = row.slug || providerName;
    if (SLUG_TO_ADAPTER[slug]) slug = SLUG_TO_ADAPTER[slug];

    const envVar = ENV_MAP[slug];
    if (!envVar) {
      console.log(`  ⏭️  No env mapping for: ${providerName} (slug: ${slug})`);
      continue;
    }

    try {
      const apiKey = decrypt(row.api_key_encrypted);
      const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
      envLines.push(`${envVar}=${apiKey}`);
      found.push(`  ✅ ${providerName.padEnd(16)} → ${envVar.padEnd(28)} (${masked})`);
    } catch (err: any) {
      console.log(`  ❌ Failed to decrypt ${providerName}: ${err.message}`);
    }
  }

  await conn.end();

  // Write .env
  const envPath = path.resolve(__dirname, '.env');
  // Keep existing comments by reading the example
  const examplePath = path.resolve(__dirname, '.env.example');
  let header = '';
  try {
    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    // Extract comment lines only (keep the structure)
    const commentLines = exampleContent.split('\n').filter(l => l.startsWith('#') || l.trim() === '');
    header = commentLines.join('\n') + '\n';
  } catch {}

  const content = header + '\n# ── Auto-generated keys from database ──\n' + envLines.join('\n') + '\n';
  fs.writeFileSync(envPath, content, 'utf8');

  console.log('\n📋 Decrypted provider keys from database:\n');
  console.log(found.join('\n'));
  console.log(`\n📝 Written to: ${envPath}`);
  console.log(`   Total: ${found.length} providers\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

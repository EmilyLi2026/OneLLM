/**
 * Database migration — reads schema.sql and executes against MySQL
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Connect without specifying database to create it first
  const dbName = process.env.DB_NAME || 'onellm';

  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true,
  });

  console.log('Connected to MySQL. Running schema...');
  await initConn.query(schema);

  // Migrate priority ENUM → priority_order INT
  try {
    // Add new column
    await initConn.query("ALTER TABLE key_provider_bindings ADD COLUMN priority_order INT DEFAULT 1 AFTER weight");
    // Migrate data
    await initConn.query("UPDATE key_provider_bindings SET priority_order = CASE WHEN priority = 'primary' THEN 1 WHEN priority = 'fallback' THEN 2 ELSE priority_order END");
    // Drop old column
    await initConn.query("ALTER TABLE key_provider_bindings DROP COLUMN priority");
    console.log('✅ Migrated priority → priority_order');
  } catch (err: any) {
    console.log('Migration note (priority_order):', err.message);
  }

  // Migrate existing provider_credential_id to key_provider_bindings
  try {
    const [rows] = await initConn.query<any[]>(
      'SELECT id, provider_credential_id FROM api_keys WHERE provider_credential_id IS NOT NULL'
    );
    for (const row of rows) {
      const bindingId = `kpb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      await initConn.query(
        `INSERT IGNORE INTO key_provider_bindings (id, api_key_id, provider_credential_id, priority, weight)
         VALUES (?, ?, ?, 1, 100)`,
        [bindingId, row.id, row.provider_credential_id]
      );
    }
    console.log(`✅ Migrated ${rows.length} existing provider bindings to key_provider_bindings`);
  } catch (err: any) {
    console.log('Migration note:', err.message);
  }

  // Add binding_id column to request_logs (for per-binding budget tracking & smart failover)
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN binding_id VARCHAR(36) NULL AFTER provider");
    await initConn.query("CREATE INDEX idx_rl_binding ON request_logs (binding_id)");
    console.log('✅ Added binding_id column to request_logs');
  } catch (err: any) {
    console.log('Migration note (binding_id):', err.message);
  }

  // Add api_key_id column to request_logs (permanent key attribution)
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN api_key_id VARCHAR(36) NULL AFTER binding_id");
    await initConn.query("CREATE INDEX idx_rl_api_key ON request_logs (api_key_id)");
    console.log('✅ Added api_key_id column to request_logs');
  } catch (err: any) {
    console.log('Migration note (api_key_id):', err.message);
  }

  // Migrate request_logs — rename task_id→action_label, step_number→conversation_turn, add new fields
  try {
    await initConn.query("ALTER TABLE request_logs RENAME COLUMN task_id TO action_label");
    console.log('✅ Renamed request_logs.task_id → action_label');
  } catch (err: any) {
    console.log('Migration note (task_id→action_label):', err.message);
  }
  try {
    await initConn.query("ALTER TABLE request_logs RENAME COLUMN step_number TO conversation_turn");
    console.log('✅ Renamed request_logs.step_number → conversation_turn');
  } catch (err: any) {
    console.log('Migration note (step_number→conversation_turn):', err.message);
  }
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN agent_role VARCHAR(500) DEFAULT NULL AFTER agent_id");
    console.log('✅ Added request_logs.agent_role');
  } catch (err: any) {
    console.log('Migration note (agent_role):', err.message);
  }
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN session_id VARCHAR(100) DEFAULT NULL AFTER agent_role");
    console.log('✅ Added request_logs.session_id');
  } catch (err: any) {
    console.log('Migration note (session_id):', err.message);
  }
  // Add request_input / request_output for full conversation logging
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN request_input MEDIUMTEXT DEFAULT NULL AFTER execution_tier");
    console.log('✅ Added request_logs.request_input');
  } catch (err: any) {
    console.log('Migration note (request_input):', err.message);
  }
  try {
    await initConn.query("ALTER TABLE request_logs ADD COLUMN request_output MEDIUMTEXT DEFAULT NULL AFTER request_input");
    console.log('✅ Added request_logs.request_output');
  } catch (err: any) {
    console.log('Migration note (request_output):', err.message);
  }

  // Drop old index on task_id, add new one on action_label
  try {
    await initConn.query("DROP INDEX idx_rl_task ON request_logs");
  } catch { /* index may not exist after column rename */ }
  try {
    await initConn.query("CREATE INDEX idx_rl_action ON request_logs (action_label(64))");
    console.log('✅ Created idx_rl_action index');
  } catch (err: any) {
    console.log('Migration note (idx_rl_action):', err.message);
  }
  try {
    await initConn.query("CREATE INDEX idx_rl_session ON request_logs (session_id)");
    console.log('✅ Created idx_rl_session index');
  } catch (err: any) {
    console.log('Migration note (idx_rl_session):', err.message);
  }

  // Add contact_inquiries table for sales/tech-support inquiry form
  try {
    await initConn.query(`
      CREATE TABLE IF NOT EXISTS contact_inquiries (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL COMMENT '联系人姓名',
          phone VARCHAR(30) NOT NULL COMMENT '联系方式-手机号',
          company VARCHAR(255) DEFAULT '' COMMENT '公司名称',
          team_size VARCHAR(50) DEFAULT '' COMMENT '团队规模',
          interests JSON DEFAULT NULL COMMENT '感兴趣的方向',
          message TEXT COMMENT '补充说明',
          status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/contacted/closed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('✅ Created contact_inquiries table');
  } catch (err: any) {
    console.log('Migration note (contact_inquiries):', err.message);
  }

  // Add phone column to users for phone-based login
  try {
    await initConn.query("ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email");
    await initConn.query("CREATE UNIQUE INDEX idx_users_phone ON users (phone)");
    console.log('✅ Added phone column to users');
  } catch (err: any) {
    if (err.message.includes('Duplicate column') || err.message.includes('Duplicate key')) {
      console.log('Migration note (users.phone): already exists, skipping');
    } else {
      console.log('Migration note (users.phone):', err.message);
    }
  }

  // Create verification_codes table
  try {
    await initConn.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
          id VARCHAR(36) PRIMARY KEY,
          phone VARCHAR(30) NOT NULL COMMENT '手机号',
          code VARCHAR(10) NOT NULL COMMENT '6位验证码',
          expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
          used TINYINT(1) DEFAULT 0 COMMENT '是否已使用',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_vc_phone (phone),
          INDEX idx_vc_expires (expires_at)
      ) ENGINE=InnoDB
    `);
    console.log('✅ Created verification_codes table');
  } catch (err: any) {
    console.log('Migration note (verification_codes):', err.message);
  }

  // Create invitations table for workspace invite codes
  try {
    await initConn.query(`
      CREATE TABLE IF NOT EXISTS invitations (
          id VARCHAR(36) PRIMARY KEY,
          workspace_id VARCHAR(36) NOT NULL,
          code VARCHAR(20) NOT NULL UNIQUE,
          role VARCHAR(20) NOT NULL DEFAULT 'member',
          created_by VARCHAR(36) NOT NULL,
          expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
          max_uses INT DEFAULT 1 COMMENT '最大使用次数',
          use_count INT DEFAULT 0 COMMENT '已使用次数',
          accepted_by VARCHAR(36) DEFAULT NULL,
          accepted_at TIMESTAMP NULL,
          status VARCHAR(20) DEFAULT 'active' COMMENT 'active/expired/revoked/accepted',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (accepted_by) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);
    console.log('✅ Created invitations table');
  } catch (err: any) {
    console.log('Migration note (invitations):', err.message);
  }

  // Add openrouter_model_id column for cross-format matching (seed data short IDs ↔ OpenRouter format)
  try {
    await initConn.query("ALTER TABLE model_specs ADD COLUMN openrouter_model_id VARCHAR(200) DEFAULT NULL COMMENT 'Corresponding OpenRouter model ID' AFTER model_id");
    console.log('✅ Added openrouter_model_id column');
  } catch (err: any) {
    if (err.message.includes('Duplicate column')) {
      console.log('Migration note (openrouter_model_id): already exists, skipping');
    } else {
      console.log('Migration note (openrouter_model_id):', err.message);
    }
  }
  try {
    await initConn.query("CREATE INDEX idx_ms_openrouter ON model_specs (openrouter_model_id)");
    console.log('✅ Created idx_ms_openrouter index');
  } catch (err: any) {
    console.log('Migration note (idx_ms_openrouter):', err.message);
  }

  // Backfill openrouter_model_id for seed data models (short IDs → OpenRouter format)
  const PROVIDER_PREFIX_MAP: Record<string, string> = {
    deepseek: 'deepseek/', alibaba: 'qwen/', zhipu: 'zhipu/',
    moonshot: 'moonshot/', minimax: 'minimax/', baidu: 'baidu/',
    bytedance: 'bytedance/', xunfei: 'spark/', lingyi: '01-ai/',
    baichuan: 'baichuan/', tencent: 'tencent/', stepfun: 'stepfun/',
  };
  for (const [slug, prefix] of Object.entries(PROVIDER_PREFIX_MAP)) {
    try {
      await initConn.query(
        `UPDATE model_specs ms
         JOIN model_providers mp ON ms.provider_id = mp.id
         SET ms.openrouter_model_id = CONCAT(?, ms.model_id)
         WHERE mp.slug = ? AND ms.workspace_id IS NULL AND ms.model_id NOT LIKE '%/%'`,
        [prefix, slug]
      );
    } catch (e: any) {
      console.log(`Migration note (backfill ${slug}):`, e.message);
    }
  }
  console.log('✅ Backfilled openrouter_model_id for seed data');

  // Clean up workspace-level duplicates (model_id matches a system-level record)
  try {
    const [dupResult] = await initConn.query<any>(
      `DELETE ms_ws FROM model_specs ms_ws
       INNER JOIN model_specs ms_sys ON ms_ws.model_id = ms_sys.model_id
         AND ms_sys.workspace_id IS NULL
       WHERE ms_ws.workspace_id IS NOT NULL`
    );
    console.log(`✅ Cleaned up ${dupResult.affectedRows} workspace duplicate models`);
  } catch (err: any) {
    console.log('Migration note (dup cleanup):', err.message);
  }

  console.log('✅ Schema migrated successfully.');
  await initConn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

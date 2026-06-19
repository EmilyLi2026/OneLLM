/**
 * Database migration — runs schema.sql for fresh installs,
 * then applies data-only migrations for upgrades.
 *
 * Usage: npx tsx src/db/migrate.ts
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const dbName = process.env.DB_NAME || 'onellm';

  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true,
  });

  // ── Step 1: Run schema.sql (idempotent — CREATE IF NOT EXISTS + INSERT IGNORE) ──
  console.log('Running schema.sql...');
  await initConn.query(schema);
  console.log('✅ Schema applied.');

  // ══════════════════════════════════════════════════
  // Step 2: Data migrations (for upgrades from older versions)
  // ══════════════════════════════════════════════════

  // 2.1 Migrate legacy priority ENUM → priority_order INT
  try {
    const [cols] = await initConn.query<any[]>(
      `SHOW COLUMNS FROM key_provider_bindings LIKE 'priority'`
    );
    if (cols.length > 0) {
      await initConn.query(
        "ALTER TABLE key_provider_bindings ADD COLUMN priority_order INT DEFAULT 1 AFTER weight"
      );
      await initConn.query(
        `UPDATE key_provider_bindings SET priority_order =
           CASE WHEN priority = 'primary' THEN 1 WHEN priority = 'fallback' THEN 2 ELSE 1 END`
      );
      await initConn.query("ALTER TABLE key_provider_bindings DROP COLUMN priority");
      console.log('✅ Migrated priority ENUM → priority_order INT');
    } else {
      console.log('⏭️  priority_order already migrated, skipping');
    }
  } catch (err: any) {
    console.log('Migration note (priority):', err.message);
  }

  // 2.2 Migrate legacy api_keys.provider_credential_id → key_provider_bindings
  try {
    const [cols] = await initConn.query<any[]>(
      `SHOW COLUMNS FROM api_keys LIKE 'provider_credential_id'`
    );
    if (cols.length > 0) {
      const [rows] = await initConn.query<any[]>(
        'SELECT id, provider_credential_id FROM api_keys WHERE provider_credential_id IS NOT NULL'
      );
      let count = 0;
      for (const row of rows) {
        const bindingId = `kpb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        await initConn.query(
          `INSERT IGNORE INTO key_provider_bindings (id, api_key_id, provider_credential_id, priority_order, weight)
           VALUES (?, ?, ?, 1, 100)`,
          [bindingId, row.id, row.provider_credential_id]
        );
        count++;
      }
      console.log(`✅ Migrated ${count} legacy provider bindings to key_provider_bindings`);
    }
  } catch (err: any) {
    console.log('Migration note (legacy bindings):', err.message);
  }

  // 2.3 Backfill openrouter_model_id for seed data models
  const PROVIDER_PREFIX_MAP: Record<string, string> = {
    deepseek: 'deepseek/', alibaba: 'qwen/', zhipu: 'zhipu/',
    moonshot: 'moonshot/', minimax: 'minimax/', baidu: 'baidu/',
    bytedance: 'bytedance/', xunfei: 'spark/', lingyi: '01-ai/',
    baichuan: 'baichuan/', tencent: 'tencent/', stepfun: 'stepfun/',
  };
  for (const [slug, prefix] of Object.entries(PROVIDER_PREFIX_MAP)) {
    try {
      const [result] = await initConn.query<any>(
        `UPDATE model_specs ms
         JOIN model_providers mp ON ms.provider_id = mp.id
         SET ms.openrouter_model_id = CONCAT(?, ms.model_id)
         WHERE mp.slug = ? AND ms.workspace_id IS NULL
           AND ms.model_id NOT LIKE '%/%'
           AND ms.openrouter_model_id IS NULL`,
        [prefix, slug]
      );
      if (result.affectedRows > 0) {
        console.log(`  Backfilled ${result.affectedRows} ${slug} models`);
      }
    } catch (e: any) {
      console.log(`Migration note (backfill ${slug}):`, e.message);
    }
  }
  console.log('✅ Backfilled openrouter_model_id for seed data');

  // 2.4 Clean up workspace-level model duplicates (same model_id as system-level)
  try {
    const [dupResult] = await initConn.query<any>(
      `DELETE ms_ws FROM model_specs ms_ws
       INNER JOIN model_specs ms_sys ON ms_ws.model_id = ms_sys.model_id
         AND ms_sys.workspace_id IS NULL
       WHERE ms_ws.workspace_id IS NOT NULL`
    );
    if (dupResult.affectedRows > 0) {
      console.log(`✅ Cleaned up ${dupResult.affectedRows} workspace duplicate models`);
    }
  } catch (err: any) {
    console.log('Migration note (dup cleanup):', err.message);
  }

  console.log('✅ Migration complete.');
  await initConn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

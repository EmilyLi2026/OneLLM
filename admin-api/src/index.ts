/**
 * OneLLM Admin API
 *
 * Express server providing user/auth/key/agent management APIs.
 * Serves as the backend for the Admin Console.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './db/pool';

import { authRouter } from './routes/auth';
import { keysRouter } from './routes/keys';
import { providersRouter } from './routes/providers';
import { agentsRouter } from './routes/agents';
import { modelsRouter } from './routes/models';
import { logsRouter } from './routes/logs';
import { workspacesRouter } from './routes/workspaces';
import { auditRouter } from './routes/audit';
import { budgetRouter } from './routes/budget';
import { internalRouter } from './routes/internal';
import { bindingsRouter } from './routes/bindings';
import { invitationsRouter } from './routes/invitations';
import { plansRouter } from './routes/plans';
import { complianceRouter } from './routes/compliance';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Public routes
app.use('/api/v1/auth', authRouter);

// Internal routes (service-to-service, no JWT)
app.use('/api/v1/internal', internalRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'admin-api', version: '0.1.0' });
});

// Public model routes (no auth needed — uses OpenRouter public data)
app.get('/api/v1/models/rankings', async (_req, res) => {
  try {
    const { getRankings } = await import('./services/discovery');
    const sort = (['context','price_low','output_tokens','newest'].includes(_req.query.sort as string)
      ? _req.query.sort : 'context') as 'context'|'price_low'|'output_tokens'|'newest';
    const provider = (_req.query.provider as string) || '';
    const capability = (_req.query.capability as string) || '';
    const chineseOnly = _req.query.chinese_only === 'true';
    const limit = Math.min(parseInt(_req.query.limit as string || '50') || 50, 100);
    const rankings = await getRankings(sort, chineseOnly, limit, provider, capability);
    res.json({ status: 'success', data: { source: 'openrouter', sort, count: rankings.length, rankings } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Public: ranking provider/capability filter options
app.get('/api/v1/models/rankings/filters', async (_req, res) => {
  try {
    const { getRankingProviders } = await import('./services/discovery');
    const providers = await getRankingProviders();
    const capabilities = [
      { key: 'vision', label: '视觉' },
      { key: 'function_calling', label: '函数调用' },
      { key: 'long_context', label: '长上下文' },
      { key: 'image_generation', label: '图像生成' },
    ];
    res.json({ status: 'success', data: { providers, capabilities } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Public: full OpenRouter model discovery (global, cached 1h)
app.get('/api/v1/models/discovery', async (_req, res) => {
  try {
    const { discoverModels } = await import('./services/discovery');
    const chineseOnly = _req.query.chinese_only === 'true';
    const limit = Math.min(parseInt(_req.query.limit as string || '200') || 50, 500);
    const models = await discoverModels({ chineseOnly, mode: 'all' });
    res.json({ status: 'success', data: models.slice(0, limit), total: models.length });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Public: discovery provider filter options
app.get('/api/v1/models/discovery/providers', async (_req, res) => {
  try {
    const { getRankingProviders } = await import('./services/discovery');
    const providers = await getRankingProviders();
    res.json({ status: 'success', data: providers });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Public model catalog listing (no auth needed — system models only)
app.get('/api/v1/models/public', async (req, res) => {
  try {
    const { default: pool } = await import('./db/pool');
    const search = (req.query.search as string) || '';
    const providerId = (req.query.provider_id as string) || '';
    const seriesId = (req.query.series_id as string) || '';
    const status = (req.query.status as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string || '50') || 50, 200);

    let sql = `
      SELECT ms.*, mp.name AS provider_name, mp.slug AS provider_slug, mp.name_cn AS provider_name_cn,
             mse.name AS series_name
      FROM model_specs ms
      JOIN model_providers mp ON ms.provider_id = mp.id
      LEFT JOIN model_series mse ON ms.series_id = mse.id
      WHERE ms.is_system = 1
    `;
    const params: any[] = [];

    if (search) {
      sql += ' AND (ms.name LIKE ? OR ms.model_id LIKE ? OR mp.name LIKE ? OR mp.name_cn LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (providerId) { sql += ' AND ms.provider_id = ?'; params.push(providerId); }
    if (seriesId) { sql += ' AND ms.series_id = ?'; params.push(seriesId); }
    if (status) { sql += ' AND ms.status = ?'; params.push(status); }

    sql += ' ORDER BY mp.priority DESC, ms.pricing_input_cents ASC';
    sql += ' LIMIT ?'; params.push(limit);

    const [rows] = await pool.query(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Public pricing plans (no auth needed)
app.use('/api/v1/public/plans', plansRouter);

// Note: /api/v1/models/providers and /api/v1/models/series are handled
// by modelsRouter (with auth + model_count). The public versions were removed
// to avoid route conflicts — the protected ones provide the same data.

// Public: sync status (OpenRouter → model_specs)
app.get('/api/v1/models/sync/status', async (_req, res) => {
  const { getSyncStatus } = await import('./services/sync');
  res.json({ status: 'success', data: getSyncStatus() });
});

// Public: contact/sales inquiry form (no auth needed)
app.post('/api/v1/contact/inquiries', async (req, res) => {
  try {
    const { name, phone, company, teamSize, interests, message } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: '请填写姓名' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ status: 'error', message: '请填写联系方式' });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ status: 'error', message: '请输入有效的手机号' });
    }

    const { genId } = await import('./db/pool');
    const id = genId('inq');

    await pool.query(
      `INSERT INTO contact_inquiries (id, name, phone, company, team_size, interests, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, name.trim(), phone.trim(), (company || '').trim(), teamSize || '',
       Array.isArray(interests) ? JSON.stringify(interests) : '[]', (message || '').trim()]
    );

    return res.status(201).json({
      status: 'success',
      data: { id, name: name.trim(), message: '感谢你的咨询！我们的团队将在 24 小时内与你联系。', created_at: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error('Contact inquiry error:', error);
    return res.status(500).json({ status: 'error', message: '提交失败，请稍后重试' });
  }
});

// Protected routes (require JWT)
app.use('/api/v1/keys', authMiddleware, keysRouter);
app.use('/api/v1/keys/:keyId/bindings', authMiddleware, bindingsRouter);
app.use('/api/v1/providers', authMiddleware, providersRouter);
app.use('/api/v1/agents', authMiddleware, agentsRouter);
app.use('/api/v1/models', authMiddleware, modelsRouter);
app.use('/api/v1/logs', authMiddleware, logsRouter);
app.use('/api/v1/workspaces', authMiddleware, workspacesRouter);
app.use('/api/v1/workspaces/:id/invitations', authMiddleware, invitationsRouter);
app.use('/api/v1/audit', authMiddleware, auditRouter);
app.use('/api/v1/budget', authMiddleware, budgetRouter);

// Compliance (admin+ only)
app.use('/api/v1/compliance', authMiddleware, complianceRouter);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🔧 OneLLM Admin API running on http://localhost:${PORT}`);

  // ── Scheduled sync: OpenRouter → model_specs ──
  const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const INITIAL_DELAY_MS = 30 * 1000;       // 30s after startup

  setTimeout(async () => {
    console.log('[sync] Initial sync triggered');
    const { runSync } = await import('./services/sync');
    await runSync();
  }, INITIAL_DELAY_MS);

  setInterval(async () => {
    console.log('[sync] Scheduled sync triggered');
    const { runSync } = await import('./services/sync');
    await runSync();
  }, SYNC_INTERVAL_MS);
});

export default app;

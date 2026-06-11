/**
 * Compliance Routes
 *
 * GET /api/v1/compliance/report?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Generates a compliance report for the current workspace.
 * Requires admin+ role. Report is generated synchronously.
 */

import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { generateReport } from '../services/compliance';

export const complianceRouter = Router();

// All compliance routes require admin+
complianceRouter.use(requireAdmin);

/** GET /api/v1/compliance/report */
complianceRouter.get('/report', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    let { from, to } = req.query as Record<string, string | undefined>;

    // Default: current month
    const now = new Date();
    if (!to) {
      to = now.toISOString().slice(0, 10);
    }
    if (!from) {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    // Max 90 days range
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return res.status(400).json({
        status: 'error',
        message: '报告周期最长 90 天，请缩小日期范围',
      });
    }
    if (fromDate > toDate) {
      return res.status(400).json({
        status: 'error',
        message: '起始日期不能晚于结束日期',
      });
    }

    const report = await generateReport(workspaceId, from, to);

    return res.json({
      status: 'success',
      data: report,
    });
  } catch (error: any) {
    console.error('Compliance report error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/compliance/status — quick preview for dashboard badge */
complianceRouter.get('/status', async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().slice(0, 10);

    const report = await generateReport(workspaceId, from, to);

    return res.json({
      status: 'success',
      data: {
        rating: report.meta.rating,
        total_requests: report.meta.summary.total_requests,
        budget_violations: report.meta.summary.budget_violations,
        cross_border: !!report.data_flow.cross_border,
        high_priority_recs: report.recommendations.filter(r => r.priority === 'high').length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Audit Service — records all management actions
 */

import pool from '../db/pool';

interface AuditEntry {
  workspace_id?: string;
  user_id?: string;
  action: string;       // "agent.created", "key.revoked", "user.invited"
  resource_type: string; // "agent", "api_key", "user", "workspace"
  resource_id: string;
  details?: Record<string, any>;
  ip_address?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.workspace_id || null,
        entry.user_id || null,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        JSON.stringify(entry.details || {}),
        entry.ip_address || null,
      ]
    );
  } catch (error) {
    console.error('Audit record failed:', error);
    // Never block the main operation due to audit failure
  }
}

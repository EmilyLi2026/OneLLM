/**
 * RBAC Middleware
 *
 * Role hierarchy: owner > admin > member > viewer
 * Each role has specific permissions on resources.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_LEVEL: Record<Role, number> = {
  owner: 4, admin: 3, member: 2, viewer: 1,
};

/**
 * Require a minimum role level to access the route.
 */
export function requireRole(minRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req.userRole || 'viewer') as Role;
    if (ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole]) {
      return next();
    }
    return res.status(403).json({ status: 'error', message: `Requires ${minRole} role or higher` });
  };
}

/**
 * Quick permission helpers for common operations.
 */

// Read-only operations: viewer+
export const requireRead = requireRole('viewer');

// Write operations: member+
export const requireWrite = requireRole('member');

// Admin operations: admin+
export const requireAdmin = requireRole('admin');

// Owner-only operations
export const requireOwner = requireRole('owner');

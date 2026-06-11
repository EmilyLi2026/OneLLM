/**
 * JWT Authentication Middleware
 *
 * Validates Bearer token from Authorization header.
 * Extracts user_id and workspace_id into req context.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'onellm-dev-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  workspaceId?: string;
  userRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      workspace_id?: string;
      role?: string;
    };

    req.userId = payload.sub;
    req.workspaceId = payload.workspace_id;
    req.userRole = payload.role;

    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

/**
 * Generate JWT token for a user
 */
export function generateToken(userId: string, workspaceId?: string, role?: string): string {
  return jwt.sign(
    {
      sub: userId,
      workspace_id: workspaceId,
      role: role || 'member',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

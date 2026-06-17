/**
 * Auth Routes — Phone + SMS verification code / Password dual-mode login
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool, { genId } from '../db/pool';
import { generateToken } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';
import { sendVerificationCode, generateCode } from '../services/sms';
import { checkSendCodeLimit, checkLoginLockout, recordLoginFailure, resetLoginFailures } from '../services/rate-limiter';

export const authRouter = Router();

interface UserRow extends RowDataPacket {
  id: string; email: string; phone: string;
  password_hash: string; name: string;
}

/** GET /api/v1/auth/invitation-info?code=XXX — Public: check invitation validity & show workspace info */
authRouter.get('/invitation-info', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ status: 'error', message: '缺少邀请码' });

    const [rows] = await pool.query<any[]>(
      `SELECT i.code, i.role, i.expires_at, i.status,
              w.name as workspace_name, u.name as creator_name
       FROM invitations i
       JOIN workspaces w ON i.workspace_id = w.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.code = ? AND i.status = 'active' AND i.expires_at > NOW()`,
      [code]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: '邀请链接无效或已过期' });
    }
    const inv = rows[0];
    return res.json({
      status: 'success',
      data: {
        code: inv.code,
        workspace_name: inv.workspace_name,
        creator_name: inv.creator_name,
        role: inv.role,
        expires_at: inv.expires_at,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/auth/send-code — send SMS verification code */
authRouter.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ status: 'error', message: '请填写手机号' });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ status: 'error', message: '请输入有效的手机号' });
    }

    // Rate limit by IP (anti-abuse)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                  || req.socket.remoteAddress
                  || 'unknown';
    const ipCheck = checkSendCodeLimit(clientIp);
    if (!ipCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        message: `请求过于频繁，请${ipCheck.retryAfterSec ? ` ${Math.ceil(ipCheck.retryAfterSec / 60)} 分钟` : ''}后再试`,
      });
    }

    // Rate limit: 60s cooldown
    const [recent] = await pool.query<any[]>(
      'SELECT id FROM verification_codes WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)',
      [phoneDigits]
    );
    if (recent.length > 0) {
      return res.status(429).json({ status: 'error', message: '请60秒后再获取验证码' });
    }

    // Daily limit: max 10 codes per phone
    const [todayCount] = await pool.query<any[]>(
      'SELECT COUNT(*) as cnt FROM verification_codes WHERE phone = ? AND created_at > CURDATE()',
      [phoneDigits]
    );
    if (todayCount[0]?.cnt >= 10) {
      return res.status(429).json({ status: 'error', message: '今日获取次数已达上限' });
    }

    const code = generateCode();
    const id = genId('vc');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      'INSERT INTO verification_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)',
      [id, phoneDigits, code, expiresAt]
    );

    const result = await sendVerificationCode(phoneDigits, code);
    if (!result.ok) {
      return res.status(500).json({ status: 'error', message: result.error || '短信发送失败' });
    }

    const resData: any = { phone: phoneDigits, message: '验证码已发送' };
    // Dev mode: return code in response so it can be shown in browser
    if (process.env.SMS_DEV_MODE === 'true') {
      resData.dev_code = code;
    }
    return res.json({ status: 'success', data: resData });
  } catch (error: any) {
    console.error('Send code error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/auth/login — phone + verification code OR phone + password */
authRouter.post('/login', async (req, res) => {
  try {
    const { phone, code, password } = req.body;

    // ── Mode: phone + password ──
    if (password && !code) {
      if (!phone) {
        return res.status(400).json({ status: 'error', message: '请填写手机号' });
      }
      const phoneDigits = phone.replace(/\D/g, '');

      // Check brute-force lockout
      const lockoutCheck = checkLoginLockout(phoneDigits);
      if (!lockoutCheck.allowed) {
        return res.status(429).json({
          status: 'error',
          message: `密码错误次数过多，请${Math.ceil((lockoutCheck.retryAfterSec || 60) / 60)} 分钟后再试或使用验证码登录`,
        });
      }

      // Find user
      const [users] = await pool.query<UserRow[]>(
        'SELECT id, email, phone, password_hash, name FROM users WHERE phone = ?',
        [phoneDigits]
      );
      if (users.length === 0) {
        return res.status(401).json({ status: 'error', message: '该手机号未注册，请先用验证码登录' });
      }
      const user = users[0];

      // Validate password
      if (!user.password_hash) {
        return res.status(401).json({ status: 'error', message: '尚未设置密码，请先用验证码登录后设置密码' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        recordLoginFailure(phoneDigits);
        return res.status(401).json({ status: 'error', message: '密码错误，请重试' });
      }

      resetLoginFailures(phoneDigits);

      // Get workspace
      const [wss] = await pool.query<any[]>(
        `SELECT w.id, w.name as ws_name, wm.role FROM workspaces w
         JOIN workspace_members wm ON w.id = wm.workspace_id
         WHERE wm.user_id = ? ORDER BY w.created_at ASC LIMIT 1`,
        [user.id]
      );
      const workspaceId = wss.length > 0 ? wss[0].id : undefined;
      const role = wss.length > 0 ? wss[0].role : 'member';
      const workspaceName = wss.length > 0 ? wss[0].ws_name : undefined;

      const token = generateToken(user.id, workspaceId, role);

      return res.json({
        status: 'success',
        data: {
          user: { id: user.id, email: user.email || '', phone: user.phone || phoneDigits, name: user.name },
          workspace: workspaceId ? { id: workspaceId, name: workspaceName, role } : null,
          has_password: !!user.password_hash,
          token,
        },
      });
    }

    // ── Mode: phone + verification code (existing logic) ──
    if (!phone || !code) {
      return res.status(400).json({ status: 'error', message: '请填写手机号和验证码' });
    }
    const phoneDigits = phone.replace(/\D/g, '');

    // Check if phone is locked out (brute-force protection)
    const lockoutCheck = checkLoginLockout(phoneDigits);
    if (!lockoutCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        message: `验证码尝试次数过多，请${Math.ceil((lockoutCheck.retryAfterSec || 60) / 60)} 分钟后再试`,
      });
    }

    // Validate code
    const [codes] = await pool.query<any[]>(
      `SELECT id, code, expires_at FROM verification_codes
       WHERE phone = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phoneDigits]
    );
    if (codes.length === 0) {
      recordLoginFailure(phoneDigits);
      return res.status(401).json({ status: 'error', message: '验证码无效或已过期，请重新获取' });
    }
    if (codes[0].code !== String(code).trim()) {
      recordLoginFailure(phoneDigits);
      return res.status(401).json({ status: 'error', message: '验证码错误' });
    }

    // Mark code as used
    await pool.query('UPDATE verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

    // Reset brute-force counter on successful code verification
    resetLoginFailures(phoneDigits);

    // Find existing user by phone
    const [existing] = await pool.query<UserRow[]>(
      'SELECT id, email, phone, name, password_hash FROM users WHERE phone = ?',
      [phoneDigits]
    );

    let userId: string;
    let userName: string;
    let userEmail: string;
    let hasPassword = false;

    if (existing.length > 0) {
      userId = existing[0].id;
      userName = existing[0].name;
      userEmail = existing[0].email || '';
      hasPassword = !!existing[0].password_hash;
    } else {
      // Auto-register
      userId = genId('user');
      userName = `用户${phoneDigits.slice(-4)}`;
      userEmail = '';

      await pool.query(
        'INSERT INTO users (id, email, password_hash, name, phone) VALUES (?, NULL, ?, ?, ?)',
        [userId, '', userName, phoneDigits]
      );

      // Auto-create default workspace
      const wsId = genId('ws');
      await pool.query(
        'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
        [wsId, 'My Workspace', `ws-${userId}`, userId]
      );
      await pool.query(
        'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
        [genId('member'), wsId, userId, 'owner']
      );
    }

    // Get workspace
    const [wss] = await pool.query<any[]>(
      `SELECT w.id, w.name as ws_name, wm.role FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = ? ORDER BY w.created_at ASC LIMIT 1`,
      [userId]
    );
    const workspaceId = wss.length > 0 ? wss[0].id : undefined;
    const role = wss.length > 0 ? wss[0].role : 'member';
    const workspaceName = wss.length > 0 ? wss[0].ws_name : undefined;

    const token = generateToken(userId, workspaceId, role);

    return res.json({
      status: 'success',
      data: {
        user: { id: userId, email: userEmail, phone: phoneDigits, name: userName },
        workspace: workspaceId ? { id: workspaceId, name: workspaceName, role } : null,
        has_password: hasPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/auth/set-password — Set password after SMS login (requires valid JWT) */
authRouter.post('/set-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }

    const jwt = await import('jsonwebtoken');
    let payload: { sub: string };
    try {
      payload = jwt.default.verify(
        authHeader.split(' ')[1],
        process.env.JWT_SECRET || 'onellm-dev-secret-change-in-production'
      ) as { sub: string };
    } catch {
      return res.status(401).json({ status: 'error', message: 'Token invalid or expired' });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ status: 'error', message: '密码至少需要6位' });
    }

    // Check user exists and doesn't already have a password
    const [users] = await pool.query<UserRow[]>(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [payload.sub]
    );
    if (users.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    if (users[0].password_hash) {
      return res.status(400).json({ status: 'error', message: '密码已设置，如需修改请前往设置页面' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, payload.sub]);

    return res.json({ status: 'success', data: { message: '密码设置成功' } });
  } catch (error: any) {
    console.error('Set password error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/auth/accept-invitation — Accept workspace invitation via SMS code */
authRouter.post('/accept-invitation', async (req, res) => {
  try {
    const { code, phone, sms_code } = req.body;
    if (!code || !phone || !sms_code) {
      return res.status(400).json({ status: 'error', message: '请填写邀请码、手机号和验证码' });
    }
    const phoneDigits = phone.replace(/\D/g, '');

    // Check lockout (brute-force protection)
    const lockoutCheck = checkLoginLockout(phoneDigits);
    if (!lockoutCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        message: `验证码尝试次数过多，请${Math.ceil((lockoutCheck.retryAfterSec || 60) / 60)} 分钟后再试`,
      });
    }

    // 1. Validate invitation code
    const [invites] = await pool.query<any[]>(
      `SELECT i.*, w.name as workspace_name
       FROM invitations i
       JOIN workspaces w ON i.workspace_id = w.id
       WHERE i.code = ? AND i.status = 'active' AND i.expires_at > NOW()`,
      [String(code).trim().toUpperCase()]
    );
    if (invites.length === 0) {
      return res.status(404).json({ status: 'error', message: '邀请链接无效或已过期' });
    }
    const invitation = invites[0];
    if (invitation.use_count >= invitation.max_uses) {
      return res.status(400).json({ status: 'error', message: '该邀请链接已被使用' });
    }

    // 2. Validate SMS code (same logic as login)
    const [codes] = await pool.query<any[]>(
      `SELECT id, code, expires_at FROM verification_codes
       WHERE phone = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phoneDigits]
    );
    if (codes.length === 0) {
      recordLoginFailure(phoneDigits);
      return res.status(401).json({ status: 'error', message: '验证码无效或已过期，请重新获取' });
    }
    if (codes[0].code !== String(sms_code).trim()) {
      recordLoginFailure(phoneDigits);
      return res.status(401).json({ status: 'error', message: '验证码错误' });
    }

    // 3. Mark code as used + reset brute-force counter
    await pool.query('UPDATE verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);
    resetLoginFailures(phoneDigits);

    // 4. Find or auto-register user
    const [existing] = await pool.query<UserRow[]>(
      'SELECT id, email, phone, name FROM users WHERE phone = ?',
      [phoneDigits]
    );

    let userId: string;
    let userName: string;
    let userEmail: string;
    let isNewUser = false;

    if (existing.length > 0) {
      userId = existing[0].id;
      userName = existing[0].name;
      userEmail = existing[0].email || '';
    } else {
      // Auto-register
      userId = genId('user');
      userName = `用户${phoneDigits.slice(-4)}`;
      userEmail = '';
      isNewUser = true;

      await pool.query(
        'INSERT INTO users (id, email, password_hash, name, phone) VALUES (?, NULL, ?, ?, ?)',
        [userId, '', userName, phoneDigits]
      );

      // Auto-create default workspace
      const wsId = genId('ws');
      await pool.query(
        'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
        [wsId, 'My Workspace', `ws-${userId}`, userId]
      );
      await pool.query(
        'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
        [genId('member'), wsId, userId, 'owner']
      );
    }

    // 5. Add user to the invitation's workspace
    try {
      const memberId = genId('member');
      await pool.query(
        'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
        [memberId, invitation.workspace_id, userId, invitation.role]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        // Already a member — still allow proceeding (might just need to re-auth)
      } else {
        throw err;
      }
    }

    // 6. Update invitation
    const newUseCount = invitation.use_count + 1;
    const newStatus = newUseCount >= invitation.max_uses ? 'accepted' : 'active';
    await pool.query(
      `UPDATE invitations SET use_count = ?, accepted_by = ?, accepted_at = NOW(), status = ?
       WHERE id = ?`,
      [newUseCount, userId, newStatus, invitation.id]
    );

    // 7. Generate JWT with the invited workspace as context
    const token = generateToken(userId, invitation.workspace_id, invitation.role);

    return res.json({
      status: 'success',
      data: {
        user: { id: userId, email: userEmail, phone: phoneDigits, name: userName },
        workspace: { id: invitation.workspace_id, name: invitation.workspace_name, role: invitation.role },
        is_new_user: isNewUser,
        token,
      },
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/auth/me */
authRouter.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Not authenticated' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(
      authHeader.split(' ')[1],
      process.env.JWT_SECRET || 'onellm-dev-secret-change-in-production'
    ) as { sub: string; workspace_id?: string; role?: string };

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, email, phone, name FROM users WHERE id = ?', [payload.sub]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = rows[0];

    // Fetch workspace name if workspace_id is present
    let workspace: any = null;
    if (payload.workspace_id) {
      const [wss] = await pool.query<any[]>(
        'SELECT id, name FROM workspaces WHERE id = ?', [payload.workspace_id]
      );
      if (wss.length > 0) {
        workspace = { id: wss[0].id, name: wss[0].name, role: payload.role || 'member' };
      }
    }

    return res.json({
      status: 'success',
      data: {
        id: user.id, email: user.email, phone: user.phone, name: user.name,
        workspace,
      },
    });
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
});

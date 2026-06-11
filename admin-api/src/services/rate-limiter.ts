/**
 * In-Memory Rate Limiter
 *
 * Provides two protections:
 *   1. IP-based rate limit for send-code (prevents SMS bombing)
 *   2. Phone-based brute-force lockout for login (prevents code guessing)
 *
 * All state is in-memory — lost on restart, which is acceptable for the
 * current single-process deployment.
 */

interface AttemptRecord {
  count: number;
  lockedUntil: number; // epoch ms, 0 = not locked
}

// ── IP-based send-code limiter ──
// Keyed by IP, capped at MAX_SENDS_PER_IP / WINDOW_MS
const ipSendMap = new Map<string, { count: number; windowStart: number }>();

const SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SENDS_PER_IP = 5;

// ── Phone-based login brute-force lockout ──
// Keyed by phone, lock after MAX_FAILURES consecutive failures
const phoneLoginMap = new Map<string, AttemptRecord>();

const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_FAILURES = 5;

// ── Periodic cleanup (every 10 min) ──
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();

  for (const [key, val] of ipSendMap) {
    if (now - val.windowStart > SEND_WINDOW_MS) {
      ipSendMap.delete(key);
    }
  }

  for (const [key, val] of phoneLoginMap) {
    if (val.lockedUntil > 0 && now > val.lockedUntil) {
      phoneLoginMap.delete(key);
    }
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

// ── Public API ──

/**
 * Check if a given IP is allowed to request a verification code.
 * Returns { allowed: boolean, retryAfterSec?: number }
 */
export function checkSendCodeLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = ipSendMap.get(ip);

  if (!record || now - record.windowStart > SEND_WINDOW_MS) {
    // First request or window expired → reset
    ipSendMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (record.count >= MAX_SENDS_PER_IP) {
    const retryAfterSec = Math.ceil((record.windowStart + SEND_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  record.count++;
  return { allowed: true };
}

/**
 * Check if a phone number is locked out due to too many failed login attempts.
 * Returns { allowed: boolean, retryAfterSec?: number }
 */
export function checkLoginLockout(phone: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = phoneLoginMap.get(phone);

  if (!record) {
    return { allowed: true };
  }

  if (record.lockedUntil > 0) {
    if (now > record.lockedUntil) {
      // Lock expired
      phoneLoginMap.delete(phone);
      return { allowed: true };
    }
    const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt for a phone number.
 * Locks the phone out after MAX_LOGIN_FAILURES consecutive failures.
 */
export function recordLoginFailure(phone: string): void {
  const now = Date.now();
  const record = phoneLoginMap.get(phone);

  if (!record) {
    phoneLoginMap.set(phone, { count: 1, lockedUntil: 0 });
    return;
  }

  record.count++;

  if (record.count >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
}

/**
 * Clear the failure record for a phone number (called on successful login).
 */
export function resetLoginFailures(phone: string): void {
  phoneLoginMap.delete(phone);
}

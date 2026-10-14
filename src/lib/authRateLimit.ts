/**
 * Auth Rate Limiting & Cooldown Utilities
 * Enforces client-side cooldowns, in-flight submission locks, and clean error parsing.
 */

export interface ParsedAuthError {
  isRateLimit: boolean;
  isDuplicate: boolean;
  isUnconfirmed: boolean;
  code?: string;
  status?: number;
  message: string;
  technicalDetails?: string;
}

export function parseSupabaseAuthError(err: any): ParsedAuthError {
  const status = err?.status || (err?.code === 'over_email_send_rate_limit' ? 429 : undefined);
  const code = err?.code || '';
  const rawMsg = err?.message || (typeof err === 'string' ? err : 'Authentication error occurred.');
  const lowerMsg = rawMsg.toLowerCase();

  const isRateLimit =
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests');

  const isDuplicate =
    code === 'user_already_exists' ||
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('already exists');

  const isUnconfirmed =
    code === 'email_not_confirmed' ||
    lowerMsg.includes('email not confirmed') ||
    lowerMsg.includes('not been confirmed');

  let userFriendlyMessage = rawMsg;

  if (isRateLimit) {
    if (code === 'over_request_rate_limit' || lowerMsg.includes('60 seconds')) {
      userFriendlyMessage =
        'Please wait at least 60 seconds before requesting another verification email.';
    } else {
      userFriendlyMessage =
        'Email rate limit reached. The authentication service has temporarily paused sending verification emails. Please wait a few minutes before trying again.';
    }
  } else if (isDuplicate) {
    userFriendlyMessage =
      'An account with this email address already exists. Please sign in instead.';
  } else if (isUnconfirmed) {
    userFriendlyMessage =
      'Your email address has not been confirmed yet. Please verify your email via the activation link sent to your inbox.';
  } else if (lowerMsg.includes('invalid login credentials')) {
    userFriendlyMessage =
      'Invalid email or password. If you recently registered, please ensure your email has been confirmed.';
  }

  return {
    isRateLimit,
    isDuplicate,
    isUnconfirmed,
    code,
    status,
    message: userFriendlyMessage,
    technicalDetails: rawMsg,
  };
}

const COOLDOWN_PREFIX = 'resqnet_cooldown_';

export function getCooldownRemaining(email: string): number {
  if (!email) return 0;
  try {
    const key = COOLDOWN_PREFIX + email.trim().toLowerCase();
    const stored = sessionStorage.getItem(key);
    if (!stored) return 0;
    const expiresAt = Number(stored);
    const now = Date.now();
    if (now >= expiresAt) {
      sessionStorage.removeItem(key);
      return 0;
    }
    return Math.ceil((expiresAt - now) / 1000);
  } catch {
    return 0;
  }
}

export function setCooldown(email: string, seconds = 60): void {
  if (!email) return;
  try {
    const key = COOLDOWN_PREFIX + email.trim().toLowerCase();
    const expiresAt = Date.now() + seconds * 1000;
    sessionStorage.setItem(key, String(expiresAt));
  } catch {
    // sessionStorage might be unavailable in some private windows
  }
}

export function clearCooldown(email: string): void {
  if (!email) return;
  try {
    const key = COOLDOWN_PREFIX + email.trim().toLowerCase();
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

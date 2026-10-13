type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now >= record.resetAt) {
      store.delete(key);
    }
  }
}, 60000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * Extracts client IP address safely from standard proxy headers
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  return '127.0.0.1';
}

/**
 * In-memory sliding window rate limiter
 * @param key Unique identifier (e.g. `login:${ip}`)
 * @param limit Maximum allowed requests within window
 * @param windowSeconds Window duration in seconds
 */
export function checkRateLimit(
  key: string,
  limit = 5,
  windowSeconds = 60
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (existing.count >= limit) {
    const remainingSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds: remainingSeconds,
    };
  }

  existing.count += 1;
  const remainingSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    success: true,
    limit,
    remaining: limit - existing.count,
    resetSeconds: remainingSeconds,
  };
}

/**
 * Reset rate limit counter (e.g. on successful login)
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearRateLimits(): void {
  store.clear();
}

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store keyed by "userId:endpoint"
const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Per-user rate limiter.
 * @param maxRequests - max requests in the window
 * @param windowMs - window size in milliseconds
 */
export function rateLimitPerUser(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.telegramUserId;
    if (!userId) {
      next();
      return;
    }

    const key = `${userId}:${req.path}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: retryAfterSec,
      });
      return;
    }

    entry.count++;
    next();
  };
}

/**
 * Global IP-based rate limiter for unauthenticated routes.
 */
export function globalRateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ip:${ip}:${req.path}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({ error: 'Too many requests.' });
      return;
    }

    entry.count++;
    next();
  };
}

import type { Context, MiddlewareHandler } from "hono";
import { redis } from "../lib/redis";
import { AppError } from "../lib/errors";

type RateLimitOptions = {
  prefix: string;
  key: (c: Context) => Promise<string> | string;
  max: number;
  windowSec: number;
};

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const k = `rl:${opts.prefix}:${await opts.key(c)}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, opts.windowSec);
    if (n > opts.max) {
      const ttl = await redis.ttl(k);
      const resetMs = Date.now() + (ttl > 0 ? ttl : opts.windowSec) * 1000;
      c.header("X-RateLimit-Reset", String(resetMs));
      throw new AppError("RATE_LIMITED", "Too many requests", 429, { resetMs });
    }
    await next();
  };
}

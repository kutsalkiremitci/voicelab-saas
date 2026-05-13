import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger";

export const requestLogger: MiddlewareHandler<{
  Variables: { requestId: string; userId?: string };
}> = async (c, next) => {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  await next();

  const ms = Math.round(performance.now() - start);
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: ms,
    userId: c.get("userId"),
    requestId,
  });
};

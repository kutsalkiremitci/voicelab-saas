import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getUserId, SESSION_COOKIE_NAME } from "../services/session";
import { AppError } from "../lib/errors";

export type AuthVariables = {
  userId: string;
  requestId: string;
};

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  c,
  next,
) => {
  const sid = getCookie(c, SESSION_COOKIE_NAME);
  if (!sid) throw new AppError("UNAUTHORIZED", "Authentication required", 401);

  const userId = await getUserId(sid);
  if (!userId) throw new AppError("UNAUTHORIZED", "Session invalid or expired", 401);

  c.set("userId", userId);
  await next();
};

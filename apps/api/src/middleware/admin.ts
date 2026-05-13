import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import type { AuthVariables } from "./auth";

export const requireAdmin: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  c,
  next,
) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  if (!user || user.role !== "admin") {
    throw new AppError("FORBIDDEN", "Admin role required", 403);
  }
  await next();
};

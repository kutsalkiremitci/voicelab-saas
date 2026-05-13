import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import type { AuthVariables } from "./auth";

export const requireVerified: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  c,
  next,
) => {
  const userId = c.get("userId");
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { status: true },
  });

  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (user.status === "unverified") {
    throw new AppError("ACCOUNT_UNVERIFIED", "Email not verified", 403);
  }
  if (user.status === "suspended") {
    throw new AppError("ACCOUNT_SUSPENDED", "Account suspended", 403);
  }
  await next();
};

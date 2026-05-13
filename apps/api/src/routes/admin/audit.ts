import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../../lib/db";
import { adminAuditLog } from "@voicelab/db/schema";
import { requireAuth, type AuthVariables } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/admin";
import { adminAuditQuerySchema } from "@voicelab/shared/schemas/admin";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireAdmin);

route.get("/", async (c) => {
  const q = adminAuditQuerySchema.parse({
    adminId: c.req.query("adminId"),
    action: c.req.query("action"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const conditions = [];
  if (q.adminId) conditions.push(eq(adminAuditLog.adminId, q.adminId));
  if (q.action) conditions.push(eq(adminAuditLog.action, q.action));
  if (q.cursor) conditions.push(lt(adminAuditLog.createdAt, new Date(q.cursor)));

  const where =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const rows = await db
    .select()
    .from(adminAuditLog)
    .where(where)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]!.createdAt.toISOString()
    : null;

  return c.json({ entries: slice, nextCursor });
});

export default route;

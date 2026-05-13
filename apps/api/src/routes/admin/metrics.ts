import { Hono } from "hono";
import { sql, eq, gte, count } from "drizzle-orm";
import { db } from "../../lib/db";
import { users } from "@voicelab/db/schema";
import { requireAuth, type AuthVariables } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/admin";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireAdmin);

route.get("/", async (c) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [totalRow] = await db.select({ n: count() }).from(users);
  const [todayRow] = await db
    .select({ n: count() })
    .from(users)
    .where(gte(users.createdAt, startOfDay));

  const tierRows = await db
    .select({ tier: users.tier, n: count() })
    .from(users)
    .groupBy(users.tier);

  const statusRows = await db
    .select({ status: users.status, n: count() })
    .from(users)
    .groupBy(users.status);

  const [activeFreeRow] = await db
    .select({ n: count() })
    .from(users)
    .where(sql`${users.tier} = 'free' AND ${users.status} = 'active'`);

  const byTier: Record<string, number> = {};
  for (const r of tierRows) byTier[r.tier] = r.n;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = r.n;

  const paidByTier = {
    basic: byTier.basic ?? 0,
    pro: byTier.pro ?? 0,
    enterprise: byTier.enterprise ?? 0,
  };

  return c.json({
    totalUsers: totalRow!.n,
    signupsToday: todayRow!.n,
    activeFreeUsers: activeFreeRow!.n,
    paidUsersByTier: paidByTier,
    byStatus,
  });
});

void eq;
export default route;

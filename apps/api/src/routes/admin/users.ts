import { Hono } from "hono";
import { and, eq, lt, desc, or, ilike } from "drizzle-orm";
import { db } from "../../lib/db";
import { redis } from "../../lib/redis";
import { users, credits, adminAuditLog } from "@voicelab/db/schema";
import { AppError } from "../../lib/errors";
import { requireAuth, type AuthVariables } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/admin";
import { encryptApiKey } from "../../services/encryption";
import { grantCredits } from "../../services/free-credits";
import {
  setApiKeySchema,
  patchUserSchema,
  grantCreditsSchema,
  adminUserListQuerySchema,
  type UpstreamPlan,
} from "@voicelab/shared/schemas/admin";
import { writeAudit } from "../../lib/audit";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireAdmin);

const TIER_FOR_PLAN: Record<UpstreamPlan, "basic" | "pro" | "enterprise"> = {
  starter: "basic",
  creator: "pro",
  pro: "enterprise",
  scale: "enterprise",
};

function publicAdminUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    tier: u.tier,
    elevenlabsPlan: u.elevenlabsPlan,
    hasApiKey: !!u.elevenlabsApiKey,
    emailVerifiedAt: u.emailVerifiedAt,
    activatedAt: u.activatedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

route.get("/", async (c) => {
  const q = adminUserListQuerySchema.parse({
    status: c.req.query("status"),
    tier: c.req.query("tier"),
    search: c.req.query("search"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const conditions = [];
  if (q.status) conditions.push(eq(users.status, q.status));
  if (q.tier) conditions.push(eq(users.tier, q.tier));
  if (q.search) {
    conditions.push(
      or(ilike(users.email, `%${q.search}%`), ilike(users.name, `%${q.search}%`))!,
    );
  }
  if (q.cursor) conditions.push(lt(users.createdAt, new Date(q.cursor)));

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]!.createdAt.toISOString()
    : null;
  return c.json({ users: slice.map(publicAdminUser), nextCursor });
});

route.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  const credit = user.tier === "free"
    ? await db.query.credits.findFirst({ where: eq(credits.userId, id) })
    : null;

  return c.json({
    user: publicAdminUser(user),
    balance: credit?.balance ?? null,
  });
});

route.patch("/:id", async (c) => {
  const adminId = c.get("userId");
  const id = c.req.param("id");
  const body = patchUserSchema.parse(await c.req.json());

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  if (body.role === "user" && id === adminId) {
    throw new AppError("CANNOT_DEMOTE_SELF", "Admins cannot demote themselves", 403);
  }

  const updated = await db
    .update(users)
    .set({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.role !== undefined && { role: body.role }),
      ...(body.tier !== undefined && { tier: body.tier }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  const u = updated[0]!;

  if (body.status && body.status !== target.status) {
    if (body.status === "suspended") {
      await writeAudit(adminId, "SUSPEND_USER", { targetUserId: id });
    } else if (body.status === "active" && target.status === "suspended") {
      await writeAudit(adminId, "UNSUSPEND_USER", { targetUserId: id });
    }
  }
  if (body.role && body.role !== target.role) {
    await writeAudit(
      adminId,
      body.role === "admin" ? "PROMOTE_TO_ADMIN" : "DEMOTE_FROM_ADMIN",
      { targetUserId: id },
    );
  }
  if (body.tier && body.tier !== target.tier) {
    await writeAudit(adminId, "TIER_CHANGED", {
      targetUserId: id,
      from: target.tier,
      to: body.tier,
    });
  }

  return c.json({ user: publicAdminUser(u) });
});

route.put("/:id/api-key", async (c) => {
  const adminId = c.get("userId");
  const id = c.req.param("id");
  const body = setApiKeySchema.parse(await c.req.json());

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (target.status !== "active") {
    throw new AppError("USER_NOT_ACTIVE", "Verify the user's email first", 409);
  }

  const newTier = TIER_FOR_PLAN[body.plan];
  const encrypted = encryptApiKey(body.apiKey);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        elevenlabsApiKey: encrypted,
        elevenlabsPlan: body.plan,
        tier: newTier,
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await tx.delete(credits).where(eq(credits.userId, id));
  });
  await redis.del(`subscription:${id}`);
  await writeAudit(adminId, "SET_API_KEY", {
    targetUserId: id,
    plan: body.plan,
    tier: newTier,
  });

  const updated = await db.query.users.findFirst({ where: eq(users.id, id) });
  return c.json({ user: publicAdminUser(updated!) });
});

route.delete("/:id/api-key", async (c) => {
  const adminId = c.get("userId");
  const id = c.req.param("id");
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  await db
    .update(users)
    .set({
      elevenlabsApiKey: null,
      elevenlabsPlan: null,
      tier: "free",
      activatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
  await redis.del(`subscription:${id}`);
  await writeAudit(adminId, "REMOVE_API_KEY", { targetUserId: id });

  const updated = await db.query.users.findFirst({ where: eq(users.id, id) });
  return c.json({ user: publicAdminUser(updated!) });
});

route.post("/:id/credits", async (c) => {
  const adminId = c.get("userId");
  const id = c.req.param("id");
  const body = grantCreditsSchema.parse(await c.req.json());

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  await grantCredits(id, body.amount, {
    operation: "admin_grant",
    description: body.reason ?? body.note ?? undefined,
    metadata: { adminId, reason: body.reason ?? null, note: body.note ?? null },
  });
  const updated = await db.query.credits.findFirst({ where: eq(credits.userId, id) });
  await writeAudit(adminId, "GRANT_FREE_CREDITS", {
    targetUserId: id,
    amount: body.amount,
    reason: body.reason ?? null,
    note: body.note ?? null,
  });
  return c.json({ credits: updated }, 201);
});

route.post("/:id/manual-verify", async (c) => {
  const adminId = c.get("userId");
  const id = c.req.param("id");
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (target.status === "active") {
    return c.json({ user: publicAdminUser(target) });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: target.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await tx
      .insert(credits)
      .values({ userId: id, balance: 1000 })
      .onConflictDoNothing();
  });
  await writeAudit(adminId, "MANUAL_VERIFY", { targetUserId: id });
  const updated = await db.query.users.findFirst({ where: eq(users.id, id) });
  return c.json({ user: publicAdminUser(updated!) });
});

void adminAuditLog;
export default route;

import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { generations } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { storage } from "../services/storage";
import { listGenerationsQuerySchema } from "@voicelab/shared/schemas/generations";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireVerified);

function publicGeneration(g: typeof generations.$inferSelect) {
  return {
    id: g.id,
    voiceId: g.voiceId,
    text: g.text,
    mimeType: g.mimeType,
    sizeBytes: g.sizeBytes,
    durationSec: g.durationSec ? Number(g.durationSec) : null,
    characterCount: g.characterCount,
    settings: g.settings,
    url: `/api/v1/files/generations/${g.id}`,
    createdAt: g.createdAt,
  };
}

route.get("/", async (c) => {
  const userId = c.get("userId");
  const q = listGenerationsQuerySchema.parse({
    voiceId: c.req.query("voiceId"),
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const conditions = [eq(generations.userId, userId)];
  if (q.voiceId) conditions.push(eq(generations.voiceId, q.voiceId));
  if (q.cursor) conditions.push(lt(generations.createdAt, new Date(q.cursor)));

  const rows = await db
    .select()
    .from(generations)
    .where(and(...conditions))
    .orderBy(desc(generations.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]!.createdAt.toISOString()
    : null;

  return c.json({ generations: slice.map(publicGeneration), nextCursor });
});

route.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await db.query.generations.findFirst({
    where: and(eq(generations.id, id), eq(generations.userId, userId)),
  });
  if (!row) throw new AppError("GENERATION_NOT_FOUND", "Generation not found", 404);
  return c.json({ generation: publicGeneration(row) });
});

route.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.generations.findFirst({
    where: and(eq(generations.id, id), eq(generations.userId, userId)),
    columns: { id: true, storageKey: true },
  });
  if (!existing) throw new AppError("GENERATION_NOT_FOUND", "Generation not found", 404);
  await storage.delete(existing.storageKey);
  await db
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)));
  return c.body(null, 204);
});

export default route;

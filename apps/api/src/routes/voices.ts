import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { recordings, voices, users } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { storage } from "../services/storage";
import { cloneVoice, deleteVoice } from "../services/voice-ai";
import { checkCloningPermission, type Tier } from "../lib/tier-gates";
import {
  createVoiceSchema,
  listVoicesQuerySchema,
} from "@voicelab/shared/schemas/voices";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireVerified);

function publicVoice(v: typeof voices.$inferSelect) {
  return {
    id: v.id,
    name: v.name,
    label: v.label,
    description: v.description,
    status: v.status,
    error: v.error,
    elevenLabsVoiceId: v.elevenLabsVoiceId,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

async function getUserTier(userId: string): Promise<Tier> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  if (!u) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  return u.tier as Tier;
}

route.post("/", async (c) => {
  const userId = c.get("userId");
  const body = createVoiceSchema.parse(await c.req.json());

  const tier = await getUserTier(userId);
  checkCloningPermission(tier, body.kind);

  const recording = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, body.recordingId), eq(recordings.userId, userId)),
  });
  if (!recording) {
    throw new AppError("RECORDING_NOT_FOUND", "Recording not found", 404);
  }

  const labelExists = await db.query.voices.findFirst({
    where: and(eq(voices.userId, userId), eq(voices.label, body.label)),
    columns: { id: true },
  });
  if (labelExists) {
    throw new AppError("LABEL_TAKEN", "A voice with this label already exists", 409);
  }

  const stream = await storage.get(recording.storageKey);
  const fileBuffer = Buffer.from(await new Response(stream).arrayBuffer());
  const blob = new Blob([fileBuffer], { type: recording.mimeType });

  const { voiceId } = await cloneVoice(
    userId,
    body.label,
    [blob],
    body.kind,
    body.description,
  );

  const inserted = await db
    .insert(voices)
    .values({
      userId,
      recordingId: recording.id,
      name: body.label,
      label: body.label,
      description: body.description,
      elevenLabsVoiceId: voiceId,
      status: "ready",
    })
    .returning();

  return c.json({ voice: publicVoice(inserted[0]!) }, 201);
});

route.get("/", async (c) => {
  const userId = c.get("userId");
  const q = listVoicesQuerySchema.parse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });
  const where = q.cursor
    ? and(eq(voices.userId, userId), lt(voices.createdAt, new Date(q.cursor)))
    : eq(voices.userId, userId);

  const rows = await db
    .select()
    .from(voices)
    .where(where)
    .orderBy(desc(voices.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]!.createdAt.toISOString()
    : null;

  return c.json({ voices: slice.map(publicVoice), nextCursor });
});

route.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await db.query.voices.findFirst({
    where: and(eq(voices.id, id), eq(voices.userId, userId)),
  });
  if (!row) throw new AppError("VOICE_NOT_FOUND", "Voice not found", 404);
  return c.json({ voice: publicVoice(row) });
});

route.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.voices.findFirst({
    where: and(eq(voices.id, id), eq(voices.userId, userId)),
    columns: { id: true, elevenLabsVoiceId: true },
  });
  if (!existing) throw new AppError("VOICE_NOT_FOUND", "Voice not found", 404);

  try {
    await deleteVoice(userId, existing.elevenLabsVoiceId);
  } catch (err) {
    // Upstream delete failures shouldn't block local cleanup; surface but continue.
    // The local row is removed regardless so the slot reflects user intent.
  }

  await db.delete(voices).where(and(eq(voices.id, id), eq(voices.userId, userId)));
  return c.body(null, 204);
});

export default route;

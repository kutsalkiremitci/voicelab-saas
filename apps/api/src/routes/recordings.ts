import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { recordings } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { storage } from "../services/storage";
import { buildKey, type StorageKind } from "../services/storage/keys";
import { validateAudio } from "../services/storage/validation";
import {
  recordingNameSchema,
  updateRecordingSchema,
  listRecordingsQuerySchema,
} from "@voicelab/shared/schemas/recordings";

const route = new Hono<{ Variables: AuthVariables }>();

route.use("*", requireAuth, requireVerified);

function publicRecording(r: typeof recordings.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    durationSec: Number(r.durationSec),
    url: `/api/v1/files/recordings/${r.id}`,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

route.post("/", async (c) => {
  const userId = c.get("userId");
  const form = await c.req.formData();

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    throw new AppError("INVALID_FILE", "audio field missing", 400);
  }
  const rawName = form.get("name");
  const name = recordingNameSchema.parse(typeof rawName === "string" ? rawName : "Untitled");

  const rawDuration = form.get("duration");
  const durationSec = Number(rawDuration);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 600) {
    throw new AppError("INVALID_DURATION", "duration must be between 0 and 600 seconds", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const declaredMime =
    (file as { type?: string }).type && (file as { type?: string }).type !== ""
      ? (file as { type: string }).type
      : "audio/webm";

  const validated = await validateAudio({ buffer, declaredMime });

  const key = buildKey(userId, "recordings" as StorageKind, validated.ext);
  await storage.put(key, validated.buffer, validated.detectedMime);

  const inserted = await db
    .insert(recordings)
    .values({
      userId,
      name,
      storageKey: key,
      mimeType: validated.detectedMime,
      sizeBytes: validated.buffer.length,
      durationSec: durationSec.toFixed(3),
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new AppError("INTERNAL_ERROR", "Failed to insert recording", 500);

  return c.json({ recording: publicRecording(row) }, 201);
});

route.get("/", async (c) => {
  const userId = c.get("userId");
  const q = listRecordingsQuerySchema.parse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const where = q.cursor
    ? and(eq(recordings.userId, userId), lt(recordings.createdAt, new Date(q.cursor)))
    : eq(recordings.userId, userId);

  const rows = await db
    .select()
    .from(recordings)
    .where(where)
    .orderBy(desc(recordings.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]!.createdAt.toISOString()
    : null;

  return c.json({
    recordings: slice.map(publicRecording),
    nextCursor,
  });
});

route.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
  });
  if (!row) throw new AppError("RECORDING_NOT_FOUND", "Recording not found", 404);
  return c.json({ recording: publicRecording(row) });
});

route.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = updateRecordingSchema.parse(await c.req.json());

  const existing = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
    columns: { id: true },
  });
  if (!existing) throw new AppError("RECORDING_NOT_FOUND", "Recording not found", 404);

  const updated = await db
    .update(recordings)
    .set({ name: body.name, updatedAt: new Date() })
    .where(and(eq(recordings.id, id), eq(recordings.userId, userId)))
    .returning();
  return c.json({ recording: publicRecording(updated[0]!) });
});

route.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
    columns: { id: true, storageKey: true },
  });
  if (!existing) throw new AppError("RECORDING_NOT_FOUND", "Recording not found", 404);

  await storage.delete(existing.storageKey);
  await db
    .delete(recordings)
    .where(and(eq(recordings.id, id), eq(recordings.userId, userId)));
  return c.body(null, 204);
});

route.post("/:id/re-record", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
  });
  if (!existing) throw new AppError("RECORDING_NOT_FOUND", "Recording not found", 404);

  const form = await c.req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    throw new AppError("INVALID_FILE", "audio field missing", 400);
  }
  const rawDuration = form.get("duration");
  const durationSec = Number(rawDuration);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 600) {
    throw new AppError("INVALID_DURATION", "duration must be between 0 and 600 seconds", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const declaredMime =
    (file as { type?: string }).type && (file as { type?: string }).type !== ""
      ? (file as { type: string }).type
      : "audio/webm";
  const validated = await validateAudio({ buffer, declaredMime });

  const newKey = buildKey(userId, "recordings" as StorageKind, validated.ext);
  await storage.put(newKey, validated.buffer, validated.detectedMime);
  await storage.delete(existing.storageKey);

  const updated = await db
    .update(recordings)
    .set({
      storageKey: newKey,
      mimeType: validated.detectedMime,
      sizeBytes: validated.buffer.length,
      durationSec: durationSec.toFixed(3),
      updatedAt: new Date(),
    })
    .where(and(eq(recordings.id, id), eq(recordings.userId, userId)))
    .returning();

  return c.json({ recording: publicRecording(updated[0]!) });
});

export default route;

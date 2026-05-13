import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { recordings, voices, generations, users } from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { rateLimit } from "../middleware/rate-limit";
import { storage } from "../services/storage";
import {
  cloneVoice,
  deleteVoice,
  generateSpeech,
  speechToSpeech,
} from "../services/voice-ai";
import {
  checkCloningPermission,
  checkSpeechToSpeechPermission,
  type Tier,
} from "../lib/tier-gates";
import {
  chargeFreeUser,
  getFreeBalance,
  quoteFreeOperation,
} from "../services/free-credits";
import { buildKey } from "../services/storage/keys";
import { validateAudio } from "../services/storage/validation";
import {
  createVoiceSchema,
  listVoicesQuerySchema,
} from "@voicelab/shared/schemas/voices";
import { generateSchema } from "@voicelab/shared/schemas/generations";

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

route.post(
  "/:id/generate",
  rateLimit({
    prefix: "generate",
    key: (c) => c.get("userId") as string,
    max: 60,
    windowSec: 3600,
  }),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = generateSchema.parse(await c.req.json());

    const voice = await db.query.voices.findFirst({
      where: and(eq(voices.id, id), eq(voices.userId, userId)),
    });
    if (!voice) throw new AppError("VOICE_NOT_FOUND", "Voice not found", 404);

    const tier = await getUserTier(userId);

    if (tier === "free") {
      const quote = quoteFreeOperation("tts", { text: body.text });
      const balance = (await getFreeBalance(userId)) ?? 0;
      if (balance < quote.amount) {
        throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
          required: quote.amount,
          balance,
          deficit: quote.amount - balance,
        });
      }
    }

    const result = await generateSpeech(
      userId,
      voice.elevenLabsVoiceId,
      body.text,
      body.settings,
    );
    const audioBuffer = Buffer.from(await new Response(result.audio).arrayBuffer());

    const key = buildKey(userId, "generations", "mp3");
    await storage.put(key, audioBuffer, "audio/mpeg");

    const inserted = await db
      .insert(generations)
      .values({
        userId,
        voiceId: voice.id,
        text: body.text,
        storageKey: key,
        mimeType: "audio/mpeg",
        sizeBytes: audioBuffer.length,
        characterCount: result.characterCount,
        settings: body.settings ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new AppError("INTERNAL_ERROR", "Failed to insert generation", 500);

    if (tier === "free") {
      await chargeFreeUser(userId, result.characterCount, {
        voiceId: voice.id,
        generationId: row.id,
        characters: result.characterCount,
      });
    }

    return c.json({ generation: publicGeneration(row) }, 201);
  },
);

route.post(
  "/:id/speech-to-speech",
  rateLimit({
    prefix: "s2s",
    key: (c) => c.get("userId") as string,
    max: 30,
    windowSec: 3600,
  }),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const voice = await db.query.voices.findFirst({
      where: and(eq(voices.id, id), eq(voices.userId, userId)),
    });
    if (!voice) throw new AppError("VOICE_NOT_FOUND", "Voice not found", 404);

    const tier = await getUserTier(userId);
    checkSpeechToSpeechPermission(tier);

    const form = await c.req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      throw new AppError("INVALID_FILE", "audio field missing", 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const declaredMime =
      (file as { type?: string }).type && (file as { type?: string }).type !== ""
        ? (file as { type: string }).type
        : "audio/webm";
    const validated = await validateAudio({ buffer, declaredMime });

    const inputBlob = new Blob([validated.buffer], { type: validated.detectedMime });
    const result = await speechToSpeech(userId, voice.elevenLabsVoiceId, inputBlob);
    const audioBuffer = Buffer.from(await new Response(result.audio).arrayBuffer());

    const key = buildKey(userId, "generations", "mp3");
    await storage.put(key, audioBuffer, "audio/mpeg");

    const inserted = await db
      .insert(generations)
      .values({
        userId,
        voiceId: voice.id,
        text: "[speech-to-speech]",
        storageKey: key,
        mimeType: "audio/mpeg",
        sizeBytes: audioBuffer.length,
        characterCount: result.characterCount,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new AppError("INTERNAL_ERROR", "Failed to insert generation", 500);

    return c.json({ generation: publicGeneration(row) }, 201);
  },
);

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

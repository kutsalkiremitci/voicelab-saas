import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { generations, users } from "@voicelab/db/schema";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { requireAdmin } from "../middleware/admin";
import {
  listLibraryVoices,
  getLibraryVoiceById,
  invalidateLibraryCache,
} from "../services/library-voices";
import { generateSpeech, listModels } from "../services/voice-ai";
import { checkOutputFormat, type Tier } from "../lib/tier-gates";
import { chargeFreeUser, getFreeBalance, quoteFreeOperation } from "../services/free-credits";
import { buildKey } from "../services/storage/keys";
import { storage } from "../services/storage";
import { generateSchema, type OutputFormat } from "@voicelab/shared/schemas/generations";
import { rateLimit } from "../middleware/rate-limit";
import { AppError } from "../lib/errors";

const app = new Hono<{ Variables: AuthVariables }>();

async function getUserTier(userId: string): Promise<Tier> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  return (user?.tier ?? "free") as Tier;
}

function publicGeneration(g: typeof generations.$inferSelect) {
  return {
    id: g.id,
    voiceId: g.voiceId,
    libraryVoiceId: g.libraryVoiceId,
    text: g.text,
    mimeType: g.mimeType,
    sizeBytes: g.sizeBytes,
    characterCount: g.characterCount,
    settings: g.settings,
    url: `/api/v1/files/generations/${g.id}`,
    createdAt: g.createdAt,
  };
}

// List with pagination — proxies ElevenLabs shared voices
app.get("/voices", requireAuth, requireVerified, async (c) => {
  const q = c.req.query();
  const page = Math.max(0, parseInt(q.page ?? "0", 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? "20", 10) || 20));

  const result = await listLibraryVoices({
    page,
    pageSize,
    gender: q.gender,
    age: q.age,
    accent: q.accent,
    language: q.language,
    category: q.category,
    search: q.search?.slice(0, 100),
  });

  return c.json(result);
});

// Single voice by ElevenLabs voiceId
app.get("/voices/:voiceId", requireAuth, requireVerified, async (c) => {
  const { voiceId } = c.req.param();
  const voice = await getLibraryVoiceById(voiceId);
  if (!voice) throw new AppError("NOT_FOUND", "Library voice not found", 404);
  return c.json({ voice });
});

// Preview: proxy upstream MP3 so audio plays same-origin (no redirect / cookie issues)
app.get("/voices/:voiceId/preview", requireAuth, requireVerified, async (c) => {
  const { voiceId } = c.req.param();
  const voice = await getLibraryVoiceById(voiceId);
  if (!voice) throw new AppError("NOT_FOUND", "Library voice not found", 404);
  if (!voice.previewUrl) throw new AppError("NOT_FOUND", "No preview available", 404);

  const upstream = await fetch(voice.previewUrl);
  if (!upstream.ok || !upstream.body) {
    throw new AppError("UPSTREAM_ERROR", "Failed to fetch preview", 502);
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
});

// Generate TTS using library voice
app.post(
  "/voices/:voiceId/generate",
  requireAuth,
  requireVerified,
  rateLimit({
    prefix: "lib-generate",
    key: (c) => c.get("userId") as string,
    max: 60,
    windowSec: 3600,
  }),
  async (c) => {
    const userId = c.get("userId");
    const { voiceId } = c.req.param();
    const body = generateSchema.parse(await c.req.json());

    // Verify voice exists in ElevenLabs
    const libVoice = await getLibraryVoiceById(voiceId);
    if (!libVoice) throw new AppError("NOT_FOUND", "Library voice not found", 404);

    const tier = await getUserTier(userId);
    const outputFormat: OutputFormat = body.outputFormat ?? "mp3_44100_128";
    checkOutputFormat(tier, outputFormat);

    const modelId = body.modelId ?? "eleven_multilingual_v2";
    const availableModels = await listModels(userId);
    const model = availableModels.find(
      (m) => m.modelId === modelId && m.canDoTextToSpeech && !m.requiresAlphaAccess,
    );
    if (!model) {
      throw new AppError("INVALID_MODEL", "Model not available for text-to-speech", 400);
    }

    if (body.text.length > model.maximumTextLengthPerRequest) {
      throw new AppError(
        "TEXT_TOO_LONG",
        `Text exceeds model limit of ${model.maximumTextLengthPerRequest} characters`,
        400,
        { limit: model.maximumTextLengthPerRequest, length: body.text.length },
      );
    }

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

    const result = await generateSpeech(userId, voiceId, body.text, {
      modelId,
      settings: body.settings,
      outputFormat,
    });
    const audioBuffer = Buffer.from(await new Response(result.audio).arrayBuffer());

    const ext = outputFormat.startsWith("pcm") ? "pcm" : "mp3";
    const mime = outputFormat.startsWith("pcm") ? "audio/pcm" : "audio/mpeg";
    const key = buildKey(userId, "generations", ext);
    await storage.put(key, audioBuffer, mime);

    const settingsPayload = {
      modelId,
      outputFormat,
      libraryVoiceId: voiceId,
      libraryVoiceName: libVoice.name,
      ...(body.settings ?? {}),
    };
    const inserted = await db
      .insert(generations)
      .values({
        userId,
        text: body.text,
        storageKey: key,
        mimeType: mime,
        sizeBytes: audioBuffer.length,
        characterCount: result.characterCount,
        settings: settingsPayload,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new AppError("INTERNAL_ERROR", "Failed to insert generation", 500);

    if (tier === "free") {
      await chargeFreeUser(userId, result.characterCount, {
        libraryVoiceId: voiceId,
        generationId: row.id,
        characters: result.characterCount,
      });
    }

    return c.json({ generation: publicGeneration(row) }, 201);
  },
);

// Admin: clear Redis cache (force refresh)
app.post("/admin/cache/invalidate", requireAuth, requireAdmin, async (c) => {
  await invalidateLibraryCache();
  return c.json({ ok: true });
});

export default app;

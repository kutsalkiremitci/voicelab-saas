import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { generations, users } from "@voicelab/db/schema";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { requireAdmin } from "../middleware/admin";
import {
  listLibraryVoices,
  getLibraryVoice,
  syncFromUpstream,
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

app.get("/voices", requireAuth, requireVerified, async (c) => {
  const q = c.req.query();
  const filters = {
    gender: q.gender,
    accent: q.accent,
    language: q.language,
    category: q.category,
    search: q.search?.slice(0, 100),
  };
  const voices = await listLibraryVoices(filters);
  return c.json({ voices });
});

app.get("/voices/:id", requireAuth, requireVerified, async (c) => {
  const { id } = c.req.param();
  const voice = await getLibraryVoice(id);
  if (!voice) throw new AppError("NOT_FOUND", "Library voice not found", 404);
  return c.json({ voice });
});

app.get("/voices/:id/preview", requireAuth, requireVerified, async (c) => {
  const { id } = c.req.param();
  const voice = await getLibraryVoice(id);
  if (!voice) throw new AppError("NOT_FOUND", "Library voice not found", 404);
  if (!voice.previewUrl) throw new AppError("NOT_FOUND", "No preview available", 404);

  const upstream = await fetch(voice.previewUrl);
  if (!upstream.ok) throw new AppError("UPSTREAM_ERROR", "Preview unavailable", 502);

  const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
  c.header("Content-Type", contentType);
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(upstream.body as ReadableStream);
});

app.post(
  "/voices/:id/generate",
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
    const { id } = c.req.param();
    const body = generateSchema.parse(await c.req.json());

    const libVoice = await getLibraryVoice(id);
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

    const result = await generateSpeech(userId, libVoice.upstreamVoiceId, body.text, {
      modelId,
      settings: body.settings,
      outputFormat,
    });
    const audioBuffer = Buffer.from(await new Response(result.audio).arrayBuffer());

    const ext = outputFormat.startsWith("pcm") ? "pcm" : "mp3";
    const mime = outputFormat.startsWith("pcm") ? "audio/pcm" : "audio/mpeg";
    const key = buildKey(userId, "generations", ext);
    await storage.put(key, audioBuffer, mime);

    const settingsPayload = { modelId, outputFormat, ...(body.settings ?? {}) };
    const inserted = await db
      .insert(generations)
      .values({
        userId,
        libraryVoiceId: libVoice.id,
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
        libraryVoiceId: libVoice.id,
        generationId: row.id,
        characters: result.characterCount,
      });
    }

    return c.json({ generation: publicGeneration(row) }, 201);
  },
);

app.post("/admin/sync", requireAuth, requireAdmin, async (c) => {
  const result = await syncFromUpstream();
  return c.json(result);
});

export default app;

import { Hono } from "hono";
import { and, eq, lt, desc } from "drizzle-orm";
import { db } from "../lib/db";
import {
  transcriptions,
  users,
  type TranscribeOptions,
  type TranscribedWord,
  type TranscriptionAdditionalFormats,
  type TranscriptionExportFormat,
} from "@voicelab/db/schema";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { rateLimit } from "../middleware/rate-limit";
import { storage } from "../services/storage";
import { buildKey, type StorageKind } from "../services/storage/keys";
import { validateMedia } from "../services/storage/validation";
import { env } from "../env";
import { logger } from "../lib/logger";
import {
  transcribeOptionsSchema,
  transcribeKeytermsSchema,
  updateTranscriptionSchema,
  listTranscriptionsQuerySchema,
  transcriptionExportFormatSchema,
} from "@voicelab/shared/schemas/transcriptions";
import {
  transcribe,
  type TranscriptionAdditionalFormat,
  type TranscriptionAdditionalFormatResult,
} from "../services/voice-ai";
import {
  chargeFreeUser,
  quoteFreeOperation,
  getFreeBalance,
} from "../services/free-credits";
import {
  buildSegments,
  renderSrt,
  renderVtt,
  renderTxt,
  renderSegmentedJson,
  renderHtml,
  srtToVtt,
} from "../lib/srt-vtt";

const route = new Hono<{ Variables: AuthVariables }>();

route.use("*", requireAuth, requireVerified);

const TRANSCRIBE_RATE_LIMIT = rateLimit({
  prefix: "transcribe",
  key: (c) => c.get("userId") as string,
  max: 30,
  windowSec: 60 * 60,
});

const FORMATS_REQUIRING_UPSTREAM: ReadonlySet<TranscriptionExportFormat> = new Set([
  "pdf",
  "docx",
  "html",
]);

function parseBoolField(value: string | File | null, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "off" || value === "") return false;
  return fallback;
}

function parseNumberField(value: string | File | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseKeyterms(value: string | File | null): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return transcribeKeytermsSchema.parse(
      parsed.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean),
    );
  } catch {
    return transcribeKeytermsSchema.parse(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
}

interface StoredFormatEntry {
  value?: string;
  storageKey?: string;
  editVersion: number;
}

async function storeAdditionalFormats(
  userId: string,
  editVersion: number,
  results: TranscriptionAdditionalFormatResult[],
): Promise<Partial<Record<string, StoredFormatEntry>>> {
  const out: Partial<Record<string, StoredFormatEntry>> = {};
  for (const r of results) {
    const fmt = r.requestedFormat;
    if (r.isBase64Encoded) {
      const ext = r.fileExtension.replace(/^\./, "");
      const key = buildKey(userId, "transcript-exports" as StorageKind, ext);
      const buffer = Buffer.from(r.content, "base64");
      await storage.put(key, buffer, r.contentType);
      out[fmt] = { storageKey: key, editVersion };
    } else {
      out[fmt] = { value: r.content, editVersion };
    }
  }
  return out;
}

function publicTranscription(t: typeof transcriptions.$inferSelect) {
  const opts = (t.options ?? {}) as TranscribeOptions;
  return {
    id: t.id,
    fileName: t.fileName,
    mimeType: t.mimeType,
    fileSizeBytes: t.fileSizeBytes,
    durationSec: Number(t.durationSec),
    language: t.language,
    languageProbability: Number(t.languageProbability),
    model: t.model,
    text: t.text,
    textOriginal: t.textOriginal,
    words: (t.words ?? []) as TranscribedWord[],
    wordsOriginal: (t.wordsOriginal ?? []) as TranscribedWord[],
    options: opts,
    creditsCharged: t.creditsCharged,
    editVersion: t.editVersion,
    edited: t.text !== t.textOriginal,
    audioUrl: `/api/v1/files/transcriptions/${t.id}`,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

route.post("/", TRANSCRIBE_RATE_LIMIT, async (c) => {
  const userId = c.get("userId");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true },
  });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  const form = await c.req.formData();

  const file = form.get("file") ?? form.get("audio");
  if (!(file instanceof Blob)) {
    throw new AppError("INVALID_AUDIO", "file field missing", 400);
  }
  const declaredMime =
    (file as { type?: string }).type && (file as { type?: string }).type !== ""
      ? (file as { type: string }).type
      : "application/octet-stream";

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = await validateMedia({
    buffer,
    declaredMime,
    maxBytes: env.TRANSCRIBE_MAX_FILE_SIZE_BYTES,
  });

  const opts = transcribeOptionsSchema.parse({
    languageCode: typeof form.get("languageCode") === "string" ? form.get("languageCode") : undefined,
    tagAudioEvents: parseBoolField(form.get("tagAudioEvents"), false),
    noVerbatim: parseBoolField(form.get("noVerbatim"), false),
    includeSubtitles: parseBoolField(form.get("includeSubtitles"), false),
    diarize: parseBoolField(form.get("diarize"), false),
    numSpeakers: parseNumberField(form.get("numSpeakers")),
    keyterms: parseKeyterms(form.get("keyterms")),
    model: typeof form.get("model") === "string" ? form.get("model") : "scribe_v2",
  });

  // Every tier pays for STT from the universal `credits` pool — no free STT.
  {
    const clientDuration = parseNumberField(form.get("durationSec")) ?? 0;
    const quote = quoteFreeOperation("transcribe", {
      durationSec: clientDuration,
      keytermsCount: opts.keyterms.length,
    });
    const balance = (await getFreeBalance(userId)) ?? 0;
    if (quote.amount > 0 && balance < quote.amount) {
      throw new AppError("INSUFFICIENT_CREDITS", "Not enough credits", 402, {
        required: quote.amount,
        balance,
        deficit: quote.amount - balance,
      });
    }
  }
  void user;

  const fileName = file instanceof File && file.name ? file.name : `audio.${validated.ext}`;
  const audioKey = buildKey(userId, "transcriptions" as StorageKind, validated.ext);
  await storage.put(audioKey, validated.buffer, validated.detectedMime);

  let result;
  try {
    result = await transcribe(userId, new Blob([validated.buffer], { type: validated.detectedMime }), {
      languageCode: opts.languageCode,
      tagAudioEvents: opts.tagAudioEvents,
      noVerbatim: opts.noVerbatim,
      includeSubtitles: opts.includeSubtitles,
      diarize: opts.diarize,
      numSpeakers: opts.numSpeakers,
      keyterms: opts.keyterms,
      model: opts.model,
    });
  } catch (e) {
    await storage.delete(audioKey).catch(() => undefined);
    throw e;
  }

  const additionalFormatsStored = await storeAdditionalFormats(userId, 0, result.additionalFormats);

  const persistedOptions: TranscribeOptions = {
    languageCode: opts.languageCode,
    tagAudioEvents: opts.tagAudioEvents,
    noVerbatim: opts.noVerbatim,
    keyterms: opts.keyterms,
    includeSubtitles: opts.includeSubtitles,
    diarize: opts.diarize,
    numSpeakers: opts.numSpeakers,
    model: opts.model,
    speakerNames: {},
  };

  const duration = Math.max(result.audioDurationSecs, 0);

  const inserted = await db
    .insert(transcriptions)
    .values({
      userId,
      audioKey,
      fileName,
      mimeType: validated.detectedMime,
      fileSizeBytes: validated.buffer.length,
      durationSec: duration.toFixed(3),
      model: opts.model,
      language: result.languageCode,
      languageProbability: result.languageProbability.toFixed(4),
      text: result.text,
      textOriginal: result.text,
      words: result.words,
      wordsOriginal: result.words,
      options: persistedOptions,
      additionalFormats: additionalFormatsStored as TranscriptionAdditionalFormats,
      editVersion: 0,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new AppError("INTERNAL_ERROR", "Failed to insert transcription", 500);

  const charge = quoteFreeOperation("transcribe", {
    durationSec: duration,
    keytermsCount: opts.keyterms.length,
  });
  if (charge.amount > 0) {
    try {
      await chargeFreeUser(userId, charge.amount, {
        transcriptionId: row.id,
        durationSec: duration,
        reason: "transcribe",
      });
      await db
        .update(transcriptions)
        .set({ creditsCharged: charge.amount, updatedAt: new Date() })
        .where(eq(transcriptions.id, row.id));
      row.creditsCharged = charge.amount;
    } catch (chargeErr) {
      logger.error(
        { err: chargeErr, userId, transcriptionId: row.id },
        "transcription charge failed after success",
      );
    }
  }

  return c.json({ transcription: publicTranscription(row) }, 201);
});

route.get("/", async (c) => {
  const userId = c.get("userId");
  const q = listTranscriptionsQuerySchema.parse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
  });

  const where = q.cursor
    ? and(eq(transcriptions.userId, userId), lt(transcriptions.createdAt, new Date(q.cursor)))
    : eq(transcriptions.userId, userId);

  const rows = await db
    .select()
    .from(transcriptions)
    .where(where)
    .orderBy(desc(transcriptions.createdAt))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null;

  return c.json({
    transcriptions: slice.map(publicTranscription),
    nextCursor,
  });
});

route.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await db.query.transcriptions.findFirst({
    where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
  });
  if (!row) throw new AppError("TRANSCRIPTION_NOT_FOUND", "Transcription not found", 404);
  return c.json({ transcription: publicTranscription(row) });
});

route.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = updateTranscriptionSchema.parse(await c.req.json());

  const existing = await db.query.transcriptions.findFirst({
    where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
  });
  if (!existing) throw new AppError("TRANSCRIPTION_NOT_FOUND", "Transcription not found", 404);

  const newOptions: TranscribeOptions = {
    ...((existing.options ?? {}) as TranscribeOptions),
  };
  if (body.speakerNames) {
    newOptions.speakerNames = { ...(newOptions.speakerNames ?? {}), ...body.speakerNames };
  }

  const newEditVersion = existing.editVersion + 1;
  const newText = body.text ?? existing.text;
  const newWords = (body.words ?? (existing.words as TranscribedWord[])) as TranscribedWord[];

  const updated = await db
    .update(transcriptions)
    .set({
      text: newText,
      words: newWords,
      options: newOptions,
      editVersion: newEditVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)))
    .returning();

  return c.json({ transcription: publicTranscription(updated[0]!) });
});

route.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.transcriptions.findFirst({
    where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
    columns: { id: true, audioKey: true, additionalFormats: true },
  });
  if (!existing) throw new AppError("TRANSCRIPTION_NOT_FOUND", "Transcription not found", 404);

  await storage.delete(existing.audioKey).catch(() => undefined);
  const formats = (existing.additionalFormats ?? {}) as TranscriptionAdditionalFormats;
  for (const entry of Object.values(formats)) {
    if (entry?.storageKey) {
      await storage.delete(entry.storageKey).catch(() => undefined);
    }
  }
  await db
    .delete(transcriptions)
    .where(and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)));
  return c.body(null, 204);
});

const CONTENT_TYPES: Record<TranscriptionExportFormat, string> = {
  txt: "text/plain; charset=utf-8",
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  json: "application/json; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html; charset=utf-8",
};

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

route.get("/:id/export", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const format = transcriptionExportFormatSchema.parse(c.req.query("format"));

  const row = await db.query.transcriptions.findFirst({
    where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
  });
  if (!row) throw new AppError("TRANSCRIPTION_NOT_FOUND", "Transcription not found", 404);

  const cached = ((row.additionalFormats ?? {}) as TranscriptionAdditionalFormats)[format];
  const cacheFresh = cached && cached.editVersion === row.editVersion;
  const baseName = row.fileName.replace(/\.[^.]+$/, "");
  const downloadName = `${baseName}.${format}`;
  const contentType = CONTENT_TYPES[format];

  if (cacheFresh) {
    if (cached.storageKey) {
      const stream = await storage.get(cached.storageKey);
      return new Response(stream, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${downloadName}"`,
        },
      });
    }
    if (typeof cached.value === "string") {
      return new Response(cached.value, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${downloadName}"`,
        },
      });
    }
  }

  const opts = (row.options ?? {}) as TranscribeOptions;
  const words = (row.words ?? []) as TranscribedWord[];

  if (!FORMATS_REQUIRING_UPSTREAM.has(format)) {
    const segments = buildSegments(words, { speakerNames: opts.speakerNames });
    let body: string;
    if (format === "txt") {
      body = renderTxt(segments);
    } else if (format === "srt") {
      body = renderSrt(segments);
    } else if (format === "vtt") {
      const srt = cached?.value && cached.editVersion === row.editVersion ? cached.value : renderSrt(segments);
      body = srtToVtt(srt);
    } else {
      body = JSON.stringify(renderSegmentedJson(segments), null, 2);
    }

    const newFormats: TranscriptionAdditionalFormats = {
      ...((row.additionalFormats ?? {}) as TranscriptionAdditionalFormats),
      [format]: { value: body, editVersion: row.editVersion },
    };
    await db
      .update(transcriptions)
      .set({ additionalFormats: newFormats, updatedAt: new Date() })
      .where(eq(transcriptions.id, row.id));

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  }

  if (format === "html") {
    const segments = buildSegments(words, { speakerNames: opts.speakerNames });
    const body = renderHtml(segments, baseName);
    const newFormats: TranscriptionAdditionalFormats = {
      ...((row.additionalFormats ?? {}) as TranscriptionAdditionalFormats),
      html: { value: body, editVersion: row.editVersion },
    };
    await db
      .update(transcriptions)
      .set({ additionalFormats: newFormats, updatedAt: new Date() })
      .where(eq(transcriptions.id, row.id));
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  }

  const audioStream = await storage.get(row.audioKey);
  const audioBuffer = await streamToBuffer(audioStream);
  const audioBlob = new Blob([audioBuffer], { type: row.mimeType });
  const upstreamFormat = (format === "pdf" ? "pdf" : "docx") as TranscriptionAdditionalFormat;

  const re = await transcribe(userId, audioBlob, {
    languageCode: opts.languageCode,
    tagAudioEvents: opts.tagAudioEvents,
    noVerbatim: opts.noVerbatim,
    diarize: opts.diarize,
    numSpeakers: opts.numSpeakers,
    keyterms: opts.keyterms,
    model: opts.model,
    additionalFormats: [upstreamFormat],
  });
  const reFmt = re.additionalFormats.find((f) => f.requestedFormat === upstreamFormat);
  if (!reFmt) throw new AppError("EXPORT_FAILED", `Upstream did not return ${format}`, 502);

  const stored = await storeAdditionalFormats(userId, row.editVersion, [reFmt]);
  const entry = stored[upstreamFormat] as StoredFormatEntry | undefined;
  const newFormats: TranscriptionAdditionalFormats = {
    ...((row.additionalFormats ?? {}) as TranscriptionAdditionalFormats),
  };
  if (entry) {
    newFormats[format] = entry;
  }
  await db
    .update(transcriptions)
    .set({ additionalFormats: newFormats, updatedAt: new Date() })
    .where(eq(transcriptions.id, row.id));

  if (entry?.storageKey) {
    const stream = await storage.get(entry.storageKey);
    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  }
  if (typeof entry?.value === "string") {
    return new Response(entry.value, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  }
  throw new AppError("EXPORT_FAILED", "Upstream format had no content", 502);
});

export default route;

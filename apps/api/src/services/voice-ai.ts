import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ExportOptions } from "@elevenlabs/elevenlabs-js/api/types/ExportOptions";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { users } from "@voicelab/db/schema";
import type { TranscribedWord } from "@voicelab/db/schema";
import { env } from "../env";
import { decryptApiKey } from "./encryption";
import { VoiceAIError } from "../lib/voice-ai-error";
import { withRetry, wrapSdkError } from "./voice-ai-retry";

export type VoiceSettings = {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1.0,
};

export type UpstreamModel = {
  modelId: string;
  name: string;
  description: string;
  canDoTextToSpeech: boolean;
  canDoVoiceConversion: boolean;
  canBeFinetuned: boolean;
  canUseStyle: boolean;
  canUseSpeakerBoost: boolean;
  servesProVoices: boolean;
  requiresAlphaAccess: boolean;
  tokenCostFactor: number;
  maxCharactersRequestFreeUser: number;
  maxCharactersRequestSubscribedUser: number;
  maximumTextLengthPerRequest: number;
  languages: Array<{ languageId: string; name: string }>;
  modelRates?: Record<string, number>;
  concurrencyGroup?: string;
};

const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
const DEFAULT_S2S_MODEL = "eleven_multilingual_sts_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const SUBSCRIPTION_CACHE_TTL_SECONDS = 60;
const MODELS_CACHE_TTL_SECONDS = 300;

type ClientFactory = (apiKey: string) => ElevenLabsClient;

export const internals = {
  clientFactory: ((apiKey: string) =>
    new ElevenLabsClient({ apiKey })) as ClientFactory,
};

export async function resolveApiKey(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tier: true, elevenlabsApiKey: true },
  });
  if (!user) throw new VoiceAIError("USER_NOT_FOUND", 404);

  if (user.tier === "free") {
    return env.ELEVENLABS_DEMO_API_KEY;
  }
  if (!user.elevenlabsApiKey) {
    throw new VoiceAIError("NO_UPSTREAM_KEY", 503);
  }
  return decryptApiKey(user.elevenlabsApiKey);
}

export async function getClientForUser(userId: string): Promise<ElevenLabsClient> {
  const apiKey = await resolveApiKey(userId);
  return internals.clientFactory(apiKey);
}

export async function listModels(userId: string): Promise<UpstreamModel[]> {
  const cacheKey = `models:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as UpstreamModel[];

  const client = await getClientForUser(userId);
  try {
    const models = (await client.models.list()) as unknown as UpstreamModel[];
    await redis.set(cacheKey, JSON.stringify(models), "EX", MODELS_CACHE_TTL_SECONDS);
    return models;
  } catch (e) {
    wrapSdkError(e);
  }
}

export async function cloneVoice(
  userId: string,
  label: string,
  files: Blob[],
  kind: "ivc" | "pvc",
  description?: string,
): Promise<{ voiceId: string }> {
  const client = await getClientForUser(userId);
  try {
    if (kind === "ivc") {
      const voice = await client.voices.ivc.create({
        name: label,
        files,
        description: description ?? `${label} (Quick Clone)`,
      });
      return { voiceId: voice.voiceId };
    }
    const voice = await client.voices.pvc.create({
      name: label,
      language: "en",
      description: description ?? `${label} (Studio Clone)`,
    });
    return { voiceId: voice.voiceId };
  } catch (e) {
    wrapSdkError(e);
  }
}

export async function generateSpeech(
  userId: string,
  voiceId: string,
  text: string,
  opts: { modelId?: string; settings?: VoiceSettings; outputFormat?: string } = {},
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);
  const modelId = opts.modelId ?? DEFAULT_TTS_MODEL;
  const settings = { ...DEFAULT_VOICE_SETTINGS, ...opts.settings };
  const outputFormat = opts.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  return withRetry(async () => {
    try {
      const { data, rawResponse } = await client.textToSpeech
        .convert(voiceId, {
          text,
          modelId,
          voiceSettings: settings,
          outputFormat: outputFormat as Parameters<typeof client.textToSpeech.convert>[1]["outputFormat"],
        })
        .withRawResponse();
      const characterCount =
        Number(rawResponse.headers?.get("x-character-count") ?? text.length) ||
        text.length;
      if (!data) throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
      return { audio: data as unknown as ReadableStream, characterCount };
    } catch (e) {
      wrapSdkError(e);
    }
  });
}

export async function speechToSpeech(
  userId: string,
  voiceId: string,
  audio: Blob,
  opts: { modelId?: string; settings?: VoiceSettings; outputFormat?: string } = {},
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);
  const modelId = opts.modelId ?? DEFAULT_S2S_MODEL;
  const settings = { ...DEFAULT_VOICE_SETTINGS, ...opts.settings };
  const outputFormat = opts.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  return withRetry(async () => {
    try {
      const { data, rawResponse } = await client.speechToSpeech
        .convert(voiceId, {
          audio,
          modelId,
          voiceSettings: JSON.stringify(settings),
          outputFormat: outputFormat as Parameters<typeof client.speechToSpeech.convert>[1]["outputFormat"],
        })
        .withRawResponse();
      const characterCount = Number(rawResponse.headers?.get("x-character-count") ?? 0);
      if (!data) throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
      return { audio: data as unknown as ReadableStream, characterCount };
    } catch (e) {
      wrapSdkError(e);
    }
  });
}

export interface TranscribeOpts {
  languageCode?: string;
  tagAudioEvents?: boolean;
  noVerbatim?: boolean;
  keyterms?: string[];
  diarize?: boolean;
  numSpeakers?: number;
  includeSubtitles?: boolean;
  model?: "scribe_v1" | "scribe_v2";
  additionalFormats?: ReadonlyArray<TranscriptionAdditionalFormat>;
}

export type TranscriptionAdditionalFormat = "txt" | "srt" | "segmented_json" | "docx" | "pdf" | "html";

export interface TranscriptionAdditionalFormatResult {
  requestedFormat: TranscriptionAdditionalFormat | string;
  fileExtension: string;
  contentType: string;
  isBase64Encoded: boolean;
  content: string;
}

export interface TranscribeResult {
  languageCode: string;
  languageProbability: number;
  text: string;
  words: TranscribedWord[];
  audioDurationSecs: number;
  additionalFormats: TranscriptionAdditionalFormatResult[];
}

const DEFAULT_TRANSCRIBE_MODEL: "scribe_v1" | "scribe_v2" = "scribe_v2";
const ALWAYS_REQUESTED_FORMATS: ReadonlyArray<TranscriptionAdditionalFormat> = ["txt", "segmented_json"];

function buildExportOptions(formats: ReadonlyArray<TranscriptionAdditionalFormat>): ExportOptions[] {
  const unique = Array.from(new Set(formats));
  return unique.map((format) => ({ format }) as ExportOptions);
}

export async function transcribe(
  userId: string,
  audio: Blob,
  opts: TranscribeOpts = {},
): Promise<TranscribeResult> {
  const client = await getClientForUser(userId);
  const model = opts.model ?? DEFAULT_TRANSCRIBE_MODEL;
  const requested: TranscriptionAdditionalFormat[] = [...(opts.additionalFormats ?? [])];

  // Upstream constraint (as of 2026-05): requesting `additional_formats` requires
  // `diarize=true`. Force it on when the caller wants upstream-rendered exports
  // (PDF/DOCX/HTML). Otherwise honor the user's diarize toggle.
  const diarize = requested.length > 0 ? true : opts.diarize ?? false;

  return withRetry(async () => {
    try {
      const result = await client.speechToText.convert({
        file: audio,
        modelId: model,
        languageCode: opts.languageCode,
        tagAudioEvents: opts.tagAudioEvents ?? false,
        noVerbatim: opts.noVerbatim ?? false,
        diarize,
        numSpeakers: opts.numSpeakers,
        keyterms: opts.keyterms && opts.keyterms.length > 0 ? opts.keyterms : undefined,
        timestampsGranularity: "word",
        ...(requested.length > 0
          ? { additionalFormats: buildExportOptions(requested) }
          : {}),
      });

      if (!result || !("text" in result) || !("words" in result)) {
        throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
      }

      const rawWords = (result.words ?? []) as Array<{
        text: string;
        start?: number;
        end?: number;
        type: string;
        speakerId?: string;
        logprob?: number;
      }>;
      const words: TranscribedWord[] = rawWords.map((w) => ({
        text: w.text,
        start: typeof w.start === "number" ? w.start : 0,
        end: typeof w.end === "number" ? w.end : 0,
        type: (w.type as TranscribedWord["type"]) ?? "word",
        speakerId: w.speakerId,
        logprob: w.logprob,
      }));

      const additionalFormats: TranscriptionAdditionalFormatResult[] = (
        (result as { additionalFormats?: Array<TranscriptionAdditionalFormatResult | undefined> })
          .additionalFormats ?? []
      ).filter((f): f is TranscriptionAdditionalFormatResult => Boolean(f));

      const audioDurationSecs = (() => {
        if (words.length === 0) return 0;
        const last = words[words.length - 1]!;
        return Math.max(last.end ?? 0, 0);
      })();

      return {
        languageCode: (result as { languageCode?: string }).languageCode ?? opts.languageCode ?? "und",
        languageProbability:
          typeof (result as { languageProbability?: number }).languageProbability === "number"
            ? (result as { languageProbability: number }).languageProbability
            : 0,
        text: (result as { text: string }).text,
        words,
        audioDurationSecs:
          typeof (result as { audioDurationSecs?: number }).audioDurationSecs === "number"
            ? (result as { audioDurationSecs: number }).audioDurationSecs
            : audioDurationSecs,
        additionalFormats,
      };
    } catch (e) {
      wrapSdkError(e);
    }
  });
}

export async function fetchAdditionalFormat(
  userId: string,
  audio: Blob,
  format: TranscriptionAdditionalFormat,
  opts: Pick<TranscribeOpts, "languageCode" | "tagAudioEvents" | "noVerbatim" | "keyterms" | "diarize" | "numSpeakers" | "model"> = {},
): Promise<TranscriptionAdditionalFormatResult | null> {
  const result = await transcribe(userId, audio, {
    ...opts,
    includeSubtitles: format === "srt" ? true : false,
    additionalFormats: [format],
  });
  return result.additionalFormats.find((f) => f.requestedFormat === format) ?? null;
}

export async function deleteVoice(userId: string, voiceId: string): Promise<void> {
  const client = await getClientForUser(userId);
  try {
    await client.voices.delete(voiceId);
  } catch (e) {
    wrapSdkError(e);
  }
}

export type UpstreamSubscription = {
  tier: string;
  characterCount: number;
  characterLimit: number;
  voiceLimit: number;
  voiceUsed?: number;
  canExtendCharacterLimit?: boolean;
  nextCharacterCountResetUnix?: number;
  [key: string]: unknown;
};

function subscriptionCacheKey(userId: string): string {
  return `subscription:${userId}`;
}

export async function getSubscriptionForUser(
  userId: string,
): Promise<UpstreamSubscription> {
  const key = subscriptionCacheKey(userId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as UpstreamSubscription;

  const client = await getClientForUser(userId);
  try {
    const sub = (await client.user.subscription.get()) as unknown as UpstreamSubscription;
    await redis.set(key, JSON.stringify(sub), "EX", SUBSCRIPTION_CACHE_TTL_SECONDS);
    return sub;
  } catch (e) {
    wrapSdkError(e);
  }
}

export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  await redis.del(subscriptionCacheKey(userId));
}

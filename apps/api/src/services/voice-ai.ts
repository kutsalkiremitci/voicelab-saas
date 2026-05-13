import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { users } from "@voicelab/db/schema";
import { env } from "../env";
import { decryptApiKey } from "./encryption";
import { VoiceAIError } from "../lib/voice-ai-error";
import { withRetry, wrapSdkError } from "./voice-ai-retry";

export type VoiceSettings = {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};

const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
const DEFAULT_S2S_MODEL = "eleven_multilingual_sts_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const SUBSCRIPTION_CACHE_TTL_SECONDS = 60;

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
  settings: VoiceSettings = DEFAULT_VOICE_SETTINGS,
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);
  return withRetry(async () => {
    try {
      const { data, rawResponse } = await client.textToSpeech
        .convert(voiceId, {
          text,
          modelId: DEFAULT_TTS_MODEL,
          voiceSettings: settings,
          outputFormat: DEFAULT_OUTPUT_FORMAT,
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
  settings: VoiceSettings = DEFAULT_VOICE_SETTINGS,
): Promise<{ audio: ReadableStream; characterCount: number }> {
  const client = await getClientForUser(userId);
  return withRetry(async () => {
    try {
      const { data, rawResponse } = await client.speechToSpeech
        .convert(voiceId, {
          audio,
          modelId: DEFAULT_S2S_MODEL,
          voiceSettings: JSON.stringify(settings),
          outputFormat: DEFAULT_OUTPUT_FORMAT,
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

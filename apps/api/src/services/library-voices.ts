import { redis } from "../lib/redis";
import { env } from "../env";
import { internals } from "./voice-ai";

const CACHE_TTL = 300;
const PAGE_SIZE = 20;

export type LibraryVoiceRow = {
  voiceId: string;
  name: string;
  description: string | null;
  gender: string;
  age: string;
  accent: string;
  category: string;
  useCase: string;
  previewUrl: string | null;
  language: string | null;
};

export type ListFilters = {
  gender?: string;
  accent?: string;
  language?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type LibraryPage = {
  voices: LibraryVoiceRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number | null;
};

function cacheKey(filters: ListFilters): string {
  const { page = 0, pageSize = PAGE_SIZE, ...rest } = filters;
  return `library:v2:${page}:${pageSize}:${JSON.stringify(rest)}`;
}

type UpstreamSharedVoice = {
  voiceId: string;
  name: string;
  description?: string;
  gender: string;
  age: string;
  accent: string;
  descriptive: string;
  useCase: string;
  category: string;
  language?: string;
  previewUrl?: string;
};

function toRow(v: UpstreamSharedVoice): LibraryVoiceRow {
  return {
    voiceId: v.voiceId,
    name: v.name,
    description: v.description ?? null,
    gender: v.gender,
    age: v.age,
    accent: v.accent,
    category: v.category,
    useCase: v.useCase,
    previewUrl: v.previewUrl ?? null,
    language: v.language ?? null,
  };
}

export async function listLibraryVoices(filters: ListFilters = {}): Promise<LibraryPage> {
  const key = cacheKey(filters);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as LibraryPage;

  const page = filters.page ?? 0;
  const pageSize = Math.min(filters.pageSize ?? PAGE_SIZE, 100);

  const client = internals.clientFactory(env.ELEVENLABS_DEMO_API_KEY);
  const result = await client.voices.getShared({
    page,
    pageSize,
    gender: filters.gender,
    accent: filters.accent,
    language: filters.language,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    category: filters.category as any,
    search: filters.search,
  });

  const data: LibraryPage = {
    voices: (result.voices as unknown as UpstreamSharedVoice[]).map(toRow),
    page,
    pageSize,
    hasMore: result.hasMore,
    totalCount: result.totalCount ?? null,
  };

  await redis.set(key, JSON.stringify(data), "EX", CACHE_TTL);
  return data;
}

export async function getLibraryVoiceById(voiceId: string): Promise<LibraryVoiceRow | null> {
  const cacheKey = `library:v2:voice:${voiceId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as LibraryVoiceRow;

  const client = internals.clientFactory(env.ELEVENLABS_DEMO_API_KEY);
  try {
    const voice = await client.voices.get(voiceId);
    const row: LibraryVoiceRow = {
      voiceId: voice.voiceId ?? voiceId,
      name: voice.name ?? "",
      description: voice.description ?? null,
      gender: (voice.labels?.["gender"] as string | undefined) ?? "",
      age: (voice.labels?.["age"] as string | undefined) ?? "",
      accent: (voice.labels?.["accent"] as string | undefined) ?? "",
      category: voice.category ?? "",
      useCase: (voice.labels?.["use_case"] as string | undefined) ?? "",
      previewUrl: voice.previewUrl ?? null,
      language: (voice.labels?.["language"] as string | undefined) ?? null,
    };
    await redis.set(cacheKey, JSON.stringify(row), "EX", CACHE_TTL);
    return row;
  } catch {
    return null;
  }
}

export async function invalidateLibraryCache(): Promise<void> {
  const keys = await redis.keys("library:v2:*");
  if (keys.length > 0) await redis.del(...keys);
}

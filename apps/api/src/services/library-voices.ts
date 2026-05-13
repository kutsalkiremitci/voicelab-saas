import { ilike, and, eq, asc } from "drizzle-orm";
import { db } from "../lib/db";
import { redis } from "../lib/redis";
import { libraryVoices } from "@voicelab/db/schema";
import { env } from "../env";
import { internals } from "./voice-ai";

const CACHE_KEY = "library:voices";
const CACHE_TTL = 300;

export type LibraryVoiceRow = {
  id: string;
  upstreamVoiceId: string;
  name: string;
  description: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  category: string | null;
  previewUrl: string | null;
  language: string | null;
  sortOrder: number;
};

export type ListFilters = {
  gender?: string;
  accent?: string;
  language?: string;
  category?: string;
  search?: string;
};

export async function listLibraryVoices(filters: ListFilters = {}): Promise<LibraryVoiceRow[]> {
  const cacheKey = `${CACHE_KEY}:${JSON.stringify(filters)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as LibraryVoiceRow[];

  const conditions = [eq(libraryVoices.isActive, 1)];

  if (filters.gender) conditions.push(eq(libraryVoices.gender, filters.gender));
  if (filters.accent) conditions.push(eq(libraryVoices.accent, filters.accent));
  if (filters.language) conditions.push(eq(libraryVoices.language, filters.language));
  if (filters.category) conditions.push(eq(libraryVoices.category, filters.category));
  if (filters.search) {
    conditions.push(ilike(libraryVoices.name, `%${filters.search}%`));
  }

  const rows = await db
    .select()
    .from(libraryVoices)
    .where(and(...conditions))
    .orderBy(asc(libraryVoices.sortOrder), asc(libraryVoices.name));

  const result: LibraryVoiceRow[] = rows.map((r) => ({
    id: r.id,
    upstreamVoiceId: r.upstreamVoiceId,
    name: r.name,
    description: r.description,
    gender: r.gender,
    age: r.age,
    accent: r.accent,
    category: r.category,
    previewUrl: r.previewUrl,
    language: r.language,
    sortOrder: r.sortOrder,
  }));

  await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
  return result;
}

export async function getLibraryVoice(id: string): Promise<LibraryVoiceRow | null> {
  const row = await db.query.libraryVoices.findFirst({
    where: and(eq(libraryVoices.id, id), eq(libraryVoices.isActive, 1)),
  });
  if (!row) return null;
  return {
    id: row.id,
    upstreamVoiceId: row.upstreamVoiceId,
    name: row.name,
    description: row.description,
    gender: row.gender,
    age: row.age,
    accent: row.accent,
    category: row.category,
    previewUrl: row.previewUrl,
    language: row.language,
    sortOrder: row.sortOrder,
  };
}

type SharedVoice = {
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  category?: string;
};

export async function syncFromUpstream(): Promise<{ upserted: number }> {
  const client = internals.clientFactory(env.ELEVENLABS_DEMO_API_KEY);
  const result = await (client.voices as unknown as {
    getShared: (opts: unknown) => Promise<{ voices: SharedVoice[] }>;
  }).getShared({ page_size: 500, featured: true });

  const voices = result.voices ?? [];
  if (voices.length === 0) return { upserted: 0 };

  let upserted = 0;
  for (let i = 0; i < voices.length; i++) {
    const v = voices[i]!;
    await db
      .insert(libraryVoices)
      .values({
        upstreamVoiceId: v.voice_id,
        name: v.name,
        description: v.description ?? null,
        gender: v.labels?.gender ?? null,
        age: v.labels?.age ?? null,
        accent: v.labels?.accent ?? null,
        category: v.category ?? v.labels?.use_case ?? null,
        previewUrl: v.preview_url ?? null,
        language: v.labels?.language ?? null,
        isActive: 1,
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: libraryVoices.upstreamVoiceId,
        set: {
          name: v.name,
          description: v.description ?? null,
          gender: v.labels?.gender ?? null,
          age: v.labels?.age ?? null,
          accent: v.labels?.accent ?? null,
          category: v.category ?? v.labels?.use_case ?? null,
          previewUrl: v.preview_url ?? null,
          language: v.labels?.language ?? null,
          isActive: 1,
          sortOrder: i,
          updatedAt: new Date(),
        },
      });
    upserted++;
  }

  await invalidateLibraryCache();
  return { upserted };
}

export async function invalidateLibraryCache(): Promise<void> {
  const keys = await redis.keys(`${CACHE_KEY}:*`);
  if (keys.length > 0) await redis.del(...keys);
}

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, credits, transcriptions } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";
import { encryptApiKey } from "../../src/services/encryption";
import { storage } from "../../src/services/storage";
import { internals as voiceAIInternals } from "../../src/services/voice-ai";
import { mockElevenLabsClient, type MockClient } from "../mocks/voice-ai";

const original = voiceAIInternals.clientFactory;
const cleanup: { userId: string; sid: string }[] = [];

function minimalWav(): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([36, 0, 0, 0]),
    Buffer.from("WAVE"),
    Buffer.from("fmt "),
    Buffer.from([16, 0, 0, 0]),
    Buffer.from([1, 0]),
    Buffer.from([1, 0]),
    Buffer.from([0x44, 0xac, 0, 0]),
    Buffer.from([0x88, 0x58, 0x01, 0]),
    Buffer.from([2, 0]),
    Buffer.from([16, 0]),
    Buffer.from("data"),
    Buffer.from([0, 0, 0, 0]),
  ]);
}

async function makeUser(opts: {
  tier: "free" | "basic" | "pro" | "enterprise";
  balance?: number;
}): Promise<{ userId: string; sid: string }> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`,
      password,
      status: "active",
      tier: opts.tier,
      elevenlabsApiKey: opts.tier === "free" ? null : encryptApiKey(`sk_${opts.tier}_test`),
    })
    .returning({ id: users.id });
  const userId = u!.id;
  const sid = await createSession(userId);
  if (opts.tier === "free" && opts.balance !== undefined) {
    await db.insert(credits).values({ userId, balance: opts.balance });
  }
  const entry = { userId, sid };
  cleanup.push(entry);
  return entry;
}

let mockClient: MockClient;

beforeEach(async () => {
  mockClient = mockElevenLabsClient();
  voiceAIInternals.clientFactory = (() => mockClient) as unknown as typeof original;
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
});

afterEach(async () => {
  voiceAIInternals.clientFactory = original;
  for (const e of cleanup) {
    const rows = await db.query.transcriptions.findMany({
      where: eq(transcriptions.userId, e.userId),
      columns: { audioKey: true, additionalFormats: true },
    });
    for (const r of rows) {
      await storage.delete(r.audioKey).catch(() => undefined);
      const fmts = r.additionalFormats as Record<string, { storageKey?: string }> | null;
      if (fmts) {
        for (const v of Object.values(fmts)) {
          if (v?.storageKey) await storage.delete(v.storageKey).catch(() => undefined);
        }
      }
    }
    await db.delete(transcriptions).where(eq(transcriptions.userId, e.userId));
    await db.delete(credits).where(eq(credits.userId, e.userId));
    await redis.del(`session:${e.sid}`);
    await db.delete(users).where(eq(users.id, e.userId));
  }
  cleanup.length = 0;
});

function buildForm(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("file", new Blob([minimalWav()], { type: "audio/wav" }), "voice.wav");
  for (const [k, v] of Object.entries(extra)) {
    fd.append(k, v);
  }
  return fd;
}

describe("POST /transcriptions (transcribe)", () => {
  test("Free user with credits: 201, credits decremented by per-minute charge", async () => {
    const { sid, userId } = await makeUser({ tier: "free", balance: 1000 });
    const res = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2", tagAudioEvents: "false" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      transcription: {
        id: string;
        text: string;
        durationSec: number;
        creditsCharged: number | null;
        words: unknown[];
        editVersion: number;
      };
    };
    expect(body.transcription.text).toBe("Mock transcription output.");
    expect(body.transcription.editVersion).toBe(0);
    expect(body.transcription.creditsCharged).toBe(2);
    expect(body.transcription.words.length).toBeGreaterThan(0);

    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, userId) });
    expect(credit?.balance).toBe(998);
  });

  test("Free user with insufficient credits: 402 INSUFFICIENT_CREDITS", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 0 });
    const res = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "120" }),
    });
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: { code: string; details: { deficit: number } } };
    expect(body.error.code).toBe("INSUFFICIENT_CREDITS");
    expect(body.error.details.deficit).toBeGreaterThan(0);
  });

  test("Basic user: 201 with no credits row", async () => {
    const { sid, userId } = await makeUser({ tier: "basic" });
    const res = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm(),
    });
    expect(res.status).toBe(201);
    const credit = await db.query.credits.findFirst({ where: eq(credits.userId, userId) });
    expect(credit).toBeUndefined();
  });

  test("includeSubtitles preference is persisted in options", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const res = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ includeSubtitles: "true", durationSec: "2" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { transcription: { id: string } };
    const row = await db.query.transcriptions.findFirst({
      where: eq(transcriptions.id, body.transcription.id),
    });
    const opts = (row?.options ?? {}) as { includeSubtitles?: boolean };
    expect(opts.includeSubtitles).toBe(true);
  });
});

describe("GET /transcriptions list + detail", () => {
  test("List filters by owner; detail returns single row", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { transcription: { id: string } };

    const list = await app.request("/api/v1/transcriptions", {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(list.status).toBe(200);
    const lb = (await list.json()) as { transcriptions: Array<{ id: string }> };
    expect(lb.transcriptions.some((t) => t.id === created.transcription.id)).toBe(true);

    const detail = await app.request(`/api/v1/transcriptions/${created.transcription.id}`, {
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(detail.status).toBe(200);
  });
});

describe("PATCH /transcriptions/:id (edit)", () => {
  test("text edit bumps editVersion + marks edited", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    const created = (await create.json()) as { transcription: { id: string; editVersion: number } };
    expect(created.transcription.editVersion).toBe(0);

    const patch = await app.request(`/api/v1/transcriptions/${created.transcription.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ text: "Edited transcript." }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      transcription: { text: string; textOriginal: string; editVersion: number; edited: boolean };
    };
    expect(patched.transcription.text).toBe("Edited transcript.");
    expect(patched.transcription.textOriginal).toBe("Mock transcription output.");
    expect(patched.transcription.editVersion).toBe(1);
    expect(patched.transcription.edited).toBe(true);
  });

  test("speakerNames merges into options", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    const created = (await create.json()) as { transcription: { id: string } };
    const patch = await app.request(`/api/v1/transcriptions/${created.transcription.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `voicelab_session=${sid}` },
      body: JSON.stringify({ speakerNames: { speaker_0: "Alice" } }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      transcription: { options: { speakerNames?: Record<string, string> } };
    };
    expect(patched.transcription.options.speakerNames?.speaker_0).toBe("Alice");
  });
});

describe("GET /transcriptions/:id/export", () => {
  test("txt export rebuilds server-side and downloads with filename", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    const created = (await create.json()) as { transcription: { id: string } };
    const res = await app.request(
      `/api/v1/transcriptions/${created.transcription.id}/export?format=txt`,
      { headers: { Cookie: `voicelab_session=${sid}` } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain(".txt");
    const text = await res.text();
    expect(text).toContain("Mock transcription output");
  });

  test("pdf export pulls from upstream and counts as separate upstream call", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { transcription: { id: string } };
    const initialCalls = mockClient.speechToText.convert.mock.calls.length;

    const res = await app.request(
      `/api/v1/transcriptions/${created.transcription.id}/export?format=pdf`,
      { headers: { Cookie: `voicelab_session=${sid}` } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(mockClient.speechToText.convert.mock.calls.length).toBe(initialCalls + 1);

    const repeat = await app.request(
      `/api/v1/transcriptions/${created.transcription.id}/export?format=pdf`,
      { headers: { Cookie: `voicelab_session=${sid}` } },
    );
    expect(repeat.status).toBe(200);
    expect(mockClient.speechToText.convert.mock.calls.length).toBe(initialCalls + 1);
  });
});

describe("DELETE /transcriptions/:id", () => {
  test("removes row + storage", async () => {
    const { sid } = await makeUser({ tier: "free", balance: 1000 });
    const create = await app.request("/api/v1/transcriptions", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${sid}` },
      body: buildForm({ durationSec: "2" }),
    });
    const created = (await create.json()) as { transcription: { id: string } };

    const del = await app.request(`/api/v1/transcriptions/${created.transcription.id}`, {
      method: "DELETE",
      headers: { Cookie: `voicelab_session=${sid}` },
    });
    expect(del.status).toBe(204);

    const after = await db.query.transcriptions.findFirst({
      where: eq(transcriptions.id, created.transcription.id),
    });
    expect(after).toBeUndefined();
  });
});

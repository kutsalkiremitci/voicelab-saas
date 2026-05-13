import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { app } from "../../src/index";
import { db } from "../../src/lib/db";
import { redis } from "../../src/lib/redis";
import { users, recordings } from "@voicelab/db/schema";
import { createSession } from "../../src/services/session";

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

let ownerId = "";
let strangerId = "";
let ownerSid = "";
let strangerSid = "";

async function makeUser(email: string): Promise<string> {
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({ email, password, status: "active", tier: "free" })
    .returning({ id: users.id });
  return u!.id;
}

beforeAll(async () => {
  ownerId = await makeUser(`rec-owner-${Date.now()}@voicelab.local`);
  strangerId = await makeUser(`rec-stranger-${Date.now()}@voicelab.local`);
  ownerSid = await createSession(ownerId);
  strangerSid = await createSession(strangerId);
});

afterAll(async () => {
  await db.delete(recordings).where(eq(recordings.userId, ownerId));
  await db.delete(recordings).where(eq(recordings.userId, strangerId));
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, strangerId));
  await redis.del(`session:${ownerSid}`, `session:${strangerSid}`);
});

function uploadForm(name = "test rec", durationSec = 1.5): FormData {
  const fd = new FormData();
  fd.append("audio", new Blob([minimalWav()], { type: "audio/wav" }), "rec.wav");
  fd.append("name", name);
  fd.append("duration", String(durationSec));
  return fd;
}

describe("recordings CRUD", () => {
  let createdId = "";

  test("POST /recordings → 201 with public payload", async () => {
    const res = await app.request("/api/v1/recordings", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${ownerSid}` },
      body: uploadForm("first take", 2.5),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      recording: {
        id: string;
        name: string;
        durationSec: number;
        sizeBytes: number;
        url: string;
      };
    };
    expect(body.recording.name).toBe("first take");
    expect(body.recording.durationSec).toBeCloseTo(2.5);
    expect(body.recording.sizeBytes).toBeGreaterThan(0);
    expect(body.recording.url).toBe(`/api/v1/files/recordings/${body.recording.id}`);
    createdId = body.recording.id;
  });

  test("GET /recordings lists owner's records", async () => {
    const res = await app.request("/api/v1/recordings", {
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recordings: Array<{ id: string }> };
    expect(body.recordings.some((r) => r.id === createdId)).toBe(true);
  });

  test("GET /recordings/:id (owner) → 200", async () => {
    const res = await app.request(`/api/v1/recordings/${createdId}`, {
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(res.status).toBe(200);
  });

  test("GET /recordings/:id (stranger) → 404", async () => {
    const res = await app.request(`/api/v1/recordings/${createdId}`, {
      headers: { Cookie: `voicelab_session=${strangerSid}` },
    });
    expect(res.status).toBe(404);
  });

  test("PUT /recordings/:id renames", async () => {
    const res = await app.request(`/api/v1/recordings/${createdId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `voicelab_session=${ownerSid}`,
      },
      body: JSON.stringify({ name: "renamed take" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recording: { name: string } };
    expect(body.recording.name).toBe("renamed take");
  });

  test("POST /recordings rejects non-audio buffer", async () => {
    const fd = new FormData();
    fd.append("audio", new Blob([Buffer.from("plain text not audio at all padding bytes")], { type: "audio/wav" }), "fake.wav");
    fd.append("name", "fake");
    fd.append("duration", "1");
    const res = await app.request("/api/v1/recordings", {
      method: "POST",
      headers: { Cookie: `voicelab_session=${ownerSid}` },
      body: fd,
    });
    expect(res.status).toBe(400);
  });

  test("POST /recordings/:id/re-record swaps storage + duration", async () => {
    const res = await app.request(`/api/v1/recordings/${createdId}/re-record`, {
      method: "POST",
      headers: { Cookie: `voicelab_session=${ownerSid}` },
      body: uploadForm("renamed take", 4.25),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recording: { durationSec: number } };
    expect(body.recording.durationSec).toBeCloseTo(4.25);
  });

  test("DELETE /recordings/:id (owner) → 204", async () => {
    const res = await app.request(`/api/v1/recordings/${createdId}`, {
      method: "DELETE",
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(res.status).toBe(204);

    const after = await app.request(`/api/v1/recordings/${createdId}`, {
      headers: { Cookie: `voicelab_session=${ownerSid}` },
    });
    expect(after.status).toBe(404);
  });

  test("401 without session", async () => {
    const res = await app.request("/api/v1/recordings");
    expect(res.status).toBe(401);
  });
});

import { describe, expect, test, afterEach } from "bun:test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../src/lib/db";
import { users } from "@voicelab/db/schema";
import { resolveApiKey } from "../../src/services/voice-ai";
import { encryptApiKey } from "../../src/services/encryption";
import { env } from "../../src/env";
import { VoiceAIError } from "../../src/lib/voice-ai-error";

const created: string[] = [];

async function makeUser(opts: {
  tier: "free" | "basic" | "pro" | "enterprise";
  apiKey?: string | null;
}): Promise<string> {
  const email = `vai-key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@voicelab.local`;
  const password = await bcrypt.hash("x", 4);
  const [u] = await db
    .insert(users)
    .values({
      email,
      password,
      status: "active",
      tier: opts.tier,
      elevenlabsApiKey: opts.apiKey ?? null,
    })
    .returning({ id: users.id });
  const id = u!.id;
  created.push(id);
  return id;
}

afterEach(async () => {
  for (const id of created) {
    await db.delete(users).where(eq(users.id, id));
  }
  created.length = 0;
});

describe("resolveApiKey", () => {
  test("Free tier returns the demo key", async () => {
    const id = await makeUser({ tier: "free" });
    const key = await resolveApiKey(id);
    expect(key).toBe(env.ELEVENLABS_DEMO_API_KEY);
  });

  test("Paid tier with stored key returns the decrypted key", async () => {
    const raw = "sk_paid_user_real_key_abc123";
    const enc = encryptApiKey(raw);
    const id = await makeUser({ tier: "pro", apiKey: enc });
    expect(await resolveApiKey(id)).toBe(raw);
  });

  test("Paid tier with no stored key throws NO_UPSTREAM_KEY", async () => {
    const id = await makeUser({ tier: "basic", apiKey: null });
    let caught: unknown;
    try {
      await resolveApiKey(id);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(VoiceAIError);
    expect((caught as VoiceAIError).code).toBe("NO_UPSTREAM_KEY");
    expect((caught as VoiceAIError).status).toBe(503);
  });

  test("Unknown user throws USER_NOT_FOUND", async () => {
    let caught: unknown;
    try {
      await resolveApiKey("00000000-0000-0000-0000-000000000000");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(VoiceAIError);
    expect((caught as VoiceAIError).code).toBe("USER_NOT_FOUND");
  });
});

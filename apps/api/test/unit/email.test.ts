import { describe, expect, test, beforeAll } from "bun:test";
import { emailService } from "../../src/services/email";

const MAILPIT_API = "http://localhost:8025/api/v1";

beforeAll(async () => {
  await fetch(`${MAILPIT_API}/messages`, { method: "DELETE" });
});

describe("email service (against Mailpit)", () => {
  test("sendVerification delivers to Mailpit with subject + link", async () => {
    const to = `verify-test-${Date.now()}@voicelab.local`;
    const link = "http://localhost:3000/verify?token=test-token-abc123";

    await emailService.sendVerification(to, link);

    const res = await fetch(`${MAILPIT_API}/search?query=to:${encodeURIComponent(to)}`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };
    expect(data.messages.length).toBeGreaterThanOrEqual(1);

    const msg = data.messages[0]!;
    expect(msg.Subject).toContain("Verify");
    expect(msg.To.some((t) => t.Address === to)).toBe(true);

    const detailRes = await fetch(`${MAILPIT_API}/message/${msg.ID}`);
    const detail = (await detailRes.json()) as { Text: string; HTML: string };
    expect(detail.Text).toContain(link);
    expect(detail.HTML).toContain(link);
  });
});

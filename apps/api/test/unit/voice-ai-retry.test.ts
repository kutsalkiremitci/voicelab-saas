import { describe, expect, test, mock } from "bun:test";
import { withRetry } from "../../src/services/voice-ai-retry";
import { VoiceAIError } from "../../src/lib/voice-ai-error";

const noSleep = mock(async (_: number) => undefined);

describe("withRetry", () => {
  test("succeeds on first try, fn called once", async () => {
    const fn = mock(async () => "ok");
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries soft error and eventually succeeds (3rd try)", async () => {
    let calls = 0;
    const fn = mock(async () => {
      calls++;
      if (calls < 3) throw new VoiceAIError("UPSTREAM_ERROR", 500);
      return "ok-3";
    });
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe("ok-3");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("does NOT retry on UPSTREAM_AUTH_FAILED (401)", async () => {
    const err = new VoiceAIError("UPSTREAM_AUTH_FAILED", 401);
    const fn = mock(async () => {
      throw err;
    });
    let caught: unknown;
    try {
      await withRetry(fn, { sleep: noSleep });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("does NOT retry on QUOTA_EXCEEDED (402)", async () => {
    const fn = mock(async () => {
      throw new VoiceAIError("QUOTA_EXCEEDED", 402);
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBeInstanceOf(VoiceAIError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("does NOT retry on INVALID_INPUT (422)", async () => {
    const fn = mock(async () => {
      throw new VoiceAIError("INVALID_INPUT", 422);
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBeInstanceOf(VoiceAIError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("gives up after attempts and rethrows last error", async () => {
    const fn = mock(async () => {
      throw new VoiceAIError("UPSTREAM_ERROR", 500);
    });
    let caught: unknown;
    try {
      await withRetry(fn, { sleep: noSleep, attempts: 3 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(VoiceAIError);
    expect((caught as VoiceAIError).code).toBe("UPSTREAM_ERROR");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

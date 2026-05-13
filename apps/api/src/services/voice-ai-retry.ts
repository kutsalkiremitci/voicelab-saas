import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { VoiceAIError, mapStatusToCode, isHardFail } from "../lib/voice-ai-error";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (isHardFail(e)) throw e;
      if (i === attempts - 1) break;
      await sleep(baseDelay * 2 ** i);
    }
  }
  throw lastErr;
}

export function wrapSdkError(e: unknown): never {
  if (e instanceof VoiceAIError) throw e;
  if (e instanceof ElevenLabsError) {
    const status = e.statusCode ?? 500;
    throw new VoiceAIError(mapStatusToCode(status), status, e.body);
  }
  if (e instanceof Error && /fetch|network|ECONNREFUSED|timeout/i.test(e.message)) {
    throw new VoiceAIError("UPSTREAM_UNREACHABLE", 503);
  }
  throw new VoiceAIError("UNKNOWN_UPSTREAM_FAILURE", 500);
}

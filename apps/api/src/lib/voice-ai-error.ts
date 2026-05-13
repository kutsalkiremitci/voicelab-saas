export type VoiceAICode =
  | "USER_NOT_FOUND"
  | "NO_UPSTREAM_KEY"
  | "UPSTREAM_AUTH_FAILED"
  | "QUOTA_EXCEEDED"
  | "INVALID_INPUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNREACHABLE"
  | "UPSTREAM_ERROR"
  | "UNKNOWN_UPSTREAM_FAILURE";

export class VoiceAIError extends Error {
  constructor(
    public readonly code: VoiceAICode,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(code);
    this.name = "VoiceAIError";
  }
}

export function mapStatusToCode(status: number): VoiceAICode {
  if (status === 401) return "UPSTREAM_AUTH_FAILED";
  if (status === 402) return "QUOTA_EXCEEDED";
  if (status === 422) return "INVALID_INPUT";
  if (status === 429) return "UPSTREAM_RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_ERROR";
  return "UPSTREAM_ERROR";
}

const HARD_FAIL_CODES: ReadonlySet<VoiceAICode> = new Set([
  "UPSTREAM_AUTH_FAILED",
  "QUOTA_EXCEEDED",
  "INVALID_INPUT",
  "USER_NOT_FOUND",
  "NO_UPSTREAM_KEY",
]);

export function isHardFail(err: unknown): boolean {
  return err instanceof VoiceAIError && HARD_FAIL_CODES.has(err.code);
}

import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { VoiceAIError } from "../lib/voice-ai-error";
import { logger } from "../lib/logger";

const VOICE_AI_CODE_TO_USER_MESSAGE: Record<string, string> = {
  USER_NOT_FOUND: "User not found.",
  NO_UPSTREAM_KEY: "Voice service not configured for this account.",
  UPSTREAM_AUTH_FAILED: "Voice service authentication failed.",
  QUOTA_EXCEEDED: "Voice service quota exceeded.",
  INVALID_INPUT: "Audio rejected by the voice service.",
  UPSTREAM_RATE_LIMITED: "Voice service is rate limiting requests. Try again shortly.",
  UPSTREAM_UNREACHABLE: "Voice service is temporarily unreachable.",
  UPSTREAM_ERROR: "Voice service returned an error.",
  UNKNOWN_UPSTREAM_FAILURE: "Voice service failed to process the request.",
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as ContentfulStatusCode,
    );
  }
  if (err instanceof VoiceAIError) {
    logger.warn(
      { code: err.code, status: err.status, body: err.body },
      "voice service error",
    );
    return c.json(
      {
        error: {
          code: err.code,
          message: VOICE_AI_CODE_TO_USER_MESSAGE[err.code] ?? "Voice service error.",
        },
      },
      err.status as ContentfulStatusCode,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: err.flatten().fieldErrors,
        },
      },
      422,
    );
  }
  logger.error({ err: err.message, stack: err.stack }, "unhandled error");
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    500,
  );
};

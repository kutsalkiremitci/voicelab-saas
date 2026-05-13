import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
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

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (typeof window === "undefined") {
    console[level === "debug" ? "log" : level](`[${level}]`, msg, meta ?? "");
    return;
  }
  if (level === "error") console.error(`[${level}]`, msg, meta ?? "");
  else if (level === "warn") console.warn(`[${level}]`, msg, meta ?? "");
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};

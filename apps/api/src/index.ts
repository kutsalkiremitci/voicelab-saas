import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis";
import { sql } from "./lib/db";
import { requestLogger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import health from "./routes/health";
import auth from "./routes/auth";
import files from "./routes/files";
import creditsRoute from "./routes/credits";
import recordingsRoute from "./routes/recordings";
import voicesRoute from "./routes/voices";
import generationsRoute from "./routes/generations";
import modelsRoute from "./routes/models";
import libraryRoute from "./routes/library";
import transcriptionsRoute from "./routes/transcriptions";
import adminUsersRoute from "./routes/admin/users";
import adminMetricsRoute from "./routes/admin/metrics";
import adminAuditRoute from "./routes/admin/audit";

const app = new Hono();

app.use("*", requestLogger);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.onError(errorHandler);

app.route("/api/v1/health", health);
app.route("/api/v1/auth", auth);
app.route("/api/v1/files", files);
app.route("/api/v1/credits", creditsRoute);
app.route("/api/v1/recordings", recordingsRoute);
app.route("/api/v1/voices", voicesRoute);
app.route("/api/v1/generations", generationsRoute);
app.route("/api/v1/models", modelsRoute);
app.route("/api/v1/library", libraryRoute);
app.route("/api/v1/transcriptions", transcriptionsRoute);
app.route("/api/v1/admin/users", adminUsersRoute);
app.route("/api/v1/admin/metrics", adminMetricsRoute);
app.route("/api/v1/admin/audit", adminAuditRoute);

let server: ReturnType<typeof Bun.serve> | null = null;
let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "VoiceLab API shutting down");
  const deadline = setTimeout(() => {
    logger.warn("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 5_000);
  deadline.unref();
  try {
    if (server) server.stop(true);
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "server stop failed");
  }
  try {
    await redis.quit();
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "redis quit failed");
  }
  try {
    await sql.end({ timeout: 3 });
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "postgres end failed");
  }
  logger.info("VoiceLab API stopped");
  clearTimeout(deadline);
  process.exit(0);
}

if (import.meta.main) {
  server = Bun.serve({ port: env.PORT, fetch: app.fetch });
  logger.info({ port: env.PORT }, "VoiceLab API listening");

  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"] as const) {
    process.on(sig, () => void gracefulShutdown(sig));
  }
}

export { app };

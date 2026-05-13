import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { logger } from "./lib/logger";
import { requestLogger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";
import health from "./routes/health";

const app = new Hono();

app.use("*", requestLogger);
app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.onError(errorHandler);

app.route("/api/v1/health", health);

logger.info({ port: env.PORT }, "VoiceLab API starting");

export default {
  port: env.PORT,
  fetch: app.fetch,
};

export { app };

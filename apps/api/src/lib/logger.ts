import pino from "pino";
import { env } from "../env";

const isDev = env.NODE_ENV === "development";

export const logger = pino(
  isDev
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
        },
      }
    : { level: "info" },
);

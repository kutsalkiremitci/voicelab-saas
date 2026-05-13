import { Redis } from "ioredis";
import { env } from "../env";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

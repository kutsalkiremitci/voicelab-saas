import { Hono } from "hono";
import { createTransport } from "nodemailer";
import { redis } from "../lib/redis";
import { sql } from "../lib/db";
import { env } from "../env";

const health = new Hono();

type Status = "ok" | "down";
type HealthResponse = {
  status: Status;
  db: Status;
  redis: Status;
  smtp: Status;
};

async function checkDb(): Promise<Status> {
  try {
    await sql`SELECT 1`;
    return "ok";
  } catch {
    return "down";
  }
}

async function checkRedis(): Promise<Status> {
  try {
    const pong = await redis.ping();
    return pong === "PONG" ? "ok" : "down";
  } catch {
    return "down";
  }
}

async function checkSmtp(): Promise<Status> {
  try {
    const transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 2000,
    });
    await transport.verify();
    transport.close();
    return "ok";
  } catch {
    return "down";
  }
}

health.get("/", async (c) => {
  const [db, r, smtp] = await Promise.all([checkDb(), checkRedis(), checkSmtp()]);
  const status: Status = db === "ok" && r === "ok" && smtp === "ok" ? "ok" : "down";
  const body: HealthResponse = { status, db, redis: r, smtp };
  return c.json(body, status === "ok" ? 200 : 503);
});

export default health;

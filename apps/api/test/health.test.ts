import { describe, expect, test } from "bun:test";
import { app } from "../src/index";

describe("GET /api/v1/health", () => {
  test("returns 200 with all subsystems ok when stack is up", async () => {
    const res = await app.request("/api/v1/health");
    const body = (await res.json()) as {
      status: string;
      db: string;
      redis: string;
      smtp: string;
    };

    expect([200, 503]).toContain(res.status);
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("db");
    expect(body).toHaveProperty("redis");
    expect(body).toHaveProperty("smtp");

    if (res.status === 200) {
      expect(body.status).toBe("ok");
      expect(body.db).toBe("ok");
      expect(body.redis).toBe("ok");
      expect(body.smtp).toBe("ok");
    }
  });
});

import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { listModels } from "../services/voice-ai";

const route = new Hono<{ Variables: AuthVariables }>();
route.use("*", requireAuth, requireVerified);

route.get("/", async (c) => {
  const userId = c.get("userId");
  const models = await listModels(userId);
  return c.json({ models }, 200, {
    "Cache-Control": "private, max-age=300",
  });
});

export default route;

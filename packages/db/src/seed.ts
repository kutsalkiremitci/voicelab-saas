import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { users } from "./schema";

const seedEnv = z.object({
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),
});

async function main() {
  const env = seedEnv.parse({
    ADMIN_SEED_EMAIL: process.env.ADMIN_SEED_EMAIL,
    ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD,
  });

  const existing = await db.query.users.findFirst({
    where: eq(users.email, env.ADMIN_SEED_EMAIL),
    columns: { id: true, role: true },
  });

  if (existing) {
    console.log(`[seed] admin ${env.ADMIN_SEED_EMAIL} already exists (id=${existing.id}, role=${existing.role}); skipping.`);
    await sql.end();
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);

  const inserted = await db
    .insert(users)
    .values({
      email: env.ADMIN_SEED_EMAIL,
      password: passwordHash,
      role: "admin",
      status: "active",
      tier: "free",
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email });

  const created = inserted[0];
  if (!created) throw new Error("seed insert returned no rows");
  console.log(`[seed] created admin: id=${created.id} email=${created.email}`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});

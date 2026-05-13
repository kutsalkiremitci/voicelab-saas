import { describe, expect, test } from "bun:test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

describe("database schema", () => {
  test("all 7 tables exist", async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const names = rows.map((r) => r.table_name);
    for (const expected of [
      "admin_audit_log",
      "credits",
      "email_verifications",
      "generations",
      "recordings",
      "users",
      "voices",
    ]) {
      expect(names).toContain(expected);
    }
  });

  test("users table has key columns", async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      "id",
      "email",
      "password",
      "role",
      "status",
      "tier",
      "elevenlabs_api_key",
      "elevenlabs_plan",
      "email_verified_at",
      "activated_at",
    ]) {
      expect(cols).toContain(expected);
    }
  });

  test("credits table is keyed on user_id", async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'public.credits'::regclass AND i.indisprimary
    `;
    expect(rows.map((r) => r.column_name)).toEqual(["user_id"]);
  });

  test("voices.elevenlabs_voice_id is unique", async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'voices' AND indexname = 'voices_elevenlabs_voice_id_idx'
    `;
    expect(rows).toHaveLength(1);
  });
});

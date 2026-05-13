# Local → S3 Migration

When and how to flip the storage backend.

## When to migrate

Trigger when ANY of these is true:

- Local disk usage exceeds 50% of available space
- Multi-region deployment is planned (local FS doesn't replicate)
- The user count crosses ~100 active accounts (S3 lifecycle / versioning becomes valuable)
- Daily backup time exceeds 10 minutes

If none of these are true, stay on local. S3 has cost overhead (egress, API calls).

## Pre-migration checklist

- [ ] S3 / R2 bucket created, private
- [ ] IAM user with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` only
- [ ] Credentials stored in production secret manager
- [ ] `S3_*` env vars populated in production
- [ ] `S3Adapter` smoke-tested in staging (it should be already wired)

## Migration script

```ts
// apps/api/scripts/migrate-storage.ts
import { LocalAdapter, S3Adapter } from "../src/services/storage";
import { db } from "@voicelab/db";
import { recordings, generations } from "@voicelab/db/schema";

const local = new LocalAdapter(process.env.STORAGE_LOCAL_PATH!);
const s3 = new S3Adapter({
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
});

async function migrate(table: typeof recordings | typeof generations) {
  const rows = await db.select().from(table);
  for (const row of rows) {
    if (await s3.exists(row.storageKey)) {
      console.log("skip (already in S3):", row.storageKey);
      continue;
    }
    const stream = await local.get(row.storageKey);
    await s3.put(row.storageKey, stream, row.mimeType);
    console.log("migrated:", row.storageKey);
  }
}

await migrate(recordings);
await migrate(generations);
console.log("done");
```

Run with both adapters available (env has all S3 vars filled but `STORAGE_DRIVER=local` still).

## Cutover sequence

1. **Stop writes** to the app (maintenance mode or off-hours).
2. **Run the migration script.** Verify no errors. Spot-check 10 files in S3.
3. **Flip env**: `STORAGE_DRIVER=s3`.
4. **Restart** the API.
5. **Smoke test** via `/files/:type/:id` for several known IDs.
6. **Resume writes.** New uploads go to S3.
7. **Retire local storage** after 7 days of stable operation:
   - Take a final tarball of `./storage/` as cold backup
   - Delete the volume
   - Remove `STORAGE_LOCAL_PATH` from env

## Rollback

If S3 misbehaves within the first 7 days:

1. `STORAGE_DRIVER=local`
2. Restart
3. Local files are still intact; the app resumes
4. Any uploads that happened during S3 mode need a reverse migration

This is why we keep the local volume for 7 days after cutover.

# StorageAdapter Interface

The contract every backend implements.

## Interface

```ts
// apps/api/src/services/storage/adapter.ts
export interface StorageAdapter {
  put(
    key: string,
    data: ReadableStream | Buffer,
    contentType: string,
  ): Promise<PutResult>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  totalSize?(prefix?: string): Promise<number>;
  getSignedUrl?(key: string, expiresIn: number): Promise<string>;
}

export interface PutResult {
  key: string;
  size: number;
}
```

## Wiring

```ts
// services/storage/index.ts
import { LocalAdapter } from "./local";
import { S3Adapter } from "./s3";
import { env } from "../../env";

export const storage: StorageAdapter =
  env.STORAGE_DRIVER === "s3"
    ? new S3Adapter({
        bucket: env.S3_BUCKET!,
        region: env.S3_REGION!,
        endpoint: env.S3_ENDPOINT,
        accessKey: env.S3_ACCESS_KEY!,
        secretKey: env.S3_SECRET_KEY!,
      })
    : new LocalAdapter(env.STORAGE_LOCAL_PATH);
```

## Key naming (immutable)

```
audio/{userId}/{kind}/{uuid}.{ext}

examples:
audio/3f7c.../recordings/a91e....webm
audio/3f7c.../generations/b22f....mp3
```

- `kind`: `recordings | generations`
- `ext`: `webm | mp3 | wav | ogg`

## Upload validation

Run in this order:

```ts
import { fileTypeFromBuffer } from "file-type";

const buf = Buffer.from(await file.arrayBuffer());

// 1. content-type whitelist
if (!ALLOWED_AUDIO_MIMES.includes(file.type)) {
  throw new AppError("INVALID_FILE", "Invalid content type", 400);
}

// 2. size cap
if (buf.length > 25 * 1024 * 1024) {
  throw new AppError("FILE_TOO_LARGE", "Max 25 MB", 413);
}

// 3. magic-byte check
const t = await fileTypeFromBuffer(buf);
if (!t || !ALLOWED_AUDIO_MIMES.includes(t.mime)) {
  throw new AppError("INVALID_FILE", "Invalid audio file", 400);
}
```

## Serving (proxy endpoint)

```ts
// routes/files.ts
app.get("/files/:type/:id", requireAuth, async (c) => {
  const { type, id } = c.req.param();
  const userId = c.get("userId");

  const row = type === "recordings"
    ? await db.query.recordings.findFirst({
        where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
      })
    : await db.query.generations.findFirst({
        where: and(eq(generations.id, id), eq(generations.userId, userId)),
      });

  if (!row) throw new AppError("NOT_FOUND", "File not found", 404);

  const stream = await storage.get(row.storageKey);
  return new Response(stream, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.sizeBytes),
      "Accept-Ranges": "bytes",
    },
  });
});
```

Range request handling for audio seeking is in `references/local-adapter.md`.

## Limits

| Item | Value |
|------|-------|
| Max upload | 25 MB |
| Max recording duration | 5 min |
| Local FS total | bounded by disk; monitor |
| S3 / R2 | effectively unlimited |

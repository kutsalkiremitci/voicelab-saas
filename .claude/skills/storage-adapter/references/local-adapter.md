# Local Adapter

Writes to `./storage/` under the configured base path.

## Implementation

```ts
// services/storage/local.ts
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export class LocalAdapter implements StorageAdapter {
  constructor(private basePath: string) {}

  private fullPath(key: string) {
    return path.join(this.basePath, key);
  }

  async put(key: string, data: ReadableStream | Buffer, _contentType: string) {
    const full = this.fullPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await writeFile(full, data);
      return { key, size: data.length };
    }
    const write = createWriteStream(full);
    let size = 0;
    for await (const chunk of data) {
      size += chunk.length;
      write.write(chunk);
    }
    write.end();
    return { key, size };
  }

  async get(key: string) {
    return Readable.toWeb(createReadStream(this.fullPath(key))) as ReadableStream;
  }

  async delete(key: string) {
    await unlink(this.fullPath(key)).catch(() => {});
  }

  async exists(key: string) {
    return access(this.fullPath(key)).then(() => true).catch(() => false);
  }
}
```

## Gotchas

- **Path traversal:** Never accept user input directly as part of the key. Keys are generated server-side from UUIDs only.
- **Parent directory creation:** `mkdir({ recursive: true })` ensures `audio/{userId}/{kind}/` exists.
- **Permissions:** Process must have write access to `STORAGE_LOCAL_PATH`. In Docker, mount a volume there.
- **Disk monitoring:** Local FS has no built-in quota. Add disk-usage alerts in production until the S3 migration.
- **`.gitignore`:** `./storage/` is gitignored to prevent accidental commits.

## Range requests

The default Hono Response above does not honor Range. For seeking, wrap the stream:

```ts
function rangeResponse(req: Request, full: string, sizeBytes: number, mime: string) {
  const range = req.headers.get("range");
  if (!range) {
    return new Response(Bun.file(full).stream(), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(sizeBytes),
        "Accept-Ranges": "bytes",
      },
    });
  }
  const [_, startStr, endStr] = /bytes=(\d+)-(\d*)/.exec(range) || [];
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : sizeBytes - 1;
  const chunkSize = end - start + 1;
  const stream = Bun.file(full).slice(start, end + 1).stream();
  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": mime,
      "Content-Range": `bytes ${start}-${end}/${sizeBytes}`,
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunkSize),
    },
  });
}
```

import { mkdir, unlink, access, stat, writeFile, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import type { StorageAdapter, PutResult } from "./adapter";

export class LocalAdapter implements StorageAdapter {
  constructor(private readonly basePath: string) {}

  private fullPath(key: string): string {
    const safeBase = path.resolve(this.basePath);
    const resolved = path.resolve(safeBase, key);
    if (!resolved.startsWith(safeBase + path.sep) && resolved !== safeBase) {
      throw new Error(`storage: refusing path outside base (${key})`);
    }
    return resolved;
  }

  async put(
    key: string,
    data: ReadableStream | Buffer,
    _contentType: string,
  ): Promise<PutResult> {
    const full = this.fullPath(key);
    await mkdir(path.dirname(full), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await writeFile(full, data);
      return { key, size: data.length };
    }

    let size = 0;
    await new Promise<void>(async (resolve, reject) => {
      const out = createWriteStream(full);
      out.on("error", reject);
      out.on("finish", resolve);
      try {
        for await (const chunk of data as unknown as AsyncIterable<Uint8Array>) {
          size += chunk.length;
          out.write(chunk);
        }
        out.end();
      } catch (err) {
        reject(err);
      }
    });
    return { key, size };
  }

  async get(key: string): Promise<ReadableStream> {
    return Readable.toWeb(createReadStream(this.fullPath(key))) as ReadableStream;
  }

  async delete(key: string): Promise<void> {
    await unlink(this.fullPath(key)).catch(() => {});
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!prefix || prefix === "/" || prefix === ".") return;
    const target = this.fullPath(prefix);
    await rm(target, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    return access(this.fullPath(key))
      .then(() => true)
      .catch(() => false);
  }

  async sizeOf(key: string): Promise<number> {
    const s = await stat(this.fullPath(key));
    return s.size;
  }

  resolve(key: string): string {
    return this.fullPath(key);
  }
}

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { recordings, generations, transcriptions } from "@voicelab/db/schema";
import { storage } from "../services/storage";
import { LocalAdapter } from "../services/storage/local";
import { AppError } from "../lib/errors";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const files = new Hono<{ Variables: AuthVariables }>();

type FileRow = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
};

async function lookupFile(
  type: string,
  id: string,
  userId: string,
): Promise<FileRow> {
  if (type === "recordings") {
    const row = await db.query.recordings.findFirst({
      where: and(eq(recordings.id, id), eq(recordings.userId, userId)),
      columns: { storageKey: true, mimeType: true, sizeBytes: true },
    });
    if (!row) throw new AppError("FILE_NOT_FOUND", "File not found", 404);
    return row;
  }
  if (type === "generations") {
    const row = await db.query.generations.findFirst({
      where: and(eq(generations.id, id), eq(generations.userId, userId)),
      columns: { storageKey: true, mimeType: true, sizeBytes: true },
    });
    if (!row) throw new AppError("FILE_NOT_FOUND", "File not found", 404);
    return row;
  }
  if (type === "transcriptions") {
    const row = await db.query.transcriptions.findFirst({
      where: and(eq(transcriptions.id, id), eq(transcriptions.userId, userId)),
      columns: { audioKey: true, mimeType: true, fileSizeBytes: true },
    });
    if (!row) throw new AppError("FILE_NOT_FOUND", "File not found", 404);
    return { storageKey: row.audioKey, mimeType: row.mimeType, sizeBytes: row.fileSizeBytes };
  }
  throw new AppError("INVALID_TYPE", "type must be recordings, generations or transcriptions", 400);
}

function localRangeResponse(
  req: Request,
  fullPath: string,
  sizeBytes: number,
  mime: string,
): Response {
  const range = req.headers.get("range");
  if (!range) {
    return new Response(Bun.file(fullPath).stream(), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(sizeBytes),
        "Accept-Ranges": "bytes",
      },
    });
  }
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) {
    return new Response("Invalid Range", {
      status: 416,
      headers: { "Content-Range": `bytes */${sizeBytes}` },
    });
  }
  const start = Number.parseInt(m[1]!, 10);
  const end = m[2] ? Number.parseInt(m[2], 10) : sizeBytes - 1;
  if (start >= sizeBytes || end >= sizeBytes || start > end) {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${sizeBytes}` },
    });
  }
  const chunkSize = end - start + 1;
  const stream = Bun.file(fullPath).slice(start, end + 1).stream();
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

files.get("/:type/:id", requireAuth, async (c) => {
  const { type, id } = c.req.param();
  const userId = c.get("userId");
  const row = await lookupFile(type, id, userId);

  if (storage instanceof LocalAdapter) {
    return localRangeResponse(c.req.raw, storage.resolve(row.storageKey), row.sizeBytes, row.mimeType);
  }

  if (storage.getSignedUrl) {
    const url = await storage.getSignedUrl(row.storageKey, 300);
    return c.redirect(url, 302);
  }

  const stream = await storage.get(row.storageKey);
  return new Response(stream, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.sizeBytes),
      "Accept-Ranges": "bytes",
    },
  });
});

export default files;

import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../lib/errors";

export const ALLOWED_AUDIO_MIMES = [
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/opus",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
] as const;

/**
 * Browsers / OSes label the same audio container with wildly inconsistent
 * MIME types. Map every variant we've seen in the wild back to a known
 * member of ALLOWED_AUDIO_MIMES before we compare. This is conservative:
 * file-type magic-byte detection still has the final say further down.
 */
function normalizeAudioMime(raw: string): string {
  const m = raw.toLowerCase().split(";")[0]!.trim();
  if (m === "video/webm") return "audio/webm";
  if (m === "application/ogg" || m === "audio/x-ogg" || m === "audio/vorbis") return "audio/ogg";
  if (m === "audio/m4a") return "audio/x-m4a";
  if (m === "audio/x-aac") return "audio/aac";
  return m;
}

export const ALLOWED_MEDIA_MIMES = [
  ...ALLOWED_AUDIO_MIMES,
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/opus",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aac": "aac",
  "audio/opus": "opus",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export interface ValidatedAudio {
  buffer: Buffer;
  detectedMime: string;
  ext: string;
}

export async function validateAudio(input: {
  buffer: Buffer;
  declaredMime: string;
}): Promise<ValidatedAudio> {
  // The browser-declared MIME is a hint only; magic-byte detection is the
  // authority. We still do an early reject if the hint is clearly something
  // we don't accept (e.g. an image), but normalize permissively first so an
  // .ogg picked from the OS (often labelled `application/ogg`) doesn't get
  // rejected before file-type even runs.
  const declared = normalizeAudioMime(input.declaredMime);
  const declaredObviouslyWrong =
    declared.startsWith("image/") || declared.startsWith("text/") || declared === "application/pdf";
  if (declaredObviouslyWrong) {
    throw new AppError("INVALID_FILE", `Disallowed content type: ${declared}`, 400);
  }

  if (input.buffer.length === 0) {
    throw new AppError("INVALID_FILE", "Empty file", 400);
  }
  if (input.buffer.length > MAX_AUDIO_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "Max 25 MB", 413);
  }

  const detected = await fileTypeFromBuffer(input.buffer);
  if (!detected) {
    throw new AppError("INVALID_FILE", "Unrecognized binary signature", 400);
  }
  const detectedMime = normalizeAudioMime(detected.mime);
  if (!ALLOWED_AUDIO_MIMES.includes(detectedMime as (typeof ALLOWED_AUDIO_MIMES)[number])) {
    throw new AppError(
      "INVALID_FILE",
      `Magic bytes report unsupported type: ${detectedMime}`,
      400,
    );
  }

  const ext = MIME_TO_EXT[detectedMime] ?? detected.ext;
  return { buffer: input.buffer, detectedMime, ext };
}

export async function validateMedia(input: {
  buffer: Buffer;
  declaredMime: string;
  maxBytes: number;
}): Promise<ValidatedAudio> {
  if (input.buffer.length === 0) {
    throw new AppError("INVALID_FILE", "Empty file", 400);
  }
  if (input.buffer.length > input.maxBytes) {
    throw new AppError(
      "AUDIO_TOO_LARGE",
      `File too large. Max ${Math.round(input.maxBytes / (1024 * 1024))} MB`,
      413,
    );
  }
  const detected = await fileTypeFromBuffer(input.buffer);
  if (!detected) {
    throw new AppError("INVALID_AUDIO", "Unrecognized binary signature", 400);
  }
  const detectedMime = normalizeAudioMime(detected.mime);
  if (!ALLOWED_MEDIA_MIMES.includes(detectedMime as (typeof ALLOWED_MEDIA_MIMES)[number])) {
    throw new AppError("INVALID_AUDIO", `Unsupported media type: ${detectedMime}`, 400);
  }
  const ext = MIME_TO_EXT[detectedMime] ?? detected.ext;
  return { buffer: input.buffer, detectedMime, ext };
}

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
  "audio/mp4",
  "audio/x-m4a",
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
  // Browser MediaRecorder labels audio-only WebM recordings as video/webm
  const raw = input.declaredMime.toLowerCase();
  const declared = raw === "video/webm" ? "audio/webm" : raw;
  if (!ALLOWED_AUDIO_MIMES.includes(declared as (typeof ALLOWED_AUDIO_MIMES)[number])) {
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
  // file-type library reports audio-only WebM as video/webm — normalize same as declared MIME
  const detectedMime = detected.mime === "video/webm" ? "audio/webm" : detected.mime;
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

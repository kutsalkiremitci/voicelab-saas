import { z } from "zod";

export const transcribeModelSchema = z.enum(["scribe_v1", "scribe_v2"]);
export type TranscribeModel = z.infer<typeof transcribeModelSchema>;

export const keytermSchema = z
  .string()
  .min(1)
  .max(50)
  .refine((s) => s.split(/\s+/).filter(Boolean).length <= 5, "keyterm must be at most 5 words");

export const transcribeKeytermsSchema = z.array(keytermSchema).max(1000);

export const transcribeOptionsSchema = z.object({
  languageCode: z.string().min(2).max(10).optional(),
  tagAudioEvents: z.boolean().default(false),
  noVerbatim: z.boolean().default(false),
  includeSubtitles: z.boolean().default(false),
  diarize: z.boolean().default(false),
  numSpeakers: z.number().int().min(1).max(32).optional(),
  keyterms: transcribeKeytermsSchema.default([]),
  model: transcribeModelSchema.default("scribe_v2"),
});
export type TranscribeOptionsInput = z.infer<typeof transcribeOptionsSchema>;

export const transcriptionWordSchema = z.object({
  text: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  type: z.enum(["word", "spacing", "audio_event"]).default("word"),
  speakerId: z.string().optional(),
  logprob: z.number().optional(),
});
export type TranscriptionWord = z.infer<typeof transcriptionWordSchema>;

export const updateTranscriptionSchema = z
  .object({
    text: z.string().min(1).max(1_000_000).optional(),
    words: z.array(transcriptionWordSchema).max(100_000).optional(),
    speakerNames: z.record(z.string(), z.string().min(1).max(80)).optional(),
  })
  .refine(
    (v) => v.text !== undefined || v.words !== undefined || v.speakerNames !== undefined,
    "at least one of text, words, or speakerNames is required",
  );
export type UpdateTranscriptionInput = z.infer<typeof updateTranscriptionSchema>;

export const listTranscriptionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTranscriptionsQuery = z.infer<typeof listTranscriptionsQuerySchema>;

export const transcriptionExportFormatSchema = z.enum([
  "txt",
  "srt",
  "vtt",
  "json",
  "pdf",
  "docx",
  "html",
]);
export type TranscriptionExportFormat = z.infer<typeof transcriptionExportFormatSchema>;

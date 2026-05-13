import { z } from "zod";

export const voiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
});
export type VoiceSettingsInput = z.infer<typeof voiceSettingsSchema>;

export const OUTPUT_FORMATS = [
  "mp3_44100_128",
  "mp3_44100_192",
  "pcm_44100",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const generateSchema = z.object({
  text: z.string().min(1).max(10000),
  modelId: z.string().optional(),
  outputFormat: z.enum(OUTPUT_FORMATS).optional(),
  settings: voiceSettingsSchema.optional(),
});
export type GenerateInput = z.infer<typeof generateSchema>;

export const s2sBodySchema = z.object({
  modelId: z.string().optional(),
  outputFormat: z.enum(OUTPUT_FORMATS).optional(),
  settings: voiceSettingsSchema.optional(),
});
export type S2SBodyInput = z.infer<typeof s2sBodySchema>;

export const listGenerationsQuerySchema = z.object({
  voiceId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

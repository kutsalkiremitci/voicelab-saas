import { z } from "zod";

export const voiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
});
export type VoiceSettingsInput = z.infer<typeof voiceSettingsSchema>;

export const generateSchema = z.object({
  text: z.string().min(1).max(5000),
  settings: voiceSettingsSchema.optional(),
});
export type GenerateInput = z.infer<typeof generateSchema>;

export const listGenerationsQuerySchema = z.object({
  voiceId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

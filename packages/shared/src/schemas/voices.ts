import { z } from "zod";

export const voiceLabelSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[^\n\r\t]+$/, "label must be single-line");

export const createVoiceSchema = z.object({
  recordingId: z.string().uuid(),
  label: voiceLabelSchema,
  kind: z.enum(["ivc", "pvc"]),
  description: z.string().max(500).optional(),
});
export type CreateVoiceInput = z.infer<typeof createVoiceSchema>;

export const listVoicesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

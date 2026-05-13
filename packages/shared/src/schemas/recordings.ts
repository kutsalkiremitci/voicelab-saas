import { z } from "zod";

export const recordingNameSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N}\p{Zs}\-_.()'"]+$/u, "name has invalid characters");

export const updateRecordingSchema = z.object({
  name: recordingNameSchema,
});
export type UpdateRecordingInput = z.infer<typeof updateRecordingSchema>;

export const listRecordingsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRecordingsQuery = z.infer<typeof listRecordingsQuerySchema>;

import { z } from "zod";

export const upstreamPlanSchema = z.enum(["starter", "creator", "pro", "scale"]);
export type UpstreamPlan = z.infer<typeof upstreamPlanSchema>;

export const setApiKeySchema = z.object({
  apiKey: z.string().min(8).max(256),
  plan: upstreamPlanSchema,
});
export type SetApiKeyInput = z.infer<typeof setApiKeySchema>;

export const patchUserSchema = z
  .object({
    status: z.enum(["unverified", "active", "suspended"]).optional(),
    role: z.enum(["user", "admin"]).optional(),
    tier: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
  })
  .refine((v) => v.status !== undefined || v.role !== undefined || v.tier !== undefined, {
    message: "At least one of status/role/tier is required",
  });
export type PatchUserInput = z.infer<typeof patchUserSchema>;

export const grantCreditsSchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
});
export type GrantCreditsInput = z.infer<typeof grantCreditsSchema>;

export const adminUserListQuerySchema = z.object({
  status: z.enum(["unverified", "active", "suspended"]).optional(),
  tier: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
  search: z.string().min(1).max(254).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminAuditQuerySchema = z.object({
  adminId: z.string().uuid().optional(),
  action: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

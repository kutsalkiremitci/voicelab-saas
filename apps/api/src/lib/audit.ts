import { db } from "./db";
import { adminAuditLog } from "@voicelab/db/schema";

export type AuditAction =
  | "ACTIVATE_USER"
  | "DEACTIVATE_USER"
  | "SUSPEND_USER"
  | "UNSUSPEND_USER"
  | "PROMOTE_TO_ADMIN"
  | "DEMOTE_FROM_ADMIN"
  | "SET_API_KEY"
  | "REMOVE_API_KEY"
  | "GRANT_FREE_CREDITS"
  | "MANUAL_VERIFY"
  | "TIER_CHANGED";

export async function writeAudit(
  adminId: string,
  action: AuditAction,
  metadata: Record<string, unknown>,
): Promise<void> {
  const safeMeta = { ...metadata };
  delete (safeMeta as { apiKey?: unknown }).apiKey;
  await db.insert(adminAuditLog).values({ adminId, action, metadata: safeMeta });
}

import { AppError } from "./errors";

export type Tier = "free" | "basic" | "pro" | "enterprise";

export function checkCloningPermission(tier: Tier, kind: "ivc" | "pvc"): void {
  if (tier === "free") {
    throw new AppError("TIER_LIMIT", "Upgrade to clone your voice", 403, {
      upgradeTo: "basic",
    });
  }
  if (kind === "pvc" && tier === "basic") {
    throw new AppError("TIER_LIMIT", "Studio Voice Clone requires Pro tier", 403, {
      upgradeTo: "pro",
    });
  }
}

export function checkSpeechToSpeechPermission(tier: Tier): void {
  if (tier === "free") {
    throw new AppError("TIER_LIMIT", "Upgrade to use Voice Conversion", 403, {
      upgradeTo: "basic",
    });
  }
}

import { AppError } from "./errors";
import type { OutputFormat } from "@voicelab/shared/schemas/generations";

export type Tier = "free" | "basic" | "pro" | "enterprise";

const TIER_FORMATS: Record<Tier, OutputFormat[]> = {
  free: ["mp3_44100_128"],
  basic: ["mp3_44100_128"],
  pro: ["mp3_44100_128", "mp3_44100_192"],
  enterprise: ["mp3_44100_128", "mp3_44100_192", "pcm_44100"],
};

export function checkOutputFormat(tier: Tier, format: OutputFormat): void {
  if (!TIER_FORMATS[tier].includes(format)) {
    throw new AppError(
      "OUTPUT_FORMAT_NOT_ALLOWED",
      `Output format ${format} is not available on your plan`,
      403,
      { upgradeTo: format === "pcm_44100" ? "enterprise" : "pro" },
    );
  }
}

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

export type Tier = {
  id: "free" | "basic" | "pro" | "enterprise";
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyTotal?: string;
  cadence: string;
  tagline: string;
  highlighted?: boolean;
  features: string[];
  cta: { label: string; href: string; mailto?: boolean };
};

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    cadence: "forever",
    tagline: "Try VoiceLab end to end with no commitment.",
    features: [
      "1,000 credits, granted once on email verification",
      "Voice catalog",
      "Text-to-speech generation",
      "MP3 128 kbps output",
    ],
    cta: { label: "Get started free", href: "/register" },
  },
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: "$15",
    yearlyPrice: "$12",
    yearlyTotal: "$144",
    cadence: "per month",
    tagline: "Clone your own voice, generate at production scale.",
    features: [
      "30,000 credits / month",
      "Quick Voice Clone",
      "Voice Conversion (speech-to-speech)",
      "Multi-language dubbing",
      "MP3 128 kbps output",
    ],
    cta: { label: "Start Basic", href: "/register" },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$59",
    yearlyPrice: "$47",
    yearlyTotal: "$564",
    cadence: "per month",
    tagline: "Studio-grade fidelity for creators and teams.",
    highlighted: true,
    features: [
      "121,000 credits / month",
      "Quick + Studio Voice Clone",
      "Voice Conversion",
      "Multi-language dubbing",
      "MP3 192 kbps output",
      "Priority support",
    ],
    cta: { label: "Start Pro", href: "/register" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    cadence: "annual",
    tagline: "Volume credits, studio-quality export, dedicated support.",
    features: [
      "Custom credit allowance",
      "Everything in Pro",
      "44.1 kHz studio PCM output",
      "SLA + dedicated success manager",
    ],
    cta: { label: "Contact sales", href: "mailto:hello@voicelab.local?subject=Enterprise%20inquiry", mailto: true },
  },
];

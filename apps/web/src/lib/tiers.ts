export type Tier = {
  id: "free" | "basic" | "pro" | "enterprise";
  name: string;
  price: string;
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
    price: "$0",
    cadence: "one-time",
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
    price: "$15",
    cadence: "per month",
    tagline: "Clone your own voice, generate at production scale.",
    features: [
      "30,000 credits / month",
      "Quick Voice Clone",
      "Voice Conversion (speech-to-speech)",
      "Multi-language dubbing",
      "MP3 128 kbps output",
    ],
    cta: { label: "Upgrade to Basic", href: "/register" },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$59",
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
    cta: { label: "Upgrade to Pro", href: "/register" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
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

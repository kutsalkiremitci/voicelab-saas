import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSection } from "@/components/marketing/pricing-section";
import { WhoWeAre } from "@/components/marketing/who-we-are";

export const metadata: Metadata = {
  title: "VoiceLab — Bring your voice into your workflow",
  description:
    "Clone your voice once. Generate natural-sounding audio in any tone, any language. 1,000 free credits on sign-up.",
  openGraph: {
    title: "VoiceLab",
    description: "Managed AI voice generation. Clone, generate, ship.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <PricingSection />
      <WhoWeAre />
    </>
  );
}

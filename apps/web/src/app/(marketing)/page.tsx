import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSection } from "@/components/marketing/pricing-section";
import { WhoWeAre } from "@/components/marketing/who-we-are";
import { FinalCta } from "@/components/marketing/final-cta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages.home");
  return { title: t("title"), description: t("description") };
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <PricingSection />
      <WhoWeAre />
      <FinalCta />
    </>
  );
}

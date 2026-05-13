import Link from "next/link";
import { TIERS } from "@/lib/tiers";
import { PricingCard } from "./pricing-card";

export function PricingSection({
  large = false,
  withHeading = true,
}: {
  large?: boolean;
  withHeading?: boolean;
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        {withHeading && (
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Simple, predictable pricing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start free, upgrade when you outgrow it. Cancel anytime.
            </p>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-4">
          {TIERS.map((t) => (
            <PricingCard key={t.id} tier={t} large={large} />
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Need something custom?{" "}
          <Link href="mailto:hello@voicelab.local" className="text-foreground underline-offset-4 hover:underline">
            Talk to us
          </Link>
        </p>
      </div>
    </section>
  );
}

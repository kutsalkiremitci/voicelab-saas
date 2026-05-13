import Link from "next/link";
import { Check } from "lucide-react";
import type { Tier } from "@/lib/tiers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function PricingCard({ tier, large = false }: { tier: Tier; large?: boolean }) {
  return (
    <Card
      className={cn(
        "flex flex-col",
        tier.highlighted && "border-2 border-accent shadow-md",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(large ? "text-xl" : "text-base")}>{tier.name}</CardTitle>
          {tier.highlighted && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              Most popular
            </span>
          )}
        </div>
        <CardDescription>{tier.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <div>
          <span className={cn("font-semibold tracking-tight", large ? "text-4xl" : "text-3xl")}>
            {tier.price}
          </span>{" "}
          <span className="text-sm text-muted-foreground">{tier.cadence}</span>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Link
          href={tier.cta.href}
          className={cn(
            buttonVariants({
              variant: tier.highlighted ? "default" : "outline",
              size: large ? "lg" : "default",
            }),
            "mt-auto",
          )}
        >
          {tier.cta.label}
        </Link>
      </CardContent>
    </Card>
  );
}

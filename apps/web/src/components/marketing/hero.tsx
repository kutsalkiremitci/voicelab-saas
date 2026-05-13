import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:py-32">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Bring your voice into your workflow.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Clone your voice once. Generate hours of natural-sounding audio in any tone, any
          language. Verified email gets you 1,000 credits to try it for free.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}>
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

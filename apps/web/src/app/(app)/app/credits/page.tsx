"use client";

import Link from "next/link";
import { useCreditBalance } from "@/hooks/use-credits";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CreditsPage() {
  const { data } = useCreditBalance();
  const { data: auth } = useAuth();
  const tier = auth?.user.tier ?? "free";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="text-sm text-muted-foreground">
          {data?.source === "upstream" ? "Plan quota" : "Free trial credits"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? data.balance.toLocaleString() : "—"}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {data?.source === "upstream" ? "credits remaining this period" : "credits remaining"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Plan: <span className="font-medium text-foreground">{tier}</span>
          </p>
          {data?.resetAt && (
            <p>Renews {new Date(data.resetAt).toLocaleDateString()}.</p>
          )}
          {tier === "free" && (
            <Link href="/pricing" className={cn(buttonVariants(), "mt-3 w-fit")}>
              Upgrade for more credits
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

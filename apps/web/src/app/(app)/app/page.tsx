"use client";

import Link from "next/link";
import { Coins, Mic, Sparkles, Wand2 } from "lucide-react";
import { useCreditBalance } from "@/hooks/use-credits";
import { useRecordings } from "@/hooks/use-recordings";
import { useVoices } from "@/hooks/use-voices";
import { useGenerations } from "@/hooks/use-generations";
import { useAuth } from "@/hooks/use-auth";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppDashboardPage() {
  const auth = useAuth();
  const credits = useCreditBalance();
  const recordings = useRecordings();
  const voices = useVoices();
  const generations = useGenerations();

  const balance = credits.data?.balance ?? null;
  const balanceLabel =
    credits.data?.source === "upstream" ? "Plan quota" : "Free credits";
  const balanceText = balance === null ? "—" : balance.toLocaleString();

  const showFreeUpgrade =
    auth.data?.user.tier === "free" && (balance === null || balance < 200);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {auth.data?.user.email ? `Signed in as ${auth.data.user.email}.` : "Welcome back."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Coins}
          label={balanceLabel}
          value={balanceText}
          hint={
            credits.data?.resetAt
              ? `Renews ${new Date(credits.data.resetAt).toLocaleDateString()}`
              : credits.data?.source === "free"
                ? "One-time grant on verification"
                : undefined
          }
        />
        <MetricCard
          icon={Mic}
          label="Recordings"
          value={recordings.data?.recordings.length.toString() ?? "—"}
        />
        <MetricCard
          icon={Sparkles}
          label="Voices"
          value={voices.data?.voices.length.toString() ?? "—"}
        />
        <MetricCard
          icon={Wand2}
          label="Generations"
          value={generations.data?.generations.length.toString() ?? "—"}
        />
      </div>

      {showFreeUpgrade && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">
              {balance === 0 ? "You've used your free credits" : "Running low on credits"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>Upgrade to Basic for 30,000 credits a month and unlock voice cloning.</p>
            <Link href="/pricing" className={cn(buttonVariants({ size: "sm" }))}>
              See plans
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent generations</CardTitle>
        </CardHeader>
        <CardContent>
          {generations.data && generations.data.generations.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {generations.data.generations.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2">
                  <span className="truncate pr-3 text-foreground">{g.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(g.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No generations yet — record a voice to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

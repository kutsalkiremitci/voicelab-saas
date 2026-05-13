"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useVoices, useDeleteVoice } from "@/hooks/use-voices";
import { NewCloneDialog } from "@/components/app/new-clone-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function VoicesPage() {
  const auth = useAuth();
  const { data, isLoading } = useVoices();
  const del = useDeleteVoice();

  const tier = auth.data?.user.tier;
  const canIvc = tier === "basic" || tier === "pro" || tier === "enterprise";
  const canPvc = tier === "pro" || tier === "enterprise";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voices</h1>
          <p className="text-sm text-muted-foreground">Select a voice to generate speech or convert audio.</p>
        </div>
        <div className="flex gap-2">
          {canIvc ? (
            <NewCloneDialog
              kind="ivc"
              trigger={<Button>New Quick Clone</Button>}
            />
          ) : (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }))}
              title="Upgrade to clone your voice"
            >
              Upgrade to clone
            </Link>
          )}
          {canPvc ? (
            <NewCloneDialog
              kind="pvc"
              trigger={<Button variant="outline">New Studio Clone</Button>}
            />
          ) : tier === "basic" ? (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "ghost" }))}
              title="Studio Voice Clone is on Pro"
            >
              Studio Clone (Pro)
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data && data.voices.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.voices.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium">{v.label}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        v.status === "ready" && "bg-accent/15 text-accent",
                        v.status === "pending" && "bg-muted text-muted-foreground",
                        v.status === "failed" && "bg-destructive/15 text-destructive",
                      )}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/app/voices/${v.id}`}
                        className={cn(buttonVariants({ size: "sm" }))}
                      >
                        Generate
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => del.mutate(v.id)}
                        disabled={del.isPending}
                        aria-label="Delete voice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No voices yet.{" "}
          {canIvc ? "Create your first clone above." : (
            <>Upgrade to clone your voice — or wait for the voice library (coming soon).</>
          )}
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useVoices, useDeleteVoice } from "@/hooks/use-voices";
import { NewCloneDialog } from "@/components/app/new-clone-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { cn } from "@/lib/utils";

export default function VoicesPage() {
  const t = useTranslations();
  const auth = useAuth();
  const { data, isLoading } = useVoices();
  const del = useDeleteVoice();

  const tier = auth.data?.user.tier;
  const canIvc = tier === "basic" || tier === "pro" || tier === "enterprise";
  const canPvc = tier === "pro" || tier === "enterprise";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("voices.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("voices.sub")}</p>
        </div>
        <div className="flex gap-2">
          {canIvc ? (
            <NewCloneDialog
              kind="ivc"
              trigger={<Button>{t("voices.newQuickClone")}</Button>}
            />
          ) : (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }))}
              title={t("voices.upgradeQuickHint")}
            >
              {t("voices.upgradeToClone")}
            </Link>
          )}
          {canPvc ? (
            <NewCloneDialog
              kind="pvc"
              trigger={<Button variant="outline">{t("voices.newStudioClone")}</Button>}
            />
          ) : tier === "basic" ? (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "ghost" }))}
              title={t("voices.studioCloneHint")}
            >
              {t("voices.studioClonePro")}
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : data && data.voices.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("voices.thLabel")}</th>
                <th className="px-3 py-2 text-left">{t("voices.thStatus")}</th>
                <th className="px-3 py-2 text-left">{t("voices.thCreated")}</th>
                <th className="px-3 py-2 text-right">{t("voices.thActions")}</th>
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
                      {t(`voices.status${v.status.charAt(0).toUpperCase() + v.status.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/app/voices/${v.id}`}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "bg-accent text-accent-foreground hover:bg-accent/90",
                        )}
                      >
                        {t("voices.generate")}
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => del.mutate(v.id)}
                        disabled={del.isPending}
                        aria-label={t("voices.deleteVoice")}
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
          {t("voices.emptyNoVoices")}{" "}
          {canIvc ? t("voices.emptyCreateFirst") : t("voices.emptyUpgradeOrLibrary")}
        </p>
      )}
    </div>
  );
}

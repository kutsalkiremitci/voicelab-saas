"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
}: Props) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <div
          className={cn(
            "flex items-start gap-3 px-6 pt-6 pb-4",
            destructive ? "bg-destructive/5" : "bg-muted/30",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              destructive ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogHeader className="flex-1">
            <DialogTitle className="text-base">
              {title ?? t("confirm.defaultTitle")}
            </DialogTitle>
            <DialogDescription>
              {description ?? t("confirm.defaultDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="border-t bg-card px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel ?? t("confirm.cancel")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel ?? t("confirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

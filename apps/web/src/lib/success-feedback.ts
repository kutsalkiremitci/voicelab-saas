"use client";

import confetti from "canvas-confetti";
import { toast } from "sonner";

interface Options {
  /** Toast title shown next to the confetti. Defaults to a generic "Done!". */
  message?: string;
  /** Secondary description under the toast title. */
  description?: string;
  /** Disable the confetti burst (still shows the toast). */
  silent?: boolean;
}

/**
 * Fire a celebratory toast + a full-viewport confetti burst.
 *
 * Coalescing: rapid successive calls (within 400 ms) are dropped so a batch
 * of optimistic-update mutations doesn't blast the screen ten times.
 */
let lastFiredAt = 0;
const COALESCE_MS = 400;

export function celebrate(opts: Options = {}): void {
  const now = Date.now();
  const skipConfetti = opts.silent === true || now - lastFiredAt < COALESCE_MS;
  lastFiredAt = now;

  toast.success(opts.message ?? "Done!", {
    description: opts.description,
    duration: 3500,
  });

  if (skipConfetti) return;
  if (typeof window === "undefined") return;

  const defaults: confetti.Options = {
    startVelocity: 32,
    spread: 70,
    ticks: 80,
    zIndex: 9999,
    scalar: 0.9,
  };

  // Three small bursts from the bottom-center, slight angle spread.
  void confetti({
    ...defaults,
    particleCount: 60,
    angle: 90,
    origin: { x: 0.5, y: 1 },
  });
  setTimeout(() => {
    void confetti({
      ...defaults,
      particleCount: 50,
      angle: 60,
      origin: { x: 0.15, y: 1 },
    });
    void confetti({
      ...defaults,
      particleCount: 50,
      angle: 120,
      origin: { x: 0.85, y: 1 },
    });
  }, 120);
}

import { cn } from "@/lib/utils";

export function BrandMark({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-9 w-9",
  } as const;
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-sm shadow-accent/20",
        sizes[size],
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className={iconSizes[size]} aria-hidden>
        <path
          d="M12 3v18M7 6v12M17 6v12M2 9v6M22 9v6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

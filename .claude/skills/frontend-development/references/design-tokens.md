# Design System

The visual language. shadcn / Vercel ethos.

## Principles

- Sparse, dense, functional. Hierarchy through typography, not color.
- One accent color. Everything else neutral.
- Thin 1px borders (`border-border`).
- Soft shadows only (`shadow-sm`, `shadow-md`). Nothing heavier.
- Motion 150–200ms. Nothing exceeds 300ms.
- Dark mode is first-class; default dark, light optional. Every component verified in dark.

## Color Tokens (Tailwind 4 + CSS variables)

```css
@theme {
  --color-background: 0 0% 100%;
  --color-foreground: 0 0% 9%;
  --color-card: 0 0% 100%;
  --color-primary: 0 0% 9%;
  --color-primary-foreground: 0 0% 98%;
  --color-muted: 0 0% 96%;
  --color-muted-foreground: 0 0% 45%;
  --color-border: 0 0% 90%;
  --color-ring: 0 0% 9%;
  --color-accent: 220 90% 56%;       /* the single accent */
  --color-destructive: 0 84% 60%;
}

.dark {
  --color-background: 0 0% 4%;
  --color-foreground: 0 0% 98%;
  --color-card: 0 0% 6%;
  --color-muted: 0 0% 10%;
  --color-muted-foreground: 0 0% 64%;
  --color-border: 0 0% 14%;
}
```

## Typography

- Font: Geist (preferred) or Inter
- Mono: Geist Mono or JetBrains Mono
- Headings: `tracking-tight`, `font-semibold`
- Body: `text-sm` default, `text-base` for page bodies

## Spacing & Radius

- Tailwind defaults: 4 / 6 / 8 grid
- Card padding `p-6`, section gap `gap-6` or `gap-8`
- Radius: `rounded-lg` default, `rounded-md` for buttons, `rounded-full` for avatars

## Anti-patterns (forbidden)

- Gradients used as decoration
- More than one accent hue
- Thick borders (2px+)
- Heavy shadows (`shadow-xl`, `shadow-2xl`)
- Hardcoded hex colors outside `globals.css`
- Animations longer than 300ms
- Emoji as primary iconography (use `lucide-react`)

## Component examples

### MetricCard

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Total generations
    </CardTitle>
    <Icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-semibold">84</div>
    <p className="text-xs text-muted-foreground">+12 last 7 days</p>
  </CardContent>
</Card>
```

### Button variants (via cva)

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

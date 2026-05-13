# Stripe (Phase 16 — Deferred)

Self-serve checkout is deferred until > 20 paying users or > 2 hr/week of operator provisioning time. Until then, paid upgrades are operator-mediated: user requests upgrade → operator manually provisions upstream → admin pastes key.

This file is a placeholder describing how Stripe will integrate when the trigger fires.

## Trigger

Any of:
- > 20 paying users
- Operator manual-provisioning time > 2 hours/week
- A specific customer requests self-serve "I want to upgrade now, not wait"

## Architecture (when implemented)

Stripe is a **payment ingress**, not a replacement for the manual provisioning. The upstream provider doesn't have a self-signup API; the operator still creates the ElevenLabs account by hand. Stripe just collects money and notifies the operator.

```
1. User clicks "Upgrade to Pro" in /app/billing
2. Frontend → POST /billing/checkout → Stripe Checkout session URL
3. User pays at Stripe → webhook hits POST /billing/webhook
4. Webhook handler:
   a. Verifies Stripe signature
   b. Records event id in `stripe_events` (idempotency)
   c. Records the pending paid status: user.tier = "pending_provision" (new enum value)
   d. Sends operator a Slack/email notification: "User X paid for Pro tier — provision an upstream account"
5. Operator within 24h:
   a. Receives notification
   b. Creates upstream Pro account
   c. Pastes key via the existing admin "Activate Account" wizard
   d. User flips from "pending_provision" → "pro"
6. Email to user: "Your account is upgraded!"
```

The SLA promise on the marketing site for self-serve upgrades: "Activated within 24 hours of payment."

Eventually (Phase 17+), Playwright automation could handle the upstream signup, but ElevenLabs has no signup API, so this remains semi-manual.

## Tables added at Phase 16

```ts
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),        // Stripe event id (idempotency)
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stripeCustomers = pgTable("stripe_customers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

And a new status enum value: `pending_provision` (between Stripe success and operator activation).

## Endpoints (deferred)

```
POST /billing/checkout         { tier: "basic" | "pro" } → 200 { url }
POST /billing/webhook          ← Stripe signature header → 200 OK
POST /billing/portal           → 200 { url }              // Stripe billing portal
GET  /billing/tier             → 200 { tier, status, renewsAt? }
```

## Event handlers (deferred)

- `checkout.session.completed` → record paid status, notify operator
- `customer.subscription.deleted` → downgrade user (admin manually pulls upstream key)
- `customer.subscription.updated` → handle tier change (admin manually updates upstream)
- `invoice.payment_failed` → notify operator, possibly suspend

## What this DOESN'T do

- **No automatic upstream provisioning.** Operator still pastes keys manually.
- **No tier auto-promotion.** Operator confirms each activation.
- **No prorated billing.** Stripe handles its own proration on subscriptions; we just observe.

When operator time on provisioning becomes the bottleneck, the next investment is Playwright-driven semi-automation of the upstream signup. Phase 17+.

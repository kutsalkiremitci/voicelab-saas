# Admin Operations

The admin panel has two primary mutating actions:
1. **Activate a paid user** — paste an upstream API key, set tier
2. **Grant Free credits** — support comp for Free users only (e.g. compensating a bug)

Plus the standard suspension / role-change operations.

## Activate paid user (the main flow)

When a user signs up and verifies, they're on Free. When they want to upgrade, the operator manually provisions an upstream account (5–10 min, see ADR-004) and pastes the resulting API key into the admin panel.

### Endpoint

```
PUT /admin/users/:id/api-key
body: { apiKey: string, plan: "starter" | "creator" | "pro" | "scale" }
→ 200 { user }
```

### Handler

```ts
app.put("/admin/users/:id/api-key", requireAuth, requireAdmin, async (c) => {
  const adminId = c.get("userId");
  const targetUserId = c.req.param("id");
  const body = setApiKeySchema.parse(await c.req.json());

  const target = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (target.status !== "active") {
    throw new AppError("USER_NOT_ACTIVE", "Verify the user's email first", 409);
  }

  // Map upstream plan → VoiceLab tier
  const tierMap: Record<string, "basic" | "pro" | "enterprise"> = {
    starter: "basic",
    creator: "pro",
    pro: "enterprise",
    scale: "enterprise",
  };
  const newTier = tierMap[body.plan];
  if (!newTier) throw new AppError("INVALID_PLAN", "Unknown upstream plan", 422);

  // Encrypt the key BEFORE writing it anywhere
  const encryptedKey = await encryptApiKey(body.apiKey);

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      elevenlabsApiKey: encryptedKey,
      elevenlabsPlan: body.plan,
      tier: newTier,
      activatedAt: sql`NOW()`,
    }).where(eq(users.id, targetUserId));

    // Remove the Free credits row (they're paid now)
    await tx.delete(credits).where(eq(credits.userId, targetUserId));
  });

  // Invalidate cached subscription
  await redis.del(`subscription:${targetUserId}`);

  // Audit
  await auditLog.write(adminId, "SET_API_KEY", {
    targetUserId,
    plan: body.plan,
    tier: newTier,
    // NEVER include the raw key in the audit log
  });

  // Return user without the api-key field (serializer strips it)
  const updated = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  return c.json({ user: stripSensitive(updated) });
});
```

### Critical safeguards

- **Raw key never logged.** Not in audit log, not in error messages, not in Sentry breadcrumbs. The `metadata` jsonb captures `{ plan, tier, targetUserId }` only.
- **Encryption happens before any DB write.** If encryption fails, the transaction never starts.
- **`users.elevenlabsApiKey` is stripped from all API responses.** Serialization layer drops the column when sending to clients (including admin clients — the operator pastes the key once and never sees it again).
- **Cache invalidation.** The user's `subscription:${userId}` Redis key is deleted so the next balance read fetches fresh upstream data.
- **Free credits removed.** Once paid, the Free row is gone; they're entirely on upstream metering.

### Frontend wizard

The admin panel's "Activate Account" wizard:

1. Admin clicks "Activate" on a Free user's detail page
2. Wizard opens with two fields: `Plan` (dropdown: Starter / Creator / Pro / Scale) and `API Key` (password-style input, masked)
3. Helper text: "Open the upstream provider's dashboard in another tab, create the account, copy the key."
4. Submit → `PUT /admin/users/:id/api-key` → success toast → user detail refreshes
5. After this, the api-key field shows `sk_•••••••• (set on 2026-05-13)`. Never the raw value.

To rotate: admin can click "Rotate" → same wizard, new key replaces old.
To remove: `DELETE /admin/users/:id/api-key` → tier returns to Free, but **no Free credits** are regranted (the user already had their trial).

## Grant Free credits (support comp)

For situations like "user reported a generation that didn't produce audio; refund their cost":

```
POST /admin/users/:id/credits
body: { amount: number, reason?: string, note?: string }
→ 201 { credits }
```

### Handler

```ts
app.post("/admin/users/:id/credits", requireAuth, requireAdmin, async (c) => {
  const adminId = c.get("userId");
  const targetUserId = c.req.param("id");
  const body = grantCreditsSchema.parse(await c.req.json());

  const target = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!target) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  if (target.tier !== "free") {
    throw new AppError("USER_NOT_FREE", "Credit grants only apply to Free users", 409);
  }

  const updated = await db.transaction(async (tx) => {
    // Ensure a credits row exists (in case Free user has no row yet — shouldn't happen)
    await tx.insert(credits).values({
      userId: targetUserId,
      balance: body.amount,
    }).onConflictDoUpdate({
      target: credits.userId,
      set: {
        balance: sql`${credits.balance} + ${body.amount}`,
        // exhaustedAt stays null if it was; or cleared on additional grant
        exhaustedAt: sql`NULL`,
      },
    });

    return tx.query.credits.findFirst({ where: eq(credits.userId, targetUserId) });
  });

  await auditLog.write(adminId, "GRANT_FREE_CREDITS", {
    targetUserId,
    amount: body.amount,
    reason: body.reason ?? null,
    note: body.note ?? null,
  });

  return c.json({ credits: updated }, 201);
});
```

### Why 409 if not Free

Paid users don't have a `credits` row. Granting them would create one, and then the dual-source confusion kicks in (which one is real, app credits or upstream?). The cleaner answer: paid users get upstream quota — if they need more, upgrade their tier upstream. Admin can do that via `PUT /admin/users/:id/api-key` with a higher upstream plan.

## Other admin mutations

```
PATCH /admin/users/:id { status?, role?, tier? }
```

- `status: "suspended"` → audit `SUSPEND_USER`
- `status: "active"` (from suspended) → audit `UNSUSPEND_USER`
- `role: "admin"` → audit `PROMOTE_TO_ADMIN`
- `role: "user"` on self → 403 (cannot demote self)

Each action mirrors a row in `admin_audit_log`.

## audit log schema

```ts
export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action", {
    enum: [
      "ACTIVATE_USER",
      "DEACTIVATE_USER",
      "SUSPEND_USER",
      "UNSUSPEND_USER",
      "PROMOTE_TO_ADMIN",
      "DEMOTE_FROM_ADMIN",
      "SET_API_KEY",
      "REMOVE_API_KEY",
      "GRANT_FREE_CREDITS",
      "MANUAL_VERIFY",
    ],
  }).notNull(),
  metadata: jsonb("metadata"),  // never the raw api key
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Indexes: `(adminId, createdAt DESC)`, `(action)`.

## Tests required

In `apps/api/test/integration/admin-operations.test.ts`:

1. `PUT /api-key` encrypts the key; raw key never appears in any DB column readable as plaintext
2. `PUT /api-key` on Free user removes their `credits` row
3. `PUT /api-key` on already-Paid user (rotation) replaces the key, keeps tier if same plan
4. `DELETE /api-key` returns user to Free tier but does NOT re-grant Free credits
5. `POST /credits` on Paid user → 409
6. `POST /credits` on Free user with no credits row → row created with `amount`
7. `POST /credits` on Free user with existing row → row balance incremented
8. Audit log entries created for every action; raw API key NEVER appears in metadata
9. Admin demote-self attempt → 403
10. Non-admin attempts → 403

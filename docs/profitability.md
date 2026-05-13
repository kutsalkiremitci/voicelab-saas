# Profitability Model

How VoiceLab makes money under the per-user managed account model (ADR-004). Read this when changing pricing, evaluating tier conversion, or estimating revenue at scale.

This document complements `decisions/006-pricing-tiers.md` (the tier shape) and `decisions/004-per-user-managed-api-key.md` (the upstream model).

---

## 1. The model in one paragraph

When a user upgrades to Basic, the operator provisions a Starter subscription with the upstream provider for $6/month and resells it to the user as $15/month. The difference — minus Stripe fees and a small operational share — is gross profit. Each tier mirrors a real upstream subscription: Basic = upstream Starter, Pro = upstream Creator, Enterprise = upstream Pro or Scale. Free tier runs through a single shared demo account funded by the operator.

This means **there is no quota juggling, no shared-key complexity, no character-counting overhead** on the paid side. The upstream provider enforces the limit for each paid user; VoiceLab is a UX wrapper.

---

## 2. Per-tier unit economics (per active user, per month)

| Tier | User pays | Upstream cost | Stripe fee | Ops share | **Net** | **Margin** |
|------|-----------|---------------|------------|-----------|---------|-----------|
| Free | $0.00 | shared (~$0.20/user) | $0 | $0.05 | **−$0.25** | acquisition cost |
| Basic | $15.00 | $6.00 | $0.74 | $0.20 | **$8.06** | 54% |
| Pro | $59.00 | $22.00 | $2.01 | $0.40 | **$34.59** | 59% |
| Enterprise | varies | $99–299 | varies | $1.00 | **per-deal** | 50–70% target |

Notes:
- **Stripe fee** = 2.9% + $0.30 USD assumed; lower with annual or PayPal alternative
- **Ops share** = infra cost (DB, VPS, Redis, monitoring) divided across paying users
- **Free upstream cost** = pro-rated demo account cost over expected utilization

Margin tightens as tier scales because upstream cost also scales. Absolute dollars per user grow significantly across tiers.

---

## 3. Free tier as customer acquisition

Free users are not free to us. Each verified Free signup costs roughly $0.25 (pro-rated shared demo quota + email delivery). Break-even on a Free user happens **the moment they upgrade to Basic** — first month covers ~32 free signups.

Conversion targets:
- **Below 10% Free→Basic conversion:** rethink the funnel. Free credits may be too generous OR onboarding doesn't show value before the credits run out.
- **10–20%:** healthy.
- **> 30%:** consider raising prices or tightening Free, you might be undercharging.

The 1,000-credit one-time grant is calibrated to give just enough taste: roughly one minute of TTS using the default voice catalog. Enough to evaluate quality, not enough to "live in Free."

---

## 4. Cohort scenarios

### 100 total users, baseline mix

```
80 Free     × (−$0.25)    = −$20.00    (acquisition cost)
15 Basic    × $8.06       = $120.90
 4 Pro      × $34.59      = $138.36
 1 Enterprise mid-range   = $100.00
─────────────────────────────────────
Gross MRR                  = $339.26
Infra fixed cost           ≈ −$30.00
─────────────────────────────────────
Net MRR                    ≈ $309 / month (~$3,700/year on 100 users)
```

### 500 total users, baseline mix

```
400 Free    × (−$0.25)    = −$100.00
 75 Basic   × $8.06       = $604.50
 20 Pro     × $34.59      = $691.80
  5 Enterprise mid-range  = $500.00
─────────────────────────────────────
Gross MRR                  = $1,696.30
Infra fixed cost           ≈ −$80.00
─────────────────────────────────────
Net MRR                    ≈ $1,616 / month (~$19,400/year)
```

### 1,000 total users, healthier conversion (25% paid)

```
750 Free    × (−$0.25)    = −$187.50
175 Basic   × $8.06       = $1,410.50
 60 Pro     × $34.59      = $2,075.40
 15 Enterprise mid-range  = $1,500.00
─────────────────────────────────────
Gross MRR                  = $4,798.40
Infra fixed cost           ≈ −$200.00
─────────────────────────────────────
Net MRR                    ≈ $4,598 / month (~$55,000/year)
```

At 1,000 users with a 25% paid mix, this becomes meaningful side-income. At 5,000+ it's a real business with operator burden that justifies hiring help.

---

## 5. Operator time cost (the hidden expense)

Each paid signup requires manual provisioning:
- Create ElevenLabs account with Gmail alias: 2 minutes
- Verify email, subscribe to tier, enter card: 3 minutes
- Copy API key, paste into admin panel: 1 minute
- Activate user, notify: 1 minute

**~7 minutes per new paid user.** At 50 new paid signups/month → 6 hours of operator time. Not bad. At 200/month → 23 hours; time to consider Playwright automation or a part-time VA.

This is unpriced in the unit economics above. If you value your time at $50/hour and average 1 hour/week on provisioning, that's ~$200/month deducted from net MRR. Factor in when deciding whether to scale.

---

## 6. Free tier abuse modeling

A determined abuser with throwaway emails could theoretically chain signups to burn through the shared demo account. Mitigations (from ADR-007):

1. **Email verification required** — no API call without verified email
2. **1,000 credit one-time grant** — non-renewing
3. **`UNIQUE(email)` constraint** — same email can't double-grant
4. **Disposable email blocklist** (backlog) — if abuse pattern emerges

Worst case at the current model: 100 throwaway accounts = 100,000 free credits consumed = ~$10 in upstream cost. Acceptable bleed-out. If it scales (say, 1,000 abuse signups in a week), upgrade demo to Pro tier ($99/month → 990K credit pool) and add a disposable-email blocklist as the next gate.

---

## 7. Failure modes

### Upstream price increase
If the upstream provider raises Starter from $6 to $9: Basic margin drops from $8.06 to $5.06 (34%). Action: raise Basic to $17.50 within 30 days (preserves dollar margin) or absorb temporarily (smaller, predictable users).

### Currency exposure
Upstream bills USD. If selling to TR market via Iyzico TL, FX volatility can swing margins ±10% in a month. Mitigation: TL prices have a 15-20% buffer over USD-equivalent, reviewed monthly.

### Operator card declined / fraud-flagged
After 5–10 ElevenLabs accounts on the same card, the upstream provider may flag for fraud and lock new account creation. Mitigation: virtual cards (Wise, Revolut, N26) — different card number per account. ~$0 cost, operational planning only.

### Email deliverability tanks
If verification emails land in spam, signups stall. Mitigation: configure SPF/DKIM/DMARC at custom domain, use Resend (paid) over a self-hosted SMTP, monitor bounce rate.

### Free demo account exhausted mid-month
If many users sign up early in the month and exhaust the demo quota, late signups can't try the product. Mitigation: alert at 80%, upgrade demo from Creator ($22) to Pro ($99) temporarily if needed. Long-term, cap monthly Free signups.

---

## 8. When to act (decision rules)

| Metric | Watch threshold | Action |
|--------|-----------------|--------|
| Free → Basic conversion | < 10% | Onboarding broken; raise credits or improve value clarity |
| Free → Basic conversion | > 30% | Consider raising prices |
| Demo account quota | > 80% mid-month | Upgrade demo OR cap Free signups |
| Operator time on provisioning | > 2 hr/week | Hire VA or build semi-automation (Playwright) |
| Paid user count | > 20 | Trigger Stripe checkout phase |
| Paid user count | > 50 | Discuss Authorized Reseller with upstream |
| MRR | > $5,000 | Reinvest in operator help, marketing |
| Stripe chargebacks | > 1% | Tighten signup, add fraud signals |
| Upstream price change announced | within 7 days | Re-price within 30 days |

---

## 9. Single takeaway

> Each paying user generates **$8 (Basic) to $35 (Pro) net per month** at current pricing. A balanced 100-user cohort with ~20% paid conversion produces ~$300 net MRR. Reaching $1,000 MRR requires ~60 paying users (or equivalent in mix). The model is robust to ~30% margin compression before becoming uneconomical.

The hard problem is acquiring those first 60 paying users. The pricing model is solved; distribution isn't.

---

## 10. What this model does NOT cover

- **Customer acquisition cost (CAC):** zero in MVP (organic). At paid acquisition, target CAC ≤ 3× first-month revenue.
- **Refunds:** budget 1–2% revenue loss for chargebacks.
- **Operator time:** unpriced above; factor your hourly rate × hours/month into a personal P&L.
- **Compliance & legal:** GDPR-light at this scale; KVKK (Turkey) if targeting TR. Reserve $500–1,000 one-time for legal review at $1K+ MRR.
- **Marketing:** when paid ads enter the picture, every $1 spent should return $3+ within 3 months.

# Control totals before migration v22 (read live, 3 Oct 2026)

Captured from the live database through the signed-in app, before any v22 change.

| Measure | Value |
|---|---|
| rmr_agreements rows (incl. 4 soft-deleted) | 170 |
| Live agreements | 157 |
| History-only agreements | 138 |
| SLA agreements | 7 |
| Sum of Monthly RMR, live | $98,241.49 |
| Billing log rows | 2,858 (1,241 auto · 1,609 paid · 8 unpaid) |
| Paid rows carrying a Vista invoice number | 1,605 (4 without) |
| rmr_commission_plans | 9 |
| rmr_users | 4 |
| rmr_renewals / rmr_commission_events | 0 / 0 |
| rmr_attachments | 14 |
| rmr_audit_log | 451 |
| rmr_draws | 1 ($15,000, preserved, retired from UI) |
| rmr_legacy_payouts (2025 Q1–Q4, signed sheets) | $16,184.88 |
| Paid commission snapshots on agreements (initial+immediate+holdback+accel+renewal) | $11,363.96 across 6 agreements (137, 138, 140, 141, 147, 157) |

## MIG-08 — date-driven auto-paid exposure

| Measure | Value |
|---|---|
| Billing rows with status `auto` and a past date | **875** rows, **$223,113.94**, on 144 agreements |
| Agreements whose second-tranche release date was computed from those rows and has passed | 10 (144, 145, 146, 148, 150, 151, 152, 154, 161, 162) |
| Commission released on the strength of them | $5,402.06 (expected, not paid) |
| Of that, paid | **$0.00** |

Conclusion: the auto-payment repair is a **clean fix**, not a reconciliation project — no commission has been paid on the strength of unconfirmed collections. The 875 rows are reclassified to Scheduled / Unverified in the operational view; their original state is preserved in `rmr_billing_log_audit_v22`.

## CST-10 population

- Agreements whose only cost basis is the legacy monthly direct cost field: **0**
- Agreements double-counting legacy cost on top of itemised labour/subcontractor cost: **0**
- Live agreements with no cost data at all (blocked as unknown margin under the revised engine): 3

## TEC-08 population

- Live agreements with a blank activation date (would have silently grandfathered): **0**

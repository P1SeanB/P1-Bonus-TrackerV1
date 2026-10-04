# Bonus Tracker — spec v2.7 build (app P1RMR-56, migration v22)

Built 3 October 2026 against *Bonus Tracking Tool Developer Specification v2.7*.

## What landed, by phase

| Phase | Delivered |
|---|---|
| 1 Substrate | Exact decimal engine (`src/engine27.js`: BigInt cents, rational multiples, half-up rounding, tranche 2 = total − tranche 1). Plan **versions** inside three families with required `rate_basis`. **Fail-closed** resolution: no `DEFAULT_CONFIG` terminus, no default plan, no role fallback; anything not resolvable shows *Plan not configured*, never $0. `normalizeConfig` no longer restores superseded values; historical versions read their as-applied values (`historicalEffectiveConfig`). `workbookPreset` term conversion = 0. Permission role separated from plan family (Administrator, Executive, Manager, Representative, Read Only) with a recorded mapping. Append-only ledger (`rmr_comm_events`, `rmr_credit_shares`, `rmr_ledger_entries`) enforced by database triggers. |
| 2 Data honesty | Generated billing rows are **Scheduled**; a date passing never marks anything paid. Collections count only on a Vista receipt or a documented verification. The manual paid toggle is gone. Unknown margin blocks qualification. Legacy cost is used only when nothing is itemised (then *Cost basis unverified*, blocked) and is never added on top. Grandfathering comes from a recorded rule, not a missing date. Draws removed from the UI and every calculation (rows preserved). |
| 3 Vista + Worklist | Import panel on **Reconciliation**: five slots (four primary + optional attribution), Appendix F text verbatim in each slot, hover paths, due / due soon / overdue against the payout calendar, column-signature rejection, the +1 column offset handled, Totals rows discarded, parameter echo recorded and Invoiced-only runs flagged, idempotent keys, confirm-before-commit. New top-level **Worklist** tab: typed, owned, aged items with filters; closing requires a basis and is audited; re-imports close items with the batch as basis. Posted-vs-Modelled on the Costs tab with four buckets (unresolved retained). |
| 4 Revised Hybrid | **Hybrid v1 (revised)** seeded as a **draft** with every v2.7 value. Admin: plan selector with exactly Hybrid / Hunter / Farmer + status, grouped settings, Save draft / Preview calculation / Publish version, read-only Historical rules, Employees (permission role, approved plan assignment with dates, salary records, acknowledgement status). In-app acknowledgement of the written terms before any calculation (exact text + timestamp, immutable). Agreement editor: summary bar with separate cost / qualification / payment badges; new section-7 fields; explicit *New sale / Expansion / Renewal / SLA* event buttons (saving never creates commission); approve-and-lock cost versions; new **Commission history** tab. |
| Guide | In-app *How your commission works* guide rebuilt (ADM-03, AGR-04): Hybrid / Hunter / Farmer selector, every number read from the plan version's stored settings, status banner (draft / live / not configured), worked examples on $100/month recomputed from the settings. Hunter and Farmer show the full structure with *Not set* wherever numbers are pending and fill in automatically once configured. The old preset guide is kept under a collapsed *Historical rules* section for pre-cutover deals. |
| Comp plan per user | Admin ▸ Employees has a **Comp plan** column (Hybrid / Hunter / Farmer) per person, stored in `rmr_settings.comp_family` and audited. It never moves anyone by itself: once that family has a published version an **Assign / Switch to** button appears (start date defaults to the later of today and the version's effective date; a switch end-dates the current assignment). The agreement's *Assigned to* field shows the owner's comp plan and notes that changing owner never moves already-earned commission (AGR-04). |
| 5 Payout run | Quarter view now opens with the **payout run**: cutoff, payout-critical feed health, every amount as *Ready to pay*, *Pending verification* or *Excluded from this run* with its reason; blocking is per amount. *Approve & export* records the run, writes earned + payable ledger entries for revised events, records exclusions and downloads the payroll CSV. Documented override (VIS-08) on the Billing tab's evidence form. |

## P1RMR-57 — usability pass (3 Oct 2026)

| Change | What it does |
|---|---|
| **Close the deal** | *Win* (or *Set up deal* on the Worklist) opens one screen: agreement #, owner, MRR, term, dates, direct costs, with a live margin and commission preview. **Approve & record sale** saves the agreement, locks the cost version and records the New sale in one click (was ~14 clicks across four tabs). *Save without recording* is still available; such agreements go on the Worklist as *Sale not recorded yet*. |
| **Rep Mark won** | Reps click *Mark won* (signed date, final $/mo, note). The admin gets a *Deal won — set up the agreement* Worklist item; both lists show *Won — awaiting setup*; the item closes when the agreement is set up. |
| **Payment-state Quarter view** | Revised deals show *Payment 1 / 2 of 2* as Expected / Earned / Approved for payroll / Paid with a plain reason — no "Payable" before a payment is earned, no Mark-paid on revised deals. Cards: This quarter · Earned, not paid · Expected · Paid out. Payout run moved above the quarter picker and titled for the quarter it covers; reps see a one-line *Next commission payment*. |
| **Rep read-only agreements** | *My agreements ▸ View* shows terms, the two payments, their status and what each is waiting on. |
| **One-step onboarding** | Admin ▸ Employees ▸ *Add an employee*: email, role, comp plan, start date, salary, temporary password → user, comp plan, salary record, plan assignment (if published) and login in one action. First sign-in asks the person to choose their own password, then to accept the plan terms. A signed-in login that isn't on the employee list sees "Your account isn't set up yet". |
| **Rep screens** | Reps see My pay · Opportunities · My agreements · Pending Renewals · Payment history. Requirement codes removed from on-screen text. Dates default to the Pacific business day. |
| **migration_v23_access.sql** | Only listed employees can read or write; reps see only their own agreements, commission, salary and assignment; payout runs and the audit trail are manager-and-above. Adds the first-sign-in password flag and the two new Worklist types. Tested on PostgreSQL 16 (member/rep/manager/stranger cases). |

## Test results

- `node tests/acceptance.test.js` — **51 / 51** section 13 calculation and import tests (engine + parsers).
- `node tests/ui.test.js` — **39 / 39** headless tests of the real page against an in-memory Supabase (boot, fail-closed, publish → assign → acknowledge → calculate, event creation, ledger immutability, imports, Worklist, payout run, no page errors).
- Migration run twice on PostgreSQL 16: identical control totals on the second run; publication, immutability, placeholder-assignment, overlap and RLS guards verified.

## Migration notes (`migration_v22_spec27.sql`)

Additive only. First run copies every tracker table to `bk_v22_*` (no API access). Records `rmr_users.permission_role` with `role_migrated_from`. Seeds Hybrid v1 draft + Hunter/Farmer placeholders. Snapshots every old preset to `rmr_plan_history` (immutable) and archives them (rows kept). Preserves every original billing-log status in `rmr_billing_log_audit_v22`. Flags Vista-loaded agreements `historical_import`. Records an explicit grandfather rule for pre-2026 agreements and puts each on the Worklist for approval. Opens a Worklist item per agreement with auto-paid rows. Control totals before the change: `docs/v22_control_totals_before.md`.

**MIG-08 answer:** 875 billing rows ($223,113.94, 144 agreements) were marked paid only because their date passed. Commission released on them: $5,402.06 expected across 10 agreements; **paid: $0.00** — a clean fix, not a reconciliation project.

## Data exceptions to review

- 10 agreements (144–162) whose deferred piece was dated off auto-paid rows — now *Pending verification* until collection is verified on the SM Agreements Invoices tab.
- Pre-2026 grandfathered treatment recorded from activation date — approve or correct each Worklist item (AGR-03).
- 3 live agreements with no cost data — now blocked as unknown margin until costs are entered or confirmed $0.
- Owner-change inventory: count from the audit log is shown in Admin ▸ Data inventory; anything before the audit log began is reported as **unknown**.

## Rollback

1. App: re-upload the previous `index.html` from GitHub history (commit before this one). The old app ignores every new table and column.
2. Database: nothing needs reversing for the old app to run. Do **not** restore `bk_v22_*` over live tables if any payment or event was recorded after deployment (REL-05) — reconcile instead. If a full revert is required: `update rmr_commission_plans set archived=false;` restores the old plan list; new tables can stay.

## Admin guide (short)

- **Versions** — Admin ▸ pick a family. A draft can be edited and saved freely; nothing live changes. *Preview calculation* shows reference cases and before/after on 2026+ agreements and writes nothing. *Publish version* needs complete rules, an effective date on or after 4 Oct 2026, the approver, the 48-month confirmation and the written-terms confirmation. A published version is frozen; *Edit* opens the next draft.
- **Assign** — Employees ▸ *Assign plan* (published versions only; Hunter/Farmer are refused while placeholders). The employee then sees the acknowledgement screen at sign-in; nothing calculates under the version until they accept.
- **Receipts** — Billing & Files ▸ *Verify collection* per invoice, copying total amount / total paid / status from Vista's SM Agreements ▸ Invoices tab (or an Export Grid file). Total paid ≥ amount → *Cash confirmed*. Overrides need an approver, reason and evidence.
- **Adjustments** — never edit an earned or paid figure. Ledger tables are append-only; corrections are new linked entries.
- **Placeholders** — Hunter and Farmer can hold draft inputs; they stay non-assignable until a complete version is published.

## Sample sale-to-payment trail (from the UI test)

Agreement #201, 36 months, $1,000 MRR, modelled margin 73.3% → Hybrid v1 published (effective 2026-10-04, approved Sean Bithell) → assignment approved → acknowledgement stored → cost version v1 approved & locked → *New sale* event `…|new_sale|2026-10-20|36`, total $1,000.00 → qualified T1 $500.00 / T2 $500.00 → first invoice imported from SM Invoice List, collection verified → T1 earned → payout run approved → earned + payable entries written, payroll CSV exported.

## Not built in this release (honest gaps)

- **Server-side calculation (TEC-03).** The engine runs in the browser; the database enforces immutability, uniqueness, publication/assignment rules and role permissions, but does not recompute amounts. A Supabase Edge Function wrapping `engine27.js` is the next step.
- Multi-recipient **credit share entry UI** — the data model, validation and ledger allocation exist; events currently credit 100% to the owner.
- Attaching a **countersigned plan copy** to the employee record.
- **Confirm disbursement** (*Paid* stage) after payroll runs; a weekly CST-13 escalation report; the FIN-01 employer-cost dashboard (inputs are stored in `rmr_settings`).
- **Scheduled file delivery** has its code path (`P1Import.scheduled`) but needs a delivery mechanism (e.g. a scheduled task dropping files).
- Accounting export owner: Administrator role (sean.bithell@point1.com), recorded in Admin ▸ Payout calendar & feed owners for all five feeds. Backup: any Executive (Don Jones, Shane Stoltenberg).
- Business items still open per the spec: VIS-07 join-key choice, Vista report #94 access.

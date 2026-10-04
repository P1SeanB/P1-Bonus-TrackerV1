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

## P1RMR-58 · Layout B and Point 1 branding

- **Brand:** Point 1 logo and colors from the company email signature (navy #22438A, orange #F27123, ink #242424, slate #5B6478, rule #DFE4EC). Reversed logo on the side menu; full-color logo on the approval packet.
- **Frame:** dark navy side menu with sections, a page title and one-line description on every screen, cards with soft shadows, bolder titles, figures in DM Mono.
- **Admin & Executive menu:** Today (home) · Pipeline · Agreements · Renewals · Payouts · Worklist · Vista imports · Reports section · Admin.
- **Rep menu:** My pay · Pipeline · My deals · Renewals · Payment history · My plan.
- **Today:** next payout, money waiting on customer payments, open worklist, renewals due, and a "due soonest" list with a button to each job.
- **Payouts in five steps:** import → verify → print approval packet → record Executive approval → pay & lock.
  - The packet PDF is numbered from its exact contents. If anything changes after printing, the old number is refused and a new packet must be signed.
  - Only Executives can be recorded as approvers, and the signed scan is required.
  - Payments the preparer verified by hand on their own deals are flagged [!] in the packet.
  - The payroll file unlocks after approval. "Mark paid & lock" takes the payroll date, writes the paid entries and locks the quarter.
- **Vista imports page:** the five slots with their "How do I get this file?" dropdowns, plus the feed status and next deadline.
- **Rep My pay:**
  - next payment, waiting on payment, expected later, paid to date
  - commission-by-quarter chart (expected / earned / paid)
  - deal estimator
  - My payments, with a "Question this" link on each row
  - My questions, which shows the admin's answer
- **Mark won:** a rep can't send a deal as won until the signed contract is attached. It's stored on the deal's files.
- **Database:** run `migration_v24_payouts.sql` once. It adds:
  - the packet, signature, paid and lock columns on payout runs, guarded once locked
  - the rep-question worklist type
  - upload permissions for contracts and signed scans
- **Tests:** `node tests/payout.test.js` (26 checks, end to end at a fixed date), plus the existing acceptance (51) and UI (50) suites.

## P1RMR-59 · Vista imports read the real exports (verified against live Vista, 2026-10-03)
Pulled SM Invoice List, SM Agreement List and SM Work Order Profitability Detail from Vista (Company 2) and ran them through the importers. All three were rejected by P1RMR-58. Fixed:
- **SM Invoice List**: "Customer # / Name" exports as two cells, so every column from Customer onward sits one to the right (Invoice and Status do not). Detected and handled; customer stored as "647 Santo Office". Post Month stored as YYYY-MM. Footer (`…SMInvoiceList.rpt`) and Grand Totals skipped. Service Site and Work Order are report *filters*, not output columns — the misleading echo flag was removed.
- **SM Agreement List** is a grouped report (Customer / Agreement / Term group rows, then positional revision rows). Now read as printed. Blank dates print as 12/30/1899 and are stored as empty. Future revisions print as "Active ( as of 11/15/26 )".
- **SM Work Order Profitability Detail** is grouped (Agreement / Work Order / Line Type). With Group by left blank Vista groups by Agreement; that grouping now ties each cost line to its agreement directly. Totals for Agreement, Grand Total, footnotes and footer skipped.
- **Worklist noise and invoice linking**: an unmatched invoice is suggested only when it fits a tracked agreement's billing row that has no invoice number — same Vista customer (from the Agreement List), same amount, within 15 days, nearest row, each row claimed once. Suggestions are grouped **one Worklist item per agreement** with a **Link invoices** button (Administrator/Executive) that writes the invoice numbers onto those billing rows, maps the Vista invoices, audits the change and closes the item. Invoices that fit more than one agreement of the same customer are grouped one item per customer for a by-hand check. T&M/project invoices are stored for reference only. Live run: 1,642 matched, 365 linkable on 105 agreements, 234 ambiguous, 1,160 not agreement invoices. Agreement List: one item per agreement that is Active in Vista but missing from the tracker. Posted cost: only agreement lines with an unresolved classification.
- Import slots now ordered Agreement term history → Invoices → Receipts → Posted cost (the Agreement List supplies the Vista customer number used for invoice matching). How-to text rewritten from the live run.
- Tests: acceptance 55 (four new, built from the real layouts), ui 54 (grouped Agreement List import, per-agreement suggestion, Link invoices), payout 36.

## P1RMR-60 · Contract terms, renewals and Hybrid v2 for every agreement
Requested by Sean, 2026-10-03. Needs **migration_v27_terms_renewals.sql**, then a fresh SM Agreement List import.
- **Vista terms** (src/renew27.js): the Agreement List importer keeps each revision's contract term (Term rows), total term price and amount billed. A new term is a renewal; a revision inside a term is a rate change; a term terminated early and replaced is a rewrite. Monthly rate = (revision price − amount billed earlier in the term) ÷ months to its expiration — matches the tracker on 141 of 154 agreements. A term within one month of a standard term counts as that term (co-terminous stub months). Rates within 60¢ of the agreement price use the agreement price.
- **Renewal type** follows the current term: 12 months → manual, longer → auto. An Administrator can switch it on the Renewals page for the current term; the switch lapses at the next term.
- **Engine**: with the plan switch `autoRenewalPaysIncrease`, an auto-renewal or rate increase pays only the increase (over the highest rate already commissioned) at the new-sale multiple for the term; decreases pay nothing and take nothing back. Manual renewals unchanged (0.25× retained + increase at the new-sale multiple). Event types `auto_renewal` and `rate_increase` added.
- **Hybrid v2 switches** on the plan version (Admin ▸ Agreements & renewals panel, written into the terms the rep acknowledges): `appliesToAllAgreements` (every agreement of the assigned rep, any sale date), `paidThrough` + `paidThroughApprovedBy` + `paidThroughNote` (everything dated on or before it is marked paid by manager override, margin waived; the margin rule governs everything after).
- **Payouts, My pay, quarter view, agreement view** read one line per event × payment (Sale / Renewal / Rate change · Payment n of 2). Override-paid history never enters a payout run. Approvals write the ledger against the event the line came from.
- **Renewals page**: contract terms table (original start, renewals, current term, renewal type switch, Vista monthly rate, last change); "Update agreements from Vista" preview + Apply (original start, current term, term months, renewal type; rate and ended-in-Vista differences are flagged, not changed); "Commission events" list with Record (locks the cost version used). The legacy renewal screens hide once Hybrid v2 covers the book.
- Tests: acceptance 60, ui 54, payout 36, renewals 34 (new).
- **Live conversion, 2026-10-04** (Sean's go-ahead): migration v27 run; Agreement List re-imported with terms; 133 agreements updated from Vista (original start, current term, term months, renewal type) and audited; corrections per Sean recorded and audited (#62 ended 1/31/25 → #122 $243 auto; #143 ended, lives as #157; #103 $1,005.82 custom-billed manual; #67 $115 with the $79 increase sold 7/21/26 on a 36-month basis; #90 $1,725 consolidation of 89/90/91 read as a 12-month manual renewal from $625; #150 commission basis $329). Rate formula refined (months billed; SLA annual value; pre-Vista agreements take the agreement rate when it divides Vista's price into whole months) — 152 of 154 match, the other 2 carry recorded adjustments. Hybrid v2 published (effective 2026-10-05; appliesToAllAgreements, autoRenewalPaysIncrease, paid through 2026-06-30 by manager override, self-approved by Sean Bithell), assigned to Sean and acknowledged by him. 10 events from Q3 2026 recorded: $1,938.96.

## P1RMR-61 · Earning rules: marked sold and net 60 (Hybrid v3)
- New plan switches in Admin ▸ Payment rules, written into the terms the rep acknowledges:
  - `tranche1Trigger: 'marked_sold'`: Payment 1 is earned once a Manager, Executive or Administrator marks the sale sold (records its commission event) and it meets the margin rule. It counts in the quarter of the sale date. No invoice is needed.
  - `tranche2Trigger: 'first_invoice_collected'` with `tranche2ExpectDays` (60): Payment 2 is earned when the first invoice of the sale, renewal or rate change is paid. Payment is expected within 60 days of the invoice date. If it is paid later, Payment 2 is earned on the day it is paid and flagged late.
  - The older `'invoice_issued'` trigger is still available.
- Rep views (My pay KPIs, How you're paid), the agreement drawer and the recorded-event snapshot describe the rules of the rep's own version.
- Tests: acceptance 66, ui 54, payout 36, renewals 41.
- **Live, 2026-10-04:** Hybrid v3 published, effective 2026-10-06 and approved by Sean Bithell. It is v2 plus the two triggers. sean.bithell@point1.com runs on v2 from 10/05 to 10/06, then v3 from 10/06. v3 needs Sean's acknowledgment before it calculates.

## P1RMR-62 · Deals, Customers and the hunt list
- **Deals** replaces Pipeline + Agreements in the menu: one list through Opportunity → Quoted → Signed → Sold, with purple stage chips (payment colors unchanged), a search box, stage pills and an "All agreements ▸" link to the flat list. A deal leaves Deals once every payment is paid; a Vista renewal or rate change brings the agreement back as its own labeled row. Reps see the same page scoped to their own deals.
- **Customers**: every customer with its agreements beneath it (ended collapsed), consolidation and transfer notes, per-customer flags for past-net-60 invoices, renewals due within 60 days and open commissions. Customer numbers fall back to the Vista Agreement List grouping when the tracker has none.
- **Agreement window** reordered around the commission chain: Overview (dormant fields hidden) · History (Vista timeline) · Commissions (every payment with who marked it sold) · Commission ledger · Invoices (net-60 dates; the invoice Payment 2 depends on is highlighted) · Costs & margin · Files.
- **Lost and cancelled**: the lost flow asks for a coded reason and an optional revisit date (the deal returns to Deals that day with a Revisit tag); the Lost pill doubles as the hunt list of lost quotes and cancelled accounts. Opportunities gain a Source field.
- **Sales reports** on the Reports page: win/loss and win rate, new + increase RMR booked, churn by quarter, and the live pipeline by stage, with the stage-tracking data limit stated. A shared period filter (quarters, YTD, last year, custom) applies to the hunt list and commission history.
- **migration_v28_deals.sql** adds source, lost_reason_code, revisit_date, cancel_reason and stage_dates; until it runs the app saves without those fields and says so.
- Tests: new deals suite (30); acceptance 66, ui 54, payout 36, renewals 41 — 227 in all.
- Admin & Executive user guide republished (Deals and Customers section; Hybrid v3 earning rules).

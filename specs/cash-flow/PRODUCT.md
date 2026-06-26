# Cash-Flow Ledger — PRODUCT.md

**Slug:** `cash-flow` · **Pillar:** ② 現金流追蹤 · **Status:** Phase 0 COMPLETE — decisions folded; ready for Phase 1 (UX)

> WHAT + WHY only. Data model, entry UI, recurring-entry mechanics, active/passive
> attribution math, and any roll-up wiring are deferred to `TECH.md` / `UX.md`.
> The six Phase-0 Open Questions are now resolved (see `## Decisions`); this spec
> states the product scope they fix, not how to store or build it.

---

## Problem

retire-inv tells a household *what they have* (pillar ①) and *whether they can retire*
(pillar ③), but it cannot tell them **where their money goes month to month** — pillar ②
is the project's single biggest gap (`PRODUCT_SPEC.md` §5.2, §6.A: "○ Largely missing").
Today "income" is one planning input — `inp.salary` (月薪) × `inp.investRate` (薪資投入比例),
all of it implicitly active salary; there is no concept of 被動收入 (a grep for
被動/passive/股利/租金/利息/transaction across `index.app.js` returns **zero** matches).
"Expense" is never tracked: the planner uses an aggregate retirement `withdraw0`, and
保障檢查 *guesses* monthly living cost as `salary × 0.6` (`index.app.js:1601`) — a literal
NO-GUESS violation that a real ledger should replace. The household manager who wants to
know their real savings rate, see how much of their income is passive (the FIRE signal),
or feed actual expenses into the retirement target has nowhere to do it.

## Users

**Primary — 家庭財務管理者 (household financial manager).** Maintains the family's whole
financial picture and makes planning decisions on the family's behalf (`PRODUCT_SPEC.md` §2.1).
They already enter salary, holdings, pension, and run the 保障檢查 / 退休試算; the ledger is the
missing layer between "我有多少資產" and "我能不能退休".

**Real scenarios:**

1. **Find the real savings rate.** Today the manager *types a guess* into 薪資投入比例 (%).
   With a ledger they record actual monthly income and expenses and read back the real
   net-savings figure, instead of hand-tuning `investRate`.
2. **Track the passive-income climb (the FIRE signal).** A FIRE-minded manager wants to watch
   被動收入 (股利 / 租金 / 利息) grow toward the point where it covers living expenses — the
   substance of Barista/Coast FIRE — which the app can model in pillar ③ but cannot currently
   *measure* because no passive-income data exists.
3. **Replace the living-expense guess.** 保障檢查's emergency-fund and 壽險缺口 math both hinge
   on `monthlyExpense`, currently seeded as `salary × 0.6`. The manager wants that driven by
   their *actual* recorded spending, not a multiplier.
4. **Spot where the money goes.** Mid-year, the manager reviews recent months to see which
   expense buckets are eating the budget and whether this month's net cash flow was positive.

## Success Criteria

EARS format. Each is observable/testable and principle-checked. All Phase-0 Open Questions
are resolved (see `## Decisions`); the criteria below are now concrete.

- **SC1.** WHEN the manager opens the 現金流 page, the system SHALL display the household's
  recorded income and expense for the active period and the resulting **net cash flow**
  (收入 − 支出) for that period.
- **SC2.** WHEN the manager records income, the system SHALL capture **主動收入 (salary)** and a
  single **被動收入 (passive)** bucket (股利 / 租金 / 利息 lumped together), and SHALL show the
  active and passive subtotals separately. *(Pillar ② core: the active/passive split is mandatory,
  not optional.)*
- **SC3.** WHEN the manager records expense, the system SHALL classify it into the fixed
  categories **居住 / 飲食 / 交通 / 教育 / 醫療 / 其他**, and SHALL display total expense for the
  active month.
- **SC4.** WHEN income and expense exist for the active month, the system SHALL display the **net
  savings rate** (net cash flow ÷ total income) as a derived figure, **labelled an estimate
  based on the manager's own entries** (P3 — no advice, no implied precision).
- **SC5.** WHEN the manager records cash flow for a month, the system SHALL treat it as a
  **monthly budget snapshot** for the active month, allowing per-month overrides — not a dated
  per-transaction history.
- **SC6.** WHEN the manager has recorded no cash-flow data, the system SHALL show an empty
  state that explains the page and offers a first entry — never a fabricated or sample number
  (P2 NO-GUESS; the page MUST NOT seed `salary × 0.6`-style guesses).
- **SC7.** WHEN cash-flow data is created or edited, the system SHALL persist it **locally only**
  (browser `localStorage`, like 保障檢查) and SHALL NOT transmit it anywhere — there is no cloud
  sync for cash-flow data in v1 (P1 privacy / local-first).
- **SC8.** WHEN any monetary figure is displayed, the system SHALL use the app's zh-TW 萬
  convention and `zh-TW` number formatting, consistent with existing pages (P8). 主動/被動 and
  category labels SHALL be Traditional Chinese (台灣).
- **SC9.** WHEN net cash flow is negative for the active month, the system SHALL surface it
  with a non-color cue (sign/arrow/label), not color alone (P7), matching the existing
  gain/loss (`up`/`down`) treatment.
- **SC10.** WHEN the ledger holds income/expense data, the system SHALL **suggest** (a) net
  savings to the Planner's monthly-invest basis, (b) 被動收入 to the retirement withdrawal offset,
  and (c) total living expense to 保障檢查's `monthlyExpense` (`index.app.js:1601`) — *each as a
  one-way, manager-reviewable suggestion the manager accepts, never silently overwriting a
  planning input* (P3).

## Pillar Alignment

**Primary — Pillar ② 現金流追蹤.** This feature *is* pillar ②: the dated/period income+expense
record with the 主動/被動 income split called for in `PRODUCT_SPEC.md` §1, §5.2, and the
Phase-1 roadmap (§6.B "highest-leverage gap"). It introduces the **Cash-Flow Ledger** entity
(§3.B, marked `○ Planned`).

**Composes with what's built** (all three feeds below are in v1 scope as one-way, accepted
suggestions per decision **e2** — never silent overwrite):

- **→ Pillar ③ (退休目標→配置).** 被動收入 is suggested as an offset to required retirement
  withdrawals — the substance of Barista FIRE (`FIRE_TYPES`, `simulate`'s barista offset) and
  Coast. Today that offset is a hand-entered guess; the ledger makes it a measured, manager-
  accepted input.
- **→ Planner monthly-invest.** The planner derives `monthlyInvest = salary × investRate%`
  (`index.app.js:903`) from a *guessed* savings rate. The ledger suggests its measured net-savings
  figure as the honest input, which the manager reviews and accepts.
- **→ 保障檢查 (Pillar ①, P6).** `monthlyExpense` is currently seeded `salary × 0.6`
  (`index.app.js:1601`). The ledger's actual living expense is suggested as the correct source,
  removing a NO-GUESS smell — accepted by the manager, never silently written.
- **→ Pillar ④ (定期追蹤).** A dated transaction history (vs this feature's monthly snapshot — see
  decision **d1**) is the raw material for tracking cash-flow trends over time alongside the
  planned tracking baseline. Out of scope here; noted as composition (belongs to `specs/tracking/`).

## Scope: Included

- The 現金流 page (new `PAGES` entry) as the home of pillar ②.
- Recording **household income** as **主動收入 (salary)** plus a **single 被動收入 bucket**
  (股利 / 租金 / 利息 lumped), with active vs passive subtotals shown.
- Recording **household expense** across the fixed categories **居住 / 飲食 / 交通 / 教育 / 醫療 /
  其他**.
- A **monthly budget snapshot** time model (current month, optional per-month overrides).
- **Manual + recurring/scheduled** entries (lines that repeat monthly, e.g. salary, rent).
- A derived, clearly-labelled **net cash flow** and **net savings rate** for the active month.
- One-way **suggested** feeds the manager reviews and accepts: net savings → Planner monthly-invest;
  被動收入 → retirement withdrawal offset; living expense → 保障檢查 `monthlyExpense`.
- **Local-only** persistence (`localStorage`), no cloud sync for cash-flow data.
- Empty / first-run state that never fabricates numbers (P2).
- zh-TW microcopy, 萬 formatting, non-color cues for negative flow (P7/P8).

## Scope: Excluded

- **Bank / brokerage / open-banking auto-import or account linking.** No live financial-account
  connections — they'd break the local-first, no-PII-in-source privacy story (P1) and add a
  backend dependency (P4). The ledger is sourced by manual + recurring entry only.
- **Excel / `.xlsx` import (deferred fast-follow).** Attractive given the existing XLSX parser in
  上傳分析, but it's added entry-surface and TECH scope; v1 ships manual + recurring entry, and
  import lands as a fast-follow (decision **c2**).
- **Full multi-stream income (future).** v1 records salary + one passive bucket; per-source streams
  (薪資 / 獎金 / 兼職 / 股利 / 租金 / 利息 / 其他 each tagged 主動/被動) are a noted future extension
  layered on top (decision **a1**).
- **Dated per-transaction history.** v1 is a monthly snapshot (decision **d1**); a dated history
  where periods roll up from individual transactions belongs to pillar ④ tracking (`specs/tracking/`),
  not this feature.
- **Automatic, silent mutation of planning inputs.** The e2 feeds are *suggestions only*: the
  ledger MUST NOT overwrite `salary`/`investRate`/`withdraw0`/`monthlyExpense` without the manager
  seeing and accepting it — silent overwrite would be advice-shaped and erase the manager's
  intent (P3).
- **Budgeting / advice / overspend nudges.** No "you're spending too much," no recommended
  budgets, no category targets-as-advice. The product reports estimates, it does not advise (P3).
- **Tax computation from cash flow.** Income tax / 綜所稅 modelling is not in pillar ② and is its
  own NO-GUESS minefield; excluded.
- **Multi-member per-person attribution.** Per-family-member income/asset attribution is tied to
  the `Planned` viewer/secondary-user work (`PRODUCT_SPEC.md` §2.2, §6.B Phase 3); this ledger is
  household-level. Excluded here.
- **Multi-currency cash flow.** Holdings already handle FX via quotes; the ledger is single-
  currency (NTD/萬) to match the planner. Excluded.
- **The tracking dashboard / plan-vs-actual drift (pillar ④).** Belongs to `specs/tracking/`.
- **Supabase / cloud sync for cash-flow data.** v1 is local-only (decision **f1**). A future opt-in
  Supabase sync (matching `inv_plans`) is out of scope here **and** is gated on first fixing the
  RLS-off gap — `inv_plans` currently runs **RLS off** (`index.app.js:81`) — before this most-
  sensitive data may live in the cloud (a constraint to carry into `TECH.md`).

## Decisions (resolved 2026-06-26)

The six Phase-0 forcing questions were answered by the user accepting the recommended options:

- **a1 — Income scope:** salary (主動) + a **single 被動 bucket** (股利 / 租金 / 利息 lumped). Full
  multi-stream (a2) is a noted future extension (see Scope: Excluded).
- **b2 — Expense granularity:** fixed categories **居住 / 飲食 / 交通 / 教育 / 醫療 / 其他**.
- **c2 — Entry model:** **manual + recurring/scheduled** entries. Excel/`.xlsx` import (c3) is
  **deferred** to a fast-follow (see Scope: Excluded).
- **d1 — Time model:** **monthly budget snapshot** (optional per-month overrides). Dated transaction
  history (d2) belongs to pillar ④ tracking.
- **e2 — Integration:** one-way **suggested** feeds the manager reviews and accepts — net savings →
  Planner monthly-invest; 被動收入 → retirement withdrawal offset; living expense → 保障檢查
  `monthlyExpense` (`index.app.js:1601`). Never silent overwrite (stays in Scope: Excluded).
- **f1 — Privacy / sync:** **local-only** (`localStorage`), no cloud sync for cash-flow data in v1.
  Future Supabase sync (f2) is out of scope and gated on first fixing the RLS-off gap (`inv_plans`
  runs RLS off, `index.app.js:81`) — a constraint to carry into `TECH.md`.

## Open Questions

None remaining — all six resolved above.

---

*Drafted by `product-spec-drafter` (Phase 0). Phase 0 COMPLETE — decisions folded; ready for
Phase 1 (UX). No data model, no component design, no library/tech choices here — those are
TECH.md's / UX.md's job.*

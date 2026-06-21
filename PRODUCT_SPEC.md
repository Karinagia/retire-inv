# 家庭資產管理系統 (Family Asset Management System) — Product Specification

**Project Name:** retire-inv (家庭資產管理系統)
**Purpose:** A privacy-first, zero-backend web application that helps a household organize all of its financial assets, track its cash flow, set retirement goals, and continuously track the chosen plan against those goals — investment performance, goal drift, and risk.

> **Status of this document.** This is the *first* PRODUCT_SPEC for the project. The codebase began life as a 退休/FIRE 試算工具 (the FIRE calculator, now pillar ③ below) and is being grown into a full household asset-management system. This spec states the target product across all four pillars, records what is **built today (v1.7)**, and marks gaps as `Planned`. Per-feature detail beyond this document is deferred to follow-on `specs/<feature>/PRODUCT.md`.

---

## 1. Vision & Goals

The system gives a household a single place to answer three questions: **What do we have? Where is our money going? Are we on track to retire the way we want?**

The product is defined by **four pillars** (the stated requirements):

* **① 資產數據整理 (Asset Data Organization)** — organize data across every household asset type, including but not limited to 薪資收入 (salary income), 保險 (insurance), and 投資 (investment).
* **② 現金流追蹤 (Cash-Flow Tracking)** — track household cash flow: 支出 (expenses) and 收入 (income), where income is split into 主動收入 (active income) and 被動收入 (passive income).
* **③ 退休目標與配置計劃 (Retirement Goal → Allocation Plan)** — let the user set a retirement goal and, based on that goal, offer different asset-allocation plans.
* **④ 定期追蹤 (Periodic Tracking)** — for the allocation plan the user chose, periodically track 投資績效 (investment performance), 是否偏離退休目標 (drift from the retirement goal), and 風險評估 (risk assessment).

### Design Principles

These principles are referenced as **P1–P6** throughout the spec.

* **P1 — Local-first / zero-backend.** The app runs from a single `index.html` opened in a browser (or served as a static site). No backend is required. Third-party libraries (React, Chart.js, XLSX) load from CDN; application logic lives in `index.app.js`.
* **P2 — Privacy by default.** Household financial data lives in browser `localStorage`. Cloud sync (Supabase) and live quotes (Twelve Data) are **opt-in**, using credentials the user enters in 設定; those credentials live only in `localStorage`. **No personal data or keys are committed to source** (`SEED = null` in `index.html`).
* **P3 — Estimates, not advice.** Every output is a planning estimate. 勞退/勞保/保險 figures are rough approximations of official rules. The product is **not** investment, tax, or insurance advice and says so (persistent disclaimer).
* **P4 — Transparent, testable math.** Every projection is a pure function with no React/DOM dependency, asserted in `tests/retire.test.js`. **Changing a formula MUST update the tests** — the tests are the executable contract for the calc engine (§5).
* **P5 — Inflation-real.** Long-horizon figures model inflation explicitly: retirement withdrawals, long-term-care shocks, and pension income all grow with the inflation assumption.
* **P6 — Foundation before growth.** Protect the base (emergency fund + basic insurance) before optimizing investment allocation. The 保障檢查 page encodes this ordering as an explicit 建議順序.

---

## 2. Users & Scenarios

The system has a single primary user — the **household financial manager** — who acts on behalf of the whole family. A secondary "viewer" mode (read-only sharing with a spouse/family) is `Planned`.

### 2.1 Household Financial Manager (Primary)

The person who maintains the family's financial picture and makes planning decisions. They enter the household's data, set the retirement goal, choose an allocation plan, and check in periodically to see whether the family is on track.

**Scenarios:**

1. **Set up the financial baseline.** Enter salary and income streams, current investments/holdings, pension contributions (勞退自提/勞保), children's education plans, debts, and existing insurance — so the system knows what the household has (pillars ① & ②).
2. **Stress-test the foundation.** Check that the emergency fund and life-insurance coverage are adequate *before* committing to long-term investment (保障檢查, P6).
3. **Plan the retirement target.** Set a target (retirement year/age, desired lifestyle), pick a FIRE style (Regular / Lean / Fat / Barista / Coast), and see the required assets and the allocation plan that reaches it (pillar ③).
4. **Track progress over time.** Periodically import or update holdings, refresh live quotes, and review whether actual assets are tracking the plan, whether the household is drifting from the retirement goal, and what the risk picture looks like (pillar ④).
5. **Sync across devices (optional).** Connect Supabase to persist plans beyond a single browser and review on another device (P2 — opt-in).

### 2.2 Family Member / Viewer (Secondary — `Planned`)

A spouse or family member who should be able to *see* the household plan and progress without editing it. Read-only sharing and per-member income/asset attribution are not built yet; deferred to follow-on PRODUCT.md.

---

## 3. Domain Model & Application Architecture

### 3.A Application Shape

retire-inv is a **single-page React application** delivered as two files:

* **`index.html`** — page shell, styles, CDN script tags, app constants. Holds `SEED` (seed data) which is `null` in source (P2). Title: 退休投資規劃系統.
* **`index.app.js`** — the entire application: React components, the calculation engine, and the data/persistence helpers. Mounted into `#root` via `ReactDOM.createRoot`.

Access is gated by a lightweight client-side login (`pwHash`, `Login`) backed by `sessionStorage` — a soft gate, **not** a security boundary (P2/P3: there is no server to enforce auth).

### 3.B Core Domain Entities

The data model the app reasons over (some entities are fully modeled today, some are `Planned` — see §6):

| Entity | Fields (representative) | Pillar | Status |
| :--- | :--- | :--- | :--- |
| **Household Profile** | current age, retirement age/year, inflation assumption | ③ | ✅ |
| **Income** | salary (月薪), salary growth (`salaryG`), 投資提撥率 (`investRate`) | ①② | ◑ active only; passive income & multi-stream `Planned` |
| **Expense** | monthly living expense, retirement withdrawal target | ② | ◑ single figures; no categorized expense ledger |
| **Holding / Position** | account, symbol, category (Stock/ETF/Bond/Cash), shares, market value | ①④ | ✅ |
| **Asset Allocation (Mix)** | per-category target % + preset plans | ③ | ✅ |
| **Pension** | 勞退自提 (`calcPension`), 勞保老年年金 (`calcLaborPension`) | ① | ✅ |
| **Education Plan (Kids)** | child age, public/private, per-stage cost | ① | ✅ |
| **Insurance Coverage** | emergency fund, life-insurance gap (雙十原則) | ① | ◑ gap analysis only; no policy inventory; medical/accident not modeled |
| **Insurance Policy (inventory)** | policy type, insured, sum assured, premium, term | ① | ○ `Planned` |
| **Cash-Flow Ledger** | dated income/expense entries, active/passive tag | ② | ○ `Planned` |
| **Retirement Goal** | target assets, FIRE type, target year/age | ③ | ✅ |
| **Tracking Snapshot** | dated net-worth / plan-vs-actual record | ④ | ○ `Planned` (live quotes exist; historical baseline does not) |

### 3.C Persistence

* **Browser `localStorage`** is the default store (P1/P2): app config (`CFG_KEY`), holdings quantities (`QTY_KEY`), symbol map (`MAP_KEY`), and saved planning inputs.
* **Supabase (optional)** — when the user supplies a URL + key in 設定, plans persist to a `inv_plans` table (`supaSelect`/`supaUpsert`/`supaReq`) so they survive across browsers/devices. Connection state is surfaced in the sidebar (本機模式 vs Supabase 已連線).
* **Twelve Data / TWSE (optional)** — live quotes and history for holdings, keyed by a user-supplied API key in 設定.

---

## 4. Interfaces (App Surface)

The app presents a left sidebar of pages (`PAGES`). Today there are **six** pages; planned pages for pillars ①② are noted.

### 4.A Current Pages (v1.7)

| Page | id | Icon | Role | Pillar |
| :--- | :--- | :--- | :--- | :--- |
| **規劃試算** | `plan` | 🧮 | Main planner: income, holdings, returns, allocation mix + presets, projected retirement assets, pension, education. Embeds sub-views 資產總覽 (Dashboard), 持倉配置分析 (Allocation), 即時行情 (Quotes). | ①③④ |
| **退休試算** | `fire` | 🔥 | FIRE calculator (5 types), goal reverse-solve, plus 進階退休分析 (Coast detection, 長照壓力測試, Monte Carlo). | ③④ |
| **保障檢查** | `protect` | 🛡️ | Foundation check: emergency-fund adequacy + life-insurance gap (雙十原則), with a recommended ordering (P6). | ① |
| **上傳分析** | `upload` | 📤 | Import an Excel workbook (holdings / tracker) via XLSX → parsed positions. | ① |
| **資產曲線** | `curve` | 📉 | Asset-growth projection over time (baseline vs conservative return). | ③④ |
| **設定** | `set` | ⚙️ | Supabase URL/key, Twelve Data key, app config. | — |

### 4.B Planned Pages (`Planned`)

* **現金流 (Cash Flow)** — income/expense ledger with 主動/被動 income split and expense categories (pillar ②). The single biggest gap.
* **保險 (Insurance Inventory)** — managed list of policies (type, sum assured, premium, term) feeding the 保障檢查 gap analysis (pillar ① — turns the current single-number input into a real inventory).
* **追蹤儀表板 (Tracking Dashboard)** — periodic plan-vs-actual: performance, goal drift, risk over time against a saved baseline (pillar ④).

### 4.C External Integrations

* **Supabase** (cloud persistence) — opt-in, user-supplied creds (P2).
* **Twelve Data** (live quotes / FX) and **TWSE** (monthly history) — opt-in, user-supplied key. Used by 即時行情 and holdings valuation.

All integrations degrade gracefully: with no creds the app runs fully in 本機模式 (local mode).

---

## 5. Core Features & Calculation Engine

This section maps each pillar to concrete features and to the pure calc functions that implement them. The functions listed are the ones asserted in `tests/retire.test.js` (P4) — they are the **authoritative behavioural contract**.

### 5.0 Core Money Model

The retirement projection is an annual loop from `age0+1` to age 100:

```
value = max(0, value − withdraw) × (1 + r) + invest
```

* `r` = `rWork` before the retirement year, `rRetire` from the retirement year onward.
* `invest` = `monthly × 12` while working, `0` after retirement.
* `withdraw` = `0` while working; after retirement = `withdraw0 × (1 + inflation)^(year − year0)` (inflation-adjusted, P5).

This is implemented by `simulate(p)` and is the spine of pillars ③ and ④.

### 5.1 Pillar ① — Asset Data Organization

* **Investments / holdings** — positions by account/symbol/category, live valuation via 即時行情, bulk import via 上傳分析 (`parseHoldings`, `parseTracker`, `calcStats`). **Status: ✅**
* **Pension** — `calcPension(inp, cap)` models 勞退自提 (monthly-compounded pot, employer 6%, self ≤6%, contribution cap default 150,000, tax-saving). `calcLaborPension(salaryWan, years)` models 勞保老年年金 (insured-salary cap 45,800; ≥15 years required; A式 = base×y×0.00775+3000, B式 = base×y×0.0155, take the max). **Status: ✅**
* **Education** — `eduStage(age)` / `eduCostYear(kids, cost, yOffset)`: per-stage cost (pre 3–6, elem 6–12, jun 12–15, sen 15–18, uni 18–22), public vs private. **Status: ✅**
* **Insurance** — 保障檢查 computes emergency-fund adequacy and a life-insurance gap from a single current-coverage input (雙十原則 reference). **Status: ◑ — no policy inventory; medical/accident insurance not modeled.**
* **Salary** — captured as a single planning input with a growth rate, **not** as a tracked time series. **Status: ◑.**

### 5.2 Pillar ② — Cash-Flow Tracking

A dated income/expense ledger with **active vs passive** income classification and expense categories. Today income exists only as a salary input and expenses only as aggregate figures (monthly living expense, retirement withdrawal). **Status: ○ `Planned` — the system's largest gap.** Design (data model, entry UI, recurring entries, active/passive attribution, roll-up into pillars ③④) deferred to `specs/cash-flow/PRODUCT.md`.

### 5.3 Pillar ③ — Retirement Goal → Allocation Plan

* **Goal setting & FIRE styles** — `FIRE_TYPES` (5): Regular ×1.0 (4% rule), Lean ×0.6, Fat ×1.8, **Barista** (part-time income offsets withdrawals until `baristaUntilAge`), **Coast** (stop contributing, compound existing assets to target). **Status: ✅**
* **Goal reverse-solve** — `coastYearsTo(asset0, monthly, r, target)` (years to reach a target; 0 if already there, `null` if unreachable within 70 yrs). Planner solvers `simToTarget`, `requiredSalary`, `requiredRate` back out the salary / savings rate / return needed to hit a target. **Status: ✅**
* **Allocation plans** — category target mix with named presets and a suggested mix; rebalancing deltas shown in 持倉配置分析 (current % → target % → 差額 → 建議). **Status: ✅**

### 5.4 Pillar ④ — Periodic Tracking

* **Performance** — live quotes + `calcStats`; 資產曲線 projects growth (baseline vs conservative). **Status: ✅ (snapshot).**
* **Risk** — `monteCarlo(p, vol, pensionAnnual, runs)`: each year's return ~ Normal(mean, vol); after retirement, government pension is netted out before withdrawal; returns `successRate` + p10/p50/p90 paths (`vol = 0` ⇒ deterministic). `mixVol(mix)` gives a weighted volatility estimate from the allocation. Long-term-care stress via `simShock(p, shock)` (adds an inflation-adjusted extra withdrawal over a shock window). **Status: ✅**
* **Goal-drift tracking (是否偏離退休目標)** — comparing *actual* assets over time against the *saved plan's* expected trajectory, with periodic check-ins and rebalancing alerts. The current model is one-shot projection, not tracking against a persisted baseline. **Status: ○ `Planned`** — needs the Tracking Snapshot entity (§3.B) and a saved baseline. Deferred to `specs/tracking/PRODUCT.md`.

### 5.5 Calc-Engine Function Catalog

| Function | Purpose | Pillar |
| :--- | :--- | :--- |
| `simulate(p)` | Core annual net-worth projection (incl. Barista offset) | ③④ |
| `simShock(p, shock)` | Long-term-care stress test | ④ |
| `coastYearsTo(...)` | Years to compound to a target (Coast) | ③ |
| `monteCarlo(p, vol, pensionAnnual, runs)` | Stochastic success-rate + percentile paths | ④ |
| `mixVol(mix)` | Weighted volatility from allocation | ④ |
| `calcPension(inp, cap)` | 勞退自提 pot accumulation + tax-saving | ① |
| `calcLaborPension(salaryWan, years)` | 勞保老年年金 (A/B 式取高) | ① |
| `eduStage` / `eduCostYear` | Education-cost by stage, public/private | ① |
| `simPlan` / `simToTarget` / `requiredSalary` / `requiredRate` | Planner projection & reverse-solvers | ③ |
| `FIRE_TYPES` | The 5 FIRE-style definitions | ③ |

---

## 6. Current Coverage & Roadmap

### 6.A Coverage Summary

| Pillar | Status | Built | Gap |
| :--- | :--- | :--- | :--- |
| ① 資產數據整理 | ◑ Partial | Investments, pension (勞退/勞保), education, basic insurance gap | Salary-as-time-series; insurance **policy inventory**; medical/accident insurance |
| ② 現金流追蹤 | ○ Largely missing | Aggregate salary in / expenses implied | **Income/expense ledger; active vs passive income; expense categories** |
| ③ 退休目標 → 配置計劃 | ✅ Solid | Goal, 5 FIRE types, reverse-solve, allocation presets | — (refinements only) |
| ④ 定期追蹤 | ◑ Half | Performance snapshot, Monte Carlo risk, LTC shock | **Plan-vs-actual drift over time; saved baseline; rebalancing alerts** |

### 6.B Phased Roadmap (proposed)

* **Phase 1 — Foundation data model.** Introduce the **Cash-Flow Ledger** (pillar ②) and **Insurance Policy Inventory** (pillar ①): a typed entity store in `localStorage` (+ Supabase tables), entry UI, and active/passive income tagging. This is the highest-leverage gap.
* **Phase 2 — Tracking baseline.** Persist a dated **Tracking Snapshot** and the chosen plan's expected trajectory; build the 追蹤儀表板 for plan-vs-actual drift and risk over time (pillar ④).
* **Phase 3 — Integration & roll-up.** Feed the ledger and policy inventory into the existing planner/FIRE/保障檢查 calcs (e.g., passive income reduces required withdrawal; real expenses replace the single living-expense figure), and add the read-only family viewer (§2.2).

Per-phase detail is deferred to follow-on `specs/<feature>/PRODUCT.md`.

---

## 7. Privacy, Safety & Non-Functional Requirements

| Concern | Requirement |
| :--- | :--- |
| **Privacy (P2)** | Financial data stays in the browser by default. Supabase/Twelve Data are opt-in with user-supplied creds stored only in `localStorage`. **No PII or keys in source** (`SEED = null`). |
| **No advice (P3)** | A persistent disclaimer states the tool is for personal planning reference only — not investment, tax, or insurance advice. 勞退/勞保/保險 figures are estimates; official figures govern. |
| **Math integrity (P4)** | All calc functions remain pure and Node-testable; `node tests/retire.test.js` must pass. Any formula change updates the tests in the same commit. |
| **Zero-backend (P1)** | The app must continue to run fully from a static `index.html` with no server, degrading gracefully when optional integrations are absent. |
| **Client-only auth** | The login gate is a convenience, not a security control — there is no server to enforce it. Sensitive sharing must not rely on it. |

---

*This PRODUCT_SPEC defines the target product and current coverage. Detailed feature designs (cash-flow ledger, insurance inventory, tracking dashboard) are authored as follow-on `specs/<feature>/PRODUCT.md`.*

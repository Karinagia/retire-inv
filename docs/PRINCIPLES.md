# retire-inv Principles

The non-negotiable design tenets retire-inv (家庭資產管理系統) is held to. Every agent reads
this. The product MUST exhibit each property below; drafters design for them, implementers
encode them, and the Phase-5 gates verify them.

These promote `PRODUCT_SPEC.md` §1's P1–P6 into enforced principles and add UI/UX tenets
(P7–P9) the GUI introduces.

## Meta-rule: NO GUESS

Build on facts. Code measures; it does not assume. Specs cite; they do not estimate.
Financial constants (勞保投保薪資上限, contribution caps, the 4% rule, tax brackets) cite an
authority — see the citation contract in `docs/STEERING.md`. "Done" means a passing test or an
observed screenshot, never "the command returned no error."

## Tiers

- **Tier 1 — blocking invariants (P1–P3).** Enforced by `calc-test-auditor` + `code-reviewer`.
  A Tier-1 failure blocks merge.
- **Tier 2 — design tenets (P4–P9).** Reviewer-enforced; the relevant Phase-5 gate warns.

---

## Tier 1 — Blocking invariants

### P1. Privacy / no-PII-in-source
- **Rule:** No personal financial data and no credentials in source. `SEED = null` in
  `index.html`. Supabase URL/key and Twelve Data key live only in browser `localStorage`,
  entered via 設定.
- **Why:** The repo is public-publishable; a leaked key or a real balance is unrecoverable.
- **Check:** `code-reviewer` / `calc-test-auditor` reject any diff that introduces a non-null
  `SEED`, a hardcoded key/URL, or a committed `*.sql`/`*.xlsx`/`passW.txt` (the `.gitignore`
  allowlist is the backstop).

### P2. Math integrity / NO GUESS
- **Rule:** Every change to a calc function ships with an updated/added assertion in
  `tests/retire.test.js`. Financial constants carry an inline citation to an authority
  (勞動部/勞保局/Trinity study/…). Bug fixes write the failing test first.
- **Why:** The product's whole value is correct money math; a silent formula regression is the
  worst failure mode.
- **Check:** `calc-test-auditor` runs `node tests/retire.test.js` (must be green) and confirms
  every touched formula has a corresponding test delta and every authoritative constant is
  cited. Blocks merge on red.

### P3. Estimates, not advice
- **Rule:** The product is planning *reference*, not investment/tax/insurance advice. The
  persistent disclaimer stays. No false precision (退休金/勞保/保險 figures are labelled
  estimates). No claim of guaranteed returns.
- **Why:** Legal + ethical; over-precise output misleads a real person about real money.
- **Check:** `code-reviewer` flags removed disclaimers, advice-shaped copy, or figures
  presented as certainties.

---

## Tier 2 — Design tenets

### P4. Local-first / zero-build
- **Rule:** The app MUST run by opening the static `index.html` — no backend, no bundler, no
  build step. Libraries load from CDN; logic is in `index.app.js`. A new build/backend
  dependency requires explicit justification recorded in the feature TECH.md.
- **Why:** Zero-build is the product's deployment + privacy story (P1). Dev-only tooling
  (Playwright for review) is allowed because it is never shipped and never required to run the app.
- **Check:** `code-reviewer` flags any added build step or runtime backend dependency.

### P5. Inflation-real
- **Rule:** Long-horizon money figures model inflation explicitly (withdrawals, LTC shocks,
  pension income grow with the inflation assumption).
- **Check:** `tech-spec-drafter` + `code-reviewer` verify projections aren't quoting nominal
  figures as if real.

### P6. Foundation before growth
- **Rule:** Surface the base (emergency fund + basic insurance) before optimizing investment
  allocation — the 保障檢查 建議順序 is load-bearing, not decoration.
- **Check:** `ux-flow-designer` preserves the ordering in any flow that touches it.

### P7. Accessible & responsive
- **Rule:** WCAG AA contrast on the dark theme; keyboard navigable; `focus-visible`;
  `prefers-reduced-motion` respected; no color-only encoding (gain/loss needs a non-color cue);
  44px+ touch targets; works mobile → desktop. Every screen specifies all interaction states:
  loading / empty / error / success / partial / disabled.
- **Check:** `a11y-auditor` (axe-core + Lighthouse + LLM judgment); `design-reviewer` confirms
  state completeness. High-risk widgets escalate rather than auto-fix.

### P8. zh-TW first
- **Rule:** UI and microcopy are Traditional Chinese (台灣). Numbers/currency use the app's
  萬 convention and `zh-TW` formatting. Chinese typography legibility is part of the a11y bar.
- **Check:** `ux-flow-designer` owns the microcopy standard; `design-reviewer` flags drift.

### P9. Design-token discipline (no AI-slop)
- **Rule:** Components reference design tokens (the `:root` CSS custom properties + `COLORS` /
  `CAT_COLOR` registries — see `docs/STEERING.md`), never raw hex/px. Semantic roles
  (gain/loss/neutral, chart series) are named, not ad-hoc. No "AI-slop" patterns (purple
  gradients, default 3-card grids, centered-everything, generic fonts).
- **Why:** A finance dashboard lives or dies on data-density legibility and trust; off-token
  one-offs erode both.
- **Check:** `design-system-steward` owns the token registry and reviews usage (grep for raw
  hex in component code); `design-reviewer` scores a separate **AI-Slop A–F** grade.

---

## What is NOT here (and where it lives)
| Concern | Lives in |
|---|---|
| Stack, repo structure, naming, token registry, citation tiers, harness | `docs/STEERING.md` |
| Dev-process rules (6-phase flow, gates, EARS, escalation) | `CLAUDE.md` |
| Which agent does what | `AGENTS.md` |
| Product requirements (the 4 pillars) | `PRODUCT_SPEC.md` |

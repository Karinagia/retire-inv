# retire-inv — DESIGN.md

The **design system narrative**: the aesthetic thesis, a mirror of the token registry, the
motion/density conventions, and the anti-AI-slop red-flag list. Owned by `design-system-steward`.

> **Source of truth split.** `docs/STEERING.md` holds the *canonical token table* (the machine-
> readable registry every drafter/implementer reads). This file is the *narrative*: why the system
> looks the way it does and the rules for extending it. **The two MUST stay in sync** — a token
> added here is added to STEERING in the same change. Tokens live in `index.html :root` (CSS custom
> properties) and `index.app.js` (`COLORS`/`CAT_COLOR`/`CAT_NAME`); this file describes them, it is
> not a second copy of the values to drift from.

---

## 1. Aesthetic thesis

retire-inv looks like a **dark, data-dense, finance-utilitarian dashboard** — closer to a trading
terminal or a banking back-office than a marketing site. The look is already shipped in
`index.html`; we keep it, we don't reinvent it.

- **Dark, low-glare canvas.** A near-black blue `--bg #0b0f17` with two raised surfaces
  (`--panel #121826` for cards, `--panel2 #1a2235` for inputs/raised rows) and a single hairline
  border `--line #243049`. Depth comes from these three flat steps, not shadows or glassmorphism.
- **Text is the interface.** `--text #e6edf3` for primary, `--muted #8b98ad` for labels, axes, and
  secondary copy. Numbers carry the meaning; chrome stays quiet so the data reads first.
- **System fonts, not a brand webfont.** `"Segoe UI","Microsoft JhengHei",sans-serif` — picked so
  zh-TW (Traditional Chinese, 台灣) renders natively and crisply. No Google-Font slop; the font is a
  utility, not a decoration.
- **Compact, money-grade density.** 14px base, 12–12.5px labels, ~21px KPI numerals. Cards are
  `border-radius:12px` with 14–16px padding; KPI/section grids auto-fit at ~165–190px columns and
  wrap responsively with no new media code. The reading order is always **KPIs → sections → detail
  → suggestions** (see 保障檢查 / Planner). Single-scroll pages, not wizard steps.
- **One restrained accent.** `--accent #4f8cff` (blue) is *the* interactive/primary color — buttons,
  focus rings, active nav, links. Everything else is data color, not brand color.
- **Color is data, and never alone.** Gain/loss/category hues encode information, but always with a
  second, non-color cue (arrow, sign, ✓, label) — this is a hard rule (P7), not a nicety.

The vibe to protect: *a serious tool a 家庭財務管理者 trusts with real numbers.* Calm, legible,
unflashy, honest about estimates.

---

## 2. Token registry (mirror of `docs/STEERING.md`)

> Canonical values live in `index.html :root` + `index.app.js`. This is the narrative mirror —
> **if a value here disagrees with STEERING, STEERING wins and this file is the bug.**

### 2.1 Base tokens — CSS custom properties (`index.html :root`)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b0f17` | app background |
| `--panel` | `#121826` | card / panel surface |
| `--panel2` | `#1a2235` | raised surface / inputs / rows |
| `--line` | `#243049` | borders / grid lines |
| `--text` | `#e6edf3` | primary text |
| `--muted` | `#8b98ad` | secondary text / labels / chart axis |
| `--accent` | `#4f8cff` | **primary / interactive** (blue) |
| `--green` | `#2ecc8f` | **gain / up / success** |
| `--red` | `#ff5d6c` | **loss / down / danger** |
| `--gold` | `#f0b90b` | **warning / caution** |
| `--purple` | `#a78bfa` | **accent-2** |

### 2.2 Semantic roles

| Role | Token | Mandatory non-color cue (P7) |
|---|---|---|
| gain / up / 結餘 | `--green` | `▲` and/or `+` sign |
| loss / down / 入不敷出 | `--red` | `▼` and/or `−` sign, plus a word when it's a headline |
| warning / caution | `--gold` | a label / `⚠` |
| primary / interactive | `--accent` | (control affordance is itself the cue) |
| accent-2 / secondary category | `--purple` | a text label |
| accepted / success badge | `--green` | `✓` glyph |

**P7 is non-negotiable:** color is never the *only* carrier of gain/loss. The codebase already does
this — `mDelta>=0?'▲':'▼'` with the `up`/`down` classes (`index.app.js:116`), `✓ 終身不耗盡`
(`:220`), the `✓`/`✗` save toasts. New surfaces clone that pattern, they don't invent a color-only one.

### 2.3 Asset-category palette (`index.app.js` — `CAT_COLOR` / `CAT_NAME`)

| Category | Color | `CAT_NAME` |
|---|---|---|
| Stock | `--accent` `#4f8cff` | 個股 |
| ETF | `--green` `#2ecc8f` | ETF |
| Bond | `--purple` `#a78bfa` | 債券 |
| Cash | `--gold` `#f0b90b` | 現金 |

Rendered as the `.tag.<Cat>` pill idiom: a `rgba(<color>,.15)` tint background + the solid token as
text color (`index.html:51–57`). This pill recipe is the canonical badge/tag pattern — reuse it for
any new tag rather than inventing a new chip.

### 2.4 Chart series — the 10-color `COLORS` array (`index.app.js:11`)

```
['#4f8cff','#2ecc8f','#a78bfa','#f0b90b','#ff5d6c',
 '#22d3ee','#fb923c','#e879f9','#84cc16','#94a3b8']
//  blue     green     purple    gold      red
//  cyan     orange    magenta   lime      slate
```

The first five are exactly the base role tokens (accent/green/purple/gold/red); indices 5–9 are the
extension hues used for multi-series charts. **Chart defaults:** axis/legend text `#8b98ad`
(=`--muted`), grid `rgba(36,48,73,.6)` (≈`--line`), doughnut/bar borders `#121826` (=`--panel`).

### 2.5 Expense-category palette — `EXPENSE_CAT` (cash-flow feature)

A **named 6-color subset of `COLORS`** for the 現金流 支出（6 類） breakdown. Not a new palette —
it reuses established chart hues so the page stays on-system. See §5 for the full rationale.

| 類別 (key) | zh-TW label | Color (from `COLORS`) | Rationale |
|---|---|---|---|
| housing (居住) | 居住 | `#4f8cff` (blue / accent) | largest fixed cost → the anchor hue, COLORS[0] |
| food (飲食) | 飲食 | `#22d3ee` (cyan) | COLORS[5]; high-contrast vs blue, avoids gain/loss collision |
| transport (交通) | 交通 | `#fb923c` (orange) | COLORS[6]; distinct warm hue, not the `--gold` warn token |
| education (教育) | 教育 | `#a78bfa` (purple) | COLORS[2]; reuses the 債券/accent-2 hue, clearly separable |
| medical (醫療) | 醫療 | `#e879f9` (magenta) | COLORS[7]; distinct from red so it never reads as "loss/danger" |
| other (其他) | 其他 | `#94a3b8` (slate) | COLORS[9]; the neutral "catch-all" hue — semantically *other* |

**Deliberately NOT used here:** `#2ecc8f` green (reserved = gain) and `#ff5d6c` red (reserved =
loss). A spending category tinted gain-green or loss-red would misread against the page's own
淨現金流 color language. Labels are **always present** on every category (P7) — color is a secondary
aid, never the sole encoding.

---

## 3. Component idioms (reuse before you build)

These exist in `index.html` / `index.app.js`. New features compose them; they don't fork them.

- **Page shell:** `.page-title` + `.page-sub` (muted one-liner), then `.kpis`→`.card`s, single scroll.
- **KPI card:** `.kpi` › `.lab` (muted) / `.val` (21px bold) / `.sub` (12px). Gain/loss go on
  `.val`/`.sub` via the `up`/`down` classes (`.up{color:--green} .down{color:--red}`, `index.html:38`).
- **Card:** `.card` › `h3` + optional `<small>` (muted, weight 400). 12px bottom margin on the title.
- **Field grid:** `.field` › `label` (muted) + `input`/`select` (`--panel2` bg, `--line` border,
  `--accent` focus). The 保障檢查 expense rows are exactly this.
- **Tag / badge:** `.tag` pill = `rgba(token,.15)` tint + solid-token text (§2.3). The accepted badge
  is this pill in the gain role + a `✓`.
- **Button:** `.btn` (accent bg, white text) for primary; `.btn.ghost` (`--panel2` + `--line`) for
  secondary. `:hover{filter:brightness(1.12)}`.
- **Mini-bar:** `.bar-mini` (8px tall, rounded, flex segments) with per-segment token colors and a
  text legend underneath (`index.app.js:339`). The category breakdown reuses this.
- **Layout grids:** `.grid2` (1fr 1fr) / `.grid32` (3fr 2fr), both collapse to one column ≤1000px.
  KPI grid auto-fits at `minmax(165–190px,1fr)`.

---

## 4. Motion & density conventions

- **Motion is functional and tiny.** The only transitions in the system are `transition:.15s` on
  hover/select targets and `transform .22s ease` on the mobile drawer (`index.html:85`). **No
  `@keyframes`, no entrance animations, no spinners-by-default.** Loading is a one-frame muted
  placeholder (localStorage is instant), not an animated loader.
- **State changes are instant + reactive.** KPIs recompute live via `useMemo` (Planner/Dashboard
  feel) — no transition on number changes, no skeleton shimmer.
- **Hover feedback is subtle.** Rows tint `rgba(79,140,255,.05)`; nav/cards lift to `--panel2` or
  brighten 12%. Nothing bounces or scales.
- **Density is the brand.** Match 保障檢查 / Planner spacing exactly. Don't add whitespace to "breathe"
  — this is a data tool; tight is correct. Reuse the existing responsive breakpoints (1000 / 760 /
  420px); no new media queries for a feature that uses the existing grids.

---

## 5. The 6 expense-category colors — decision & rationale

**Decision: option (a) — a named subset of the existing 10-color `COLORS` series**, registered as
`EXPENSE_CAT` (see §2.5). **No new CSS tokens, no new hex** beyond what `COLORS` already ships.

**Why a subset of `COLORS`, not new tokens:**
1. **On-system by construction.** `COLORS` is the established multi-series chart palette; the 支出
   breakdown *is* a multi-series chart. Reusing it means the doughnut/bar matches every other chart
   in the app with zero palette drift.
2. **Zero token-registry growth.** Adding 6 new `--expense-*` CSS vars would duplicate hues `COLORS`
   already defines — exactly the "new color that duplicates a role" red-flag. A *named mapping* over
   existing values is the disciplined extension.
3. **Distinguishable on the dark canvas.** All six chosen hues are the saturated chart hues already
   proven legible on `--bg #0b0f17` / `--panel #121826` (they're the same colors the asset doughnut
   and 10-series charts use). They pass the dark-surface contrast the system already relies on.

**Why these six specific hues** (居住→blue, 飲食→cyan, 交通→orange, 教育→purple, 醫療→magenta,
其他→slate): they are maximally hue-separated (blue / cyan / orange / purple / magenta / neutral),
and they **skip green and red on purpose** so an expense category never collides with the page's own
gain(green)/loss(red) net-cash-flow language. 其他 takes the neutral slate — semantically the
"catch-all," visually the quietest — which is the right read for a residual bucket.

**Encoding safety (P7):** every category row and every chart slice carries its **zh-TW label**
(居住/飲食/交通/教育/醫療/其他). Color is a secondary, at-a-glance aid; the data is fully readable in
grayscale. The breakdown visual itself is optional for v1 (UX OQ-2) — even if shipped as the
`bar-mini`, the labels sit alongside it, never color-only.

---

## 6. Anti-AI-slop red-flag list (reject on sight)

The `design-system-steward`'s standing rejection list. These are the patterns that make a tool look
auto-generated instead of crafted; none ship.

- **Raw `#hex` or literal `px` in component code where a token exists.** Reference `var(--token)` /
  the `COLORS`/`CAT_COLOR`/`EXPENSE_CAT` mapping. (Lint by `grep` — there is no Stylelint; P4.)
- **A new color that duplicates an existing token's role.** No second blue, no `--expense-housing`
  when `COLORS[0]` already is that blue. Extend by *naming* existing values, not adding hues.
- **Color-only encoding of gain/loss / status** (P7). Always add the arrow / sign / ✓ / word. A red
  number with no `▼`/`−`/label is a defect.
- **Purple (or any) decorative gradients.** The one gradient in the app is the functional
  nav-active wash (`rgba(79,140,255,.18)→transparent`); that's the ceiling. No hero gradients, no
  glassmorphism, no gradient-filled KPI cards.
- **Default 3-equal-card hero grids / centered-everything.** This app is left-aligned, data-dense,
  auto-fit grids driven by content — not a 3-up marketing layout.
- **A generic brand webfont** (Inter/Poppins/Google-Font-of-the-month). System fonts only, chosen
  for zh-TW fidelity.
- **Decorative noise that hurts legibility** — drop shadows for depth, oversized icons, emoji as
  primary affordances, animated entrances, skeleton shimmer where a localStorage read is instant.
- **Whitespace inflation.** Loosening the established density to "feel modern." Match 保障檢查/Planner.
- **Rewriting the palette to solve a one-token problem.** Touch the smallest surface; rationalize
  every addition in this file *and* STEERING.

---

*Bootstrapped by `design-system-steward` from the shipped `index.html` + `index.app.js` styling
(not a blank page). Narrative companion to the canonical token table in `docs/STEERING.md` —
keep the two in sync.*

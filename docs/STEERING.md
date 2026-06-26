# retire-inv Steering — Stack, Structure, Tokens, Citations, Harness

Project-wide context every drafter and implementer inherits. Companion to
`docs/PRINCIPLES.md` (what the product must be) and `CLAUDE.md` (how we work).

## Stack (zero-build — P4)

- **Runtime:** static `index.html` opened in a browser. No backend, no bundler, no npm to run.
- **UI:** React 18 + ReactDOM (CDN, `useState/useEffect/useRef/useMemo`), authored as one file
  `index.app.js`, mounted into `#root`. No JSX build step — JSX is transpiled in-browser by the
  CDN Babel/the inline transform already wired in `index.html`.
- **Charts:** Chart.js (CDN). **Spreadsheet import:** SheetJS/XLSX (CDN).
- **Optional cloud:** Supabase (REST, user-supplied URL/key in 設定). **Quotes:** Twelve Data +
  TWSE (user-supplied key). All optional; app degrades to 本機模式.
- **Tests:** `node tests/retire.test.js` — pure-Node, extracts calc functions from
  `index.app.js` by name and asserts them. No test framework, no install.
- **Dev-only harness:** Playwright (`npx playwright`, installed on demand, never committed,
  never shipped) — used by `design-reviewer` + `a11y-auditor` only. See **Harness** below.

## Repo structure

```
index.html              # shell, styles, :root tokens, CDN tags, SEED=null
index.app.js            # the whole app: components + calc engine + data helpers
tests/retire.test.js    # Node assertions over the calc functions
PRODUCT_SPEC.md         # the 4-pillar product spec
AGENT_TEAM_PLAN.md      # this team's charter
CLAUDE.md · AGENTS.md   # dev-process discipline · agent dispatch
docs/PRINCIPLES.md · docs/STEERING.md
specs/<slug>/           # per-feature: PRODUCT.md · UX.md · TECH.md (+ PLAN.md if file-based)
.claude/agents/ · .claude/commands/
```

**Naming:** feature slugs are kebab-case (`cash-flow`, `insurance-inventory`). Calc functions
are `camelCase` and pure (no React/DOM) so the test harness can extract them. React components
are `PascalCase`. Keep new code in the surrounding single-file idiom — match the existing style,
don't introduce a module system.

## Design-token registry (P9 — the source of truth)

The app already ships a clean token system. **Components reference these; never raw hex/px.**
`design-system-steward` owns this table; additions go here first.

**Base (CSS custom properties, `index.html :root`):**
| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b0f17` | app background |
| `--panel` | `#121826` | card/panel surface |
| `--panel2` | `#1a2235` | raised surface / inputs |
| `--line` | `#243049` | borders / grid lines |
| `--text` | `#e6edf3` | primary text |
| `--muted` | `#8b98ad` | secondary text / chart axis |
| `--accent` | `#4f8cff` | primary / interactive (blue) |
| `--green` | `#2ecc8f` | **gain / up / success** |
| `--red` | `#ff5d6c` | **loss / down / danger** |
| `--gold` | `#f0b90b` | **warning / caution** |
| `--purple` | `#a78bfa` | accent-2 |

**Semantic roles:** gain=`--green`, loss=`--red`, warn=`--gold`, primary=`--accent`. Gain/loss
MUST also carry a non-color cue (arrow/sign) — P7 forbids color-only encoding.

**Asset-category palette (`index.app.js`):** `CAT_COLOR` = Stock `#4f8cff` · ETF `#2ecc8f` ·
Bond `#a78bfa` · Cash `#f0b90b`; `CAT_NAME` = 個股/ETF/債券/現金. **Chart series:** the 10-color
`COLORS` array. Chart defaults: text `#8b98ad` (=`--muted`), grid `rgba(36,48,73,.6)` (≈`--line`).

**Expense-category palette — `EXPENSE_CAT` (cash-flow 支出 6 類):** a **named subset of `COLORS`**,
not new tokens (reuses the established chart palette → no hue duplication, no registry growth).
Green/red are skipped on purpose so an expense category never collides with the gain/loss language.
Mapping (居住/飲食/交通/教育/醫療/其他):
| 類別 | label | Color | Role / rationale |
|---|---|---|---|
| housing | 居住 | `#4f8cff` (COLORS[0], blue) | largest fixed cost = anchor hue |
| food | 飲食 | `#22d3ee` (COLORS[5], cyan) | high-contrast vs blue |
| transport | 交通 | `#fb923c` (COLORS[6], orange) | distinct warm hue (not `--gold` warn) |
| education | 教育 | `#a78bfa` (COLORS[2], purple) | accent-2 hue, clearly separable |
| medical | 醫療 | `#e879f9` (COLORS[7], magenta) | distinct from red (never reads "danger") |
| other | 其他 | `#94a3b8` (COLORS[9], slate) | neutral catch-all = "other" |
Labels are **always present** (P7 — not color-only); colors are an at-a-glance aid only. Narrative +
full rationale in `DESIGN.md §2.5 / §5`.

## Citation contract (NO GUESS)

When a value or behavior traces to an authority, cite inline with a trust tier. The consumer
(TECH.md, code comment, test) MUST propagate the citation.
- **T1** — our own measurement (a passing test, a screenshot) → `[T1 · tests/retire.test.js::<case>]`
- **T2** — primary source / official rule → `[T2 · 勞保局 老年年金 …]`, `[T2 · 勞動部 …]`
- **T3** — established method / study → `[T3 · Trinity study 4% rule]`
- **T4** — community/secondary → `[T4 · <url>]`

Financial constants in code carry the tier inline, e.g.:
```js
const LABOR_INSURANCE_CAP = 45800; // [T2 · 勞保局 投保薪資分級表 最高級距]
```
`calc-test-auditor` flags an authoritative-looking constant with no citation.

## UI/UX verification harness (zero-build adaptation)

Playwright drives the **static `index.html`** (open from `file://` or `npx serve`). Primitives:
- **Screenshots** at 3 viewports (mobile ~390 / tablet ~820 / desktop ~1280) — the before/after
  evidence every UI change needs (visual-evidence-or-reject gate).
- **Accessibility-tree snapshots** (no vision model needed) to verify each interaction state.
- **axe-core injected** into the page for deterministic a11y; **Lighthouse** for the rest.
- Tokens are linted by `design-system-steward` via `grep` for raw `#hex`/`px` in component code
  (no Stylelint — that needs a build). Storybook is intentionally **not** used (zero-build).

A login gate (`pwHash`/`Login`, `sessionStorage`) protects the app — the harness must satisfy it
(test password documented out-of-band, never committed — P1).

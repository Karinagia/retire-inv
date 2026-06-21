# retire-inv Agent Team & Dev Workflow — Plan (v1 — APPROVED)

> **Status: APPROVED & built (2026-06-21).** AI-agent dev team + development process for
> retire-inv (家庭資產管理系統). Primary template: Erdtree's spec-driven 4-phase workflow
> (`~/Workspace/claude/erdtree`). The new part Erdtree lacks — a **UI/UX track** — is distilled
> from `garrytan/gstack`, `warpdotdev/warp`, and current UI/UX-agent best practices (§1).
>
> **Decisions (§9), as chosen:** 1·**A** file-based specs · 2·**A** zero-build Playwright harness ·
> 3·**B** full 14-agent team up front · 4·**committed** (team published with the repo).
> Built: `docs/PRINCIPLES.md`, `docs/STEERING.md`, `CLAUDE.md`, `AGENTS.md`, 14 agents in
> `.claude/agents/`, 9 commands in `.claude/commands/`.

---

## 0. Why this is not just a copy of Erdtree

Erdtree is a backend control plane (Go, Temporal, bare-metal DBs); retire-inv is the
opposite end of the spectrum, and the team must reflect that:

| Dimension | Erdtree | retire-inv | Consequence for the team |
|---|---|---|---|
| Surface | Backend / no GUI | **GUI-heavy** SPA | Add a whole **UI/UX track** (Erdtree has none) |
| Stack | Go + build + CI | **Zero-build**: single `index.html` + `index.app.js`, CDN React, `node` runs tests | Harness can't assume Storybook/Stylelint/bundler — see §6 |
| Team | Large org, agent-first ops | **Solo developer**, personal project | Right-size: lean core, file-based specs (not GitHub-issue machinery) |
| Risk | Mutates real infra (safety-critical) | Mutates a person's **financial plan** | "Safety" = **math correctness + privacy + no-false-precision**, not blast radius |
| Domain | Cassandra/Doris/Temporal | **退休/FIRE math + 台灣 勞退/勞保/保險/稅** | Domain specialists are finance, not infra |

So: keep Erdtree's **discipline** (spec-driven, EARS criteria, principles doc, validators,
adversarial review, NO-GUESS citation contract), swap its **domain** (finance for infra),
and **graft on a UI/UX track** that Erdtree never needed.

---

## 1. References Distilled

### From Erdtree (`~/Workspace/claude/erdtree`) — the process backbone
- **4-phase spec-driven pipeline** with hard gates: PRODUCT.md → TECH.md → Plan → Build → Review.
- **Agent file format**: `.claude/agents/<name>.md` — frontmatter (`name`/`description`/`tools`) + body (Scope / What-you-do-NOT-do / Gate / Process / Discipline / Anti-patterns).
- **Thin slash commands** (`.claude/commands/<name>.md`) that invoke one agent.
- **PRINCIPLES.md**: tiered tenets, each as Rule / Why / Auditor-check; mechanically-enforced safety invariants vs reviewer-enforced design tenets.
- **Steering docs** every drafter inherits (tech defaults, repo structure).
- **EARS acceptance criteria** ("WHEN <trigger>, the system SHALL <observable response>").
- **Validators** (structure check) separate from **adversarial reviewers** (stress-test) separate from **quality gates** (pre-merge).
- **NO-GUESS + tier-tagged citation contract** — claims cite a trust-tagged source; the consumer must propagate the citation.
- **Escalation pattern**: subagents can't call `AskUserQuestion`; they park Open Questions, the orchestrator asks one at a time.

### From gstack (`garrytan/gstack`) — design gated twice
- **`DESIGN.md` as the single design source of truth** (type/color/spacing/motion tokens + a written rationale per choice); "DESIGN.md missing" is a hard gap.
- **Design reviewed TWICE**: at *plan stage* (`plan-design-review` rates dimensions 0–10 and edits the plan to a 10 *before* code) and at *live stage* (`design-review` audits the running app, before/after screenshots, fix loop).
- **AI-Slop scored as a separate A–F metric** with a concrete blacklist (purple gradients, default 3-card grids, centered-everything, generic fonts) — guardrail against generic finance-dashboard output.
- **A11y + interaction-state completeness in every UI agent's rubric** (WCAG AA, 44px targets, focus-visible, `prefers-reduced-motion`, all of loading/empty/error/success).
- ETHOS: "Boil the Ocean" (do all states/edge cases), **"AI recommends, the user decides"** (agents never block the user's final design choice), self-regulation limits (stop after N fixes / X% risk).

### From Warp (`warpdotdev/warp`) — UI guidelines + visual-evidence gate
- **A `ui-guidelines` skill that bans hardcoded styling** — enumerate the design tokens/theme accessors and a named **"red-flag" anti-pattern list**; every UI agent loads it before touching UI.
- **Build new UI by cloning a canonical reference component**, enforce "visual parity with <existing pattern>".
- **Visual-evidence-or-reject review gate**: any user-visible change needs before/after screenshots (small) or a narrated recording (interactive), else auto-rejected.
- **Two-stage review**: automated agent review first, human only after it passes.
- **One narrow skill per lifecycle stage**, with a **base-skill + repo-specialization** layering pattern.

### From current best practice (Anthropic + ecosystem; web research, 2024–2026)
- **Skill vs subagent**: a *Skill* is progressively-disclosed knowledge/behavior; a *subagent* is isolated labor (own context, scoped tools, own model). They compose. ([Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); [subagents](https://code.claude.com/docs/en/sub-agents))
- **Split generator and evaluator into two agents** — self-grading inflates scores; an independent judge that *navigates the live page* is the single biggest quality lever. ([Harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps))
- **Evaluator-optimizer loop** (5–15 iterations) against explicit weighted criteria; keep the log, let a human pick the best frame. ([Building Effective Agents](https://www.anthropic.com/research/building-effective-agents))
- **Give agents eyes via Playwright** — accessibility-tree snapshots (no vision model needed) to verify the real rendered UI. ([playwright-mcp](https://github.com/microsoft/playwright-mcp))
- **A11y: deterministic engine first (axe-core/Lighthouse), LLM judgment second** — only ~64% of WCAG A/AA is deterministically detectable; **blocklist high-risk widgets from autonomous remediation**. ([GitHub a11y agent](https://github.blog/ai-and-ml/github-copilot/building-a-general-purpose-accessibility-agent-and-what-we-learned-in-the-process/))
- **Human gates belong at the tokens/design-spec stage and at final sign-off — especially anything that displays balances or moves money.** ([approval-gate governance](https://www.digitalapplied.com/blog/agentic-workflow-approval-gate-framework-governance))
- **Start simple; add agents only when they demonstrably help.** ([Building Effective Agents](https://www.anthropic.com/research/building-effective-agents))

---

## 2. The Development Process (6 phases)

Erdtree's pipeline with a **UX phase inserted** (between Product and Tech) and the **Review
phase widened** to cover visual + a11y + calc-correctness. Each phase reads the prior
artifact from disk — no in-conversation handoff; phases resume across sessions.

| Phase | Command | Driver agent(s) | Validator / gate | Output artifact |
|---|---|---|---|---|
| **0. Product** | `/spec-product <feat>` | `product-spec-drafter` | `spec-validator` → **you approve** | `specs/<slug>/PRODUCT.md` (what + why, EARS, user scenarios) |
| **1. UX Design** | `/spec-ux <slug>` | `ux-flow-designer` + `design-system-steward` | **Design-gate #1 (plan-stage): you approve** | `specs/<slug>/UX.md` (IA, flows, all interaction states, microcopy) + `DESIGN.md` tokens (project-level, first feature only) |
| **2. Tech** | `/spec-tech <slug>` | `tech-spec-drafter` (consults finance specialists) | `spec-validator` → **you approve** | `specs/<slug>/TECH.md` (data model, calc functions, component arch) |
| **3. Plan** | `/plan <slug>` | `planner` | `plan-validator` → **you approve** | task list (file-based or GitHub issues — §9 Decision 1) |
| **4. Build** | `/implement <task>` | `frontend-implementer` (UI) / `implementer` (calc+data) | — | code + diff/PR, one logical change per task |
| **5. Review** | `/review` then `/design-review` + `/a11y` | `code-reviewer` + `calc-test-auditor` + `design-reviewer` + `a11y-auditor` | **Design-gate #2 (live-stage)** + all gates green → **you merge** | review report + screenshots + a11y report + `node tests/retire.test.js` green |

**Hard gates (non-negotiable):**
- PRODUCT.md approved before UX.md drafting; UX.md + DESIGN tokens approved before TECH.md (no coding a screen whose states/tokens aren't settled — Warp `needs-mocks`).
- TECH.md approved before planning; plan approved before `/implement`.
- **`calc-test-auditor` green** (`tests/retire.test.js` passes, any changed formula has an updated test) before merge — the math analog of Erdtree's `safety-auditor`.
- **No UI change merges without visual evidence** (before/after screenshots) — Warp's reject rule.
- Anything that **displays a balance/number or changes a financial assumption** gets a human look (web research: money = blocking human gate).

```
Phase 0 ── PRODUCT.md ──▶ Phase 1 ── UX.md + DESIGN.md ──▶ Phase 2 ── TECH.md ──▶ Phase 3 ── Plan
  (what/why)    │gate          (flows/states/tokens)│gate        (how)    │gate              │gate
               you            DESIGN-GATE #1        you          you                         you
                                                                                              │
   merge ◀── Phase 5 ── review + DESIGN-GATE #2 + calc/a11y ◀── Phase 4 ── Build ◀───────────┘
   you              (screenshots, tests, axe)                  (implement)
```

---

## 3. Agent Roster (14 agents in 5 groups)

All 14 are built (Decision 3·B). **★** marks the lean-core subset (the agents that carry the
critical path if you ever want to run a reduced team).

### A. Spec & planning (from Erdtree)
| Agent | Job | Tools |
|---|---|---|
| **★ product-spec-drafter** | Interrogate (3–6 parked forcing questions), survey existing code, write `PRODUCT.md` — what + why, EARS criteria, user scenarios. No HOW. | Read, Grep, Glob, Write, WebSearch |
| **★ tech-spec-drafter** | From approved PRODUCT+UX, design the HOW: localStorage/Supabase data model, calc functions, React component architecture, state. Consults finance specialists, propagates citations. | Read, Grep, Glob, Write, Edit, WebSearch |
| **★ planner** | Break TECH+UX into small, ordered, surgical tasks each with EARS acceptance criteria + a curated Required-Reading list. | Read, Write (or Bash `gh` — Decision 1) |
| **spec-validator** | Auto structure check: required sections present, EARS well-formed, cross-refs resolve, no leftover TODOs, specialist citations intact. | Read, Grep |

### B. UI/UX track (NEW — from gstack / warp / web)
| Agent | Job | Tools |
|---|---|---|
| **★ design-system-steward** | Owns `DESIGN.md` + the CSS-custom-property tokens (the app already has `--accent/--muted/--panel…`, `COLORS`, `CAT_COLOR`). Enforces the Warp-style **"red-flag" list** (no raw hex in components, no off-token color, role-based semantic tokens: gain/loss/neutral, chart series). Generates the token rationale. | Read, Grep, Glob, Write, Edit |
| **ux-flow-designer** | From PRODUCT.md, produce `UX.md`: information architecture, user flows (Mermaid), and **every interaction state** (loading/empty/error/success/partial/disabled) per screen + zh-TW microcopy. gstack "Boil the Ocean". | Read, Grep, Glob, Write, WebSearch |
| **design-reviewer** | gstack live `design-review`: drives the running app via Playwright, screenshots at 3 viewports, scores **Design A–F + a separate AI-Slop A–F** against `DESIGN.md`, CSS-first surgical fix loop with before/after evidence, self-regulation limit (stop after N fixes / >X% risk). **Recommends; never blocks your design choice.** | Read, Edit, Bash (playwright) |
| **a11y-auditor** | axe-core (injected via Playwright on the static `index.html`) + Lighthouse for deterministic checks, then LLM judgment over JSON+DOM+screenshots. zh-TW typography + contrast for the dark theme. **Blocklists** high-risk widgets from auto-fix → escalates. | Read, Edit, Bash (playwright, axe) |

### C. Build (from Erdtree, split for the GUI)
| Agent | Job | Tools |
|---|---|---|
| **★ frontend-implementer** | Implement one UI task into `index.app.js` against `UX.md` + tokens; clone the nearest existing component (Warp), match the single-file React idiom, produce screenshot evidence. | Read, Write, Edit, Bash, Grep, Glob |
| **★ implementer** | Implement one calc/data task (a pure function in `index.app.js` + a Node assertion in `tests/retire.test.js`). Surgical; grounds "done" in a passing test (P4). | Read, Write, Edit, Bash, Grep, Glob |

### D. Review & quality gates
| Agent | Job | Tools |
|---|---|---|
| **★ code-reviewer** | Pre-merge diff review vs the task's EARS criteria, PRINCIPLES, citation contract. AUTO-FIX (obvious) vs ASK (judgment) split, confidence 1–10. | Read, Grep, Bash, Edit |
| **★ calc-test-auditor** | The **math safety gate** (analog of Erdtree `safety-auditor`): runs `node tests/retire.test.js`, confirms every changed formula has an updated/added assertion, enforces NO-GUESS on financial constants (勞保投保薪資上限, 4% rule, contribution caps must cite 勞動部/勞保局/source). Blocks merge on red. | Read, Grep, Bash |

*(design-reviewer + a11y-auditor from group B are also Phase-5 gates.)*

### E. On-call finance specialists (analog of Erdtree's cassandra/doris/temporal experts)
| Agent | Trigger | Job |
|---|---|---|
| **fire-calc-specialist** | calc-engine work (simulate, monteCarlo, coastYearsTo, FIRE types) | Retirement/FIRE math correctness; cites authoritative method (4% rule / Trinity study, Monte Carlo conventions). |
| **tw-finance-specialist** | 勞退/勞保/稅/保險 or data-integration work | Taiwan pension formulas (勞退自提, 勞保老年年金 A/B 式), 雙十原則, tax, Supabase/Twelve Data integration. KB-first, cites 勞動部/勞保局. |

---

## 4. Principles (proposed `docs/PRINCIPLES.md`)

Promote PRODUCT_SPEC's P1–P6 into an enforced principles doc and add UI/UX tenets. Tiered
like Erdtree: **Tier-1 = auditor-blocking**, **Tier-2 = reviewer-warns**.

**Tier 1 (blocking):**
- **P1 Privacy / no-PII-in-source** — `SEED=null`, keys only in localStorage. *(enforced by code-reviewer + calc-test-auditor on any commit)*
- **P2 Math integrity / NO-GUESS** — every formula change ships a test; financial constants cite an authority. *(calc-test-auditor)*
- **P3 Estimates-not-advice** — persistent disclaimer; no false precision; 勞退/勞保 labelled estimates. *(code-reviewer)*

**Tier 2 (reviewer-enforced):**
- **P4 Local-first / zero-build** — must run from a static `index.html`; no new backend/build step without explicit justification.
- **P5 Inflation-real** — long-horizon money figures model inflation.
- **P6 Foundation-before-growth** — emergency fund + insurance before allocation (保障檢查 ordering).
- **P7 Accessible & responsive** — WCAG AA contrast, keyboard nav, focus-visible, `prefers-reduced-motion`, all interaction states present, works mobile→desktop. *(a11y-auditor + design-reviewer)*
- **P8 zh-TW first** — Traditional-Chinese UI/microcopy, correct number/currency formatting (萬 units). *(ux-flow-designer)*
- **P9 Design-token discipline** — components reference tokens, never raw hex/px; no "AI-slop" patterns. *(design-system-steward + design-reviewer)*

---

## 5. Slash commands (proposed `.claude/commands/`)
`/spec-product` · `/spec-ux` · `/spec-tech` · `/plan` · `/implement` · `/review` ·
`/design-review` · `/a11y` · `/validate`. Each is a thin wrapper invoking its agent
(Erdtree pattern).

---

## 6. UI/UX verification harness — adapted to a ZERO-BUILD app

This is the biggest adaptation. The web research assumes Storybook + Stylelint +
Style-Dictionary — **all of which need a build toolchain retire-inv deliberately doesn't have
(P4)**. So the harness is reshaped:

| Best-practice tool | Needs build? | retire-inv adaptation |
|---|---|---|
| Playwright (screenshots, a11y-tree, viewports) | No | **Keep** — drives the static `index.html` opened from disk; the core verification primitive. |
| axe-core a11y | No (inject via Playwright) | **Keep** — inject into the page at audit time. |
| Lighthouse | No | **Keep** — run against the local file/served page. |
| Design tokens | — | **CSS custom properties** in `index.html` `:root` (already partly there: `--accent`, `--muted`, …) — the token source of truth, no Style-Dictionary. |
| Stylelint token-lint | Yes (npm) | **Replace** with `design-system-steward` agent review of token usage (grep for raw hex in component code) — discipline by agent, not by build linter. |
| Storybook | Yes (npm) | **Drop.** Instead, the design-reviewer verifies states by driving the live app to each state via Playwright. |

Net: **one optional dev dependency (Playwright) used only by review agents**, never shipped,
never required to run the app. Keeps P4 intact. *(If you'd rather add a real build/Storybook
layer, that's Decision 2.)*

---

## 7. What gets published vs stays internal

retire-inv's `.gitignore` is deny-all + allowlist (publishes only the app + README +
PRODUCT_SPEC). The agent team is **dev-internal tooling**. Proposed default: **keep
`.claude/`, `AGENT_TEAM_PLAN.md`, `docs/PRINCIPLES.md`, `specs/` gitignored** (not published
to the public repo) — matching the existing "only publish the app" policy. Erdtree commits
its team because Erdtree *is* the team's product; here the product is the web app. *(Reversible
— see Decision in §9 if you want them committed.)*

---

## 8. Build-out order (once approved)
1. `docs/PRINCIPLES.md` + a short `CLAUDE.md`/`AGENTS.md` (dispatch + discipline).
2. The 7 ★ lean-core agents + their slash commands.
3. `DESIGN.md` bootstrapped from the app's *existing* CSS variables + palette (so the steward starts from reality, not a blank page).
4. Wire the Playwright review harness (design-reviewer + a11y-auditor).
5. Add the 4 non-core agents (validators, ux-flow-designer, specialists) as the workload proves them out.

---

## 9. Decisions (resolved 2026-06-21)

- **Decision 1 — Process weight: (A) Lean, file-based.** Specs live in `specs/<slug>/*.md`;
  tasks tracked in a `PLAN.md`. No GitHub issues/labels.
- **Decision 2 — UI/UX harness: (A) Zero-build.** Playwright-only, CSS-var tokens,
  agent-enforced token discipline (§6). Preserves P4.
- **Decision 3 — Team size: (B) Full 14 up front.**
- **Decision 4 — Publish: committed.** The team is allowlisted in `.gitignore` and published
  with the repo (overriding the §7 default). `.claude/settings.local.json` stays ignored (P1).

---

*Built per the above. Next: run a real feature through the pipeline (`/spec-product <feature>`)
— the cash-flow ledger (pillar ②) is the recommended first target per `PRODUCT_SPEC.md` §6.B.*

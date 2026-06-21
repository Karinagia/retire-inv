# AGENTS.md — Dispatch & When-to-Use

Which agent handles which task, and the order they run in. Companion to `CLAUDE.md`
(dev-process discipline) and `AGENT_TEAM_PLAN.md` (full charter). When in doubt about *how* to
work → `CLAUDE.md`; about *who* does the work → here.

> Roster: **14 agents.** Slash commands: `/spec-product`, `/spec-ux`, `/spec-tech`, `/plan`,
> `/implement`, `/review`, `/design-review`, `/a11y`, `/validate`.

## The pipeline (hard ordering)

```
Phase 0  Product   product-spec-drafter            → (spec-validator)            → you approve PRODUCT.md
Phase 1  UX        ux-flow-designer + design-system-steward                      → DESIGN-GATE #1 (you approve UX.md + tokens)
Phase 2  Tech      tech-spec-drafter (+ fire-calc / tw-finance specialists)      → (spec-validator) → you approve TECH.md
Phase 3  Plan      planner                          → (plan check)               → you approve PLAN.md
Phase 4  Build     frontend-implementer (UI) | calc-implementer (calc+data)      → one diff/PR per task
Phase 5  Review    code-reviewer + calc-test-auditor + design-reviewer + a11y-auditor → DESIGN-GATE #2 → you merge
```

Non-negotiable gates (from `CLAUDE.md` §2): PRODUCT before UX · UX+tokens before TECH · TECH
before PLAN · PLAN before build · **calc-test-auditor green** + **screenshot evidence** before
merge · human look on anything showing a balance or changing a financial assumption.

## Dispatch table

| You want to… | Agent | Invoke |
|---|---|---|
| Draft a feature PRODUCT.md (what + why) | `product-spec-drafter` | `/spec-product <feat>` |
| Design IA / flows / all states / zh-TW copy | `ux-flow-designer` | `/spec-ux <slug>` |
| Define / extend design tokens + DESIGN.md | `design-system-steward` | `/spec-ux <slug>` (co-driver) |
| Draft a TECH.md (data model, calc, components) | `tech-spec-drafter` | `/spec-tech <slug>` |
| Validate a spec's structure | `spec-validator` | auto, after a drafter |
| Break a spec into tasks | `planner` | `/plan <slug>` |
| Implement a UI task | `frontend-implementer` | `/implement <task>` |
| Implement a calc/data task (+ test) | `calc-implementer` | `/implement <task>` |
| Pre-merge diff review | `code-reviewer` | `/review` |
| Gate the math (run tests, enforce P2) | `calc-test-auditor` | `/review` (auto on calc diffs) |
| Live visual audit (screenshots, AI-slop score) | `design-reviewer` | `/design-review` |
| Accessibility audit (axe + LLM) | `a11y-auditor` | `/a11y` |

## On-call specialists (consulted by drivers via the Agent tool, not a slash command)

| Domain | Agent | Trigger |
|---|---|---|
| 退休/FIRE math (simulate, monteCarlo, FIRE types, 4% rule) | `fire-calc-specialist` | calc-engine work |
| 台灣 勞退/勞保/稅/保險 + data integrations | `tw-finance-specialist` | pension/tax/insurance or Supabase/Twelve Data work |

Both specialists follow the citation contract (`docs/STEERING.md`): every answer cites a
tier-tagged source, and the **caller propagates the citation** into its artifact (TECH.md, code
comment, test). KB-first where a knowledge base exists.

## Agent groups (see `AGENT_TEAM_PLAN.md §3`)
- **Spec & planning:** product-spec-drafter, tech-spec-drafter, planner, spec-validator
- **UI/UX:** design-system-steward, ux-flow-designer, design-reviewer, a11y-auditor
- **Build:** frontend-implementer, calc-implementer
- **Review gates:** code-reviewer, calc-test-auditor (+ design-reviewer, a11y-auditor)
- **On-call:** fire-calc-specialist, tw-finance-specialist

# retire-inv — Dev-Process Discipline

Always-loaded rules for working on retire-inv (家庭資產管理系統). *How* we work; `AGENTS.md` is
*who* does the work; `docs/PRINCIPLES.md` is *what the product must be*; `docs/STEERING.md` is
the stack/structure/token/citation canon.

This project is developed by an **AI-agent team** (see `AGENT_TEAM_PLAN.md`). The workflow is
spec-driven and file-based.

## §0 — NO GUESS (the meta-rule)
Build on facts. Code measures; specs cite; "done" means a passing `node tests/retire.test.js`
or an observed screenshot — never "ran without error." Unknowns are surfaced, not papered over.
Financial constants cite an authority (`docs/STEERING.md` citation contract).

## §1 — Surgical changes
The smallest change that satisfies the task. A bug fix doesn't refactor neighbours; a one-shot
need doesn't grow a helper for a hypothetical second caller. Match the surrounding single-file
idiom (`docs/STEERING.md`). No speculative abstraction, config, or flexibility the task didn't
ask for. Every changed line traces to an acceptance criterion.

## §2 — The 6-phase spec-driven workflow
Each phase reads the prior artifact from disk — **no in-conversation handoff**; phases resume
across sessions. Artifacts live in `specs/<slug>/`.

| Phase | Command | Driver | Gate to next |
|---|---|---|---|
| 0 Product | `/spec-product <feat>` | product-spec-drafter (+spec-validator) | you approve `PRODUCT.md` |
| 1 UX | `/spec-ux <slug>` | ux-flow-designer + design-system-steward | **design-gate #1**: you approve `UX.md` + tokens |
| 2 Tech | `/spec-tech <slug>` | tech-spec-drafter (+specialists, +spec-validator) | you approve `TECH.md` |
| 3 Plan | `/plan <slug>` | planner (+plan check) | you approve `PLAN.md` |
| 4 Build | `/implement <task>` | frontend-implementer / calc-implementer | PR/diff opened |
| 5 Review | `/review` · `/design-review` · `/a11y` | code-reviewer + calc-test-auditor + design-reviewer + a11y-auditor | **all gates green + design-gate #2 → you merge** |

**Hard gates (non-negotiable):**
- PRODUCT.md approved before UX; UX + tokens approved before TECH (no coding a screen whose
  states/tokens aren't settled); TECH approved before PLAN; PLAN approved before `/implement`.
- **`calc-test-auditor` green** before any merge (tests pass + every changed formula has a test).
- **No UI change merges without before/after screenshot evidence** (visual-evidence-or-reject).
- Anything that **displays a balance/number or changes a financial assumption** gets a human look.

## §3 — Subagent escalation pattern
Subagents **cannot** call `AskUserQuestion` (the harness filters it out for them). A subagent
that needs a decision **parks** it as a structured Open Question in its output artifact (options
+ a recommendation); the **orchestrator** (the main session) asks the user ONE question at a time
via `AskUserQuestion` — or, when the user is on a chat channel (e.g. Telegram), relays it there.
Subagents likewise do not auto-invoke other agents — they park a dispatch request; the
orchestrator dispatches.

## §4 — Citations propagate
A specialist-derived claim (e.g. a 勞保 formula from `tw-finance-specialist`) carries its
tier-tagged citation into the artifact that consumes it (TECH.md, a code comment, a test).
Dropping a citation is a `code-reviewer` / `calc-test-auditor` finding.

## §5 — Git & commits
- `main` is primary. Branch for feature work: `<slug>/<short-desc>`. Commit per logical change.
- **Conventional Commits**: `feat|fix|docs|refactor|test|chore(<scope>): <imperative subject>`.
  Subject ≤ 72 chars; body explains what + why.
- One logical change per PR/commit. UI commits include screenshot evidence in the body/PR.
- Commit or push only when the user asks. End commit messages with the required co-author trailer.
- `.gitignore` is **deny-all + allowlist** — a new committed file needs an allowlist entry, or it
  is silently ignored. Never commit secrets / real financial data (P1).

## §6 — Spec-vs-app discipline
`specs/<slug>/*.md` are the spec (the WHAT/WHY/HOW design). The implementation lives in
`index.html` / `index.app.js` / `tests/`. Implementers **derive** code from the spec and cite the
spec path in a code comment when a function implements a specific TECH.md section. Don't copy spec
prose into code or vice versa.

## §7 — Anti-patterns
- Starting a phase before the prior gate is approved.
- Claiming success on unverified work (P2/§0). Show the test or the screenshot.
- Scope drift ("while I'm here…") — surface it, don't silently expand.
- Raw hex/px in components (P9) or a removed disclaimer (P3).
- A formula change with no test delta (P2) — `calc-test-auditor` blocks it.

---
description: Phase 2 — draft a feature's TECH.md (how)
argument-hint: <slug>
---

Invoke the `tech-spec-drafter` subagent to draft `specs/<slug>/TECH.md` for: $ARGUMENTS

Gate: approved `PRODUCT.md` + `UX.md` (+ tokens) must exist first.

The drafter designs the HOW per `docs/STEERING.md` + `docs/PRINCIPLES.md`: the localStorage/
Supabase **data model**, the **calc functions** (pure, testable) and their test plan, the React
**component architecture** + state, integration points, failure modes, knowledge gaps, and risks.
It **consults `fire-calc-specialist` / `tw-finance-specialist`** for domain math (parking the
dispatch — `CLAUDE.md` §3) and **propagates their tier-tagged citations** into TECH.md.

After it returns, dispatch any parked specialist consults, re-invoke with responses, run
`spec-validator`. Gate to Phase 3: the user approves TECH.md.
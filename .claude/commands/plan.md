---
description: Phase 3 — break a spec into ordered, surgical tasks
argument-hint: <slug>
---

Invoke the `planner` subagent to write `specs/<slug>/PLAN.md` for: $ARGUMENTS

Gate: approved `TECH.md` must exist.

The planner decomposes TECH.md + UX.md into a small, ordered set of **surgical tasks**, each with:
an id, a one-line goal, **EARS acceptance criteria**, a curated **Required Reading** list (the
specific TECH.md/UX.md sections + tokens it consumes), the verification (which test or screenshot
proves it), and its track (`ui` → frontend-implementer · `calc` → calc-implementer). Tasks are
sized so each is one diff. Dependencies are explicit and ordered.

After it returns, run a structural check (every task has EARS criteria + Required Reading +
verification). Gate to Phase 4: the user approves PLAN.md.
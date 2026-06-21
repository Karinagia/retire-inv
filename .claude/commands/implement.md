---
description: Phase 4 — implement one approved task
argument-hint: <task-id>
---

Implement task **$ARGUMENTS** from the feature's `specs/<slug>/PLAN.md`.

If $ARGUMENTS is empty, ask which task. Gate: PLAN.md approved + the task exists.

Route by track: a `ui` task → `frontend-implementer`; a `calc`/`data` task → `calc-implementer`.
The implementer reads ONLY the task's Required Reading, makes the **minimal, surgical** change
(`CLAUDE.md` §1) into `index.app.js` / `index.html` / `tests/`, matches the single-file idiom,
and grounds "done" in observed state (P2/§0): a `calc` task ships a passing
`node tests/retire.test.js` assertion; a `ui` task ships **before/after screenshots** at 3
viewports. It calls a specialist if it needs domain math and **carries the citation into a code
comment**. It does **not** merge and does **not** expand scope — scope drift is surfaced.

After it returns, summarize: files changed, which EARS criteria are met + evidence, what Phase-5
gates still must clear (`/review`, plus `/design-review` + `/a11y` for UI work).
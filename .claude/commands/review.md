---
description: Phase 5 — pre-merge diff review + math gate
argument-hint: [diff or PR ref]
---

Run the Phase-5 code review on: ${ARGUMENTS:-the current working diff}

Invoke `code-reviewer` (always) and `calc-test-auditor` (always when the diff touches a calc
function or `tests/`):

- `code-reviewer` reviews the diff vs the task's EARS criteria, `docs/PRINCIPLES.md`,
  `docs/STEERING.md`, and the citation contract. AUTO-FIX the objectively-correct; **park ASK
  items** (judgment/behavior/architecture) for the orchestrator; reports confidence 1–10.
- `calc-test-auditor` is the **math safety gate**: runs `node tests/retire.test.js` (must be
  green), confirms every changed formula has a test delta, and that authoritative financial
  constants are cited (P2). It **blocks merge on red**.

For UI work, also run `/design-review` and `/a11y`. Summarize: AUTO-FIX applied, ASK items,
gate status (calc green?), and what still blocks merge.
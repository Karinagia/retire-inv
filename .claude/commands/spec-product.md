---
description: Phase 0 — draft a feature's PRODUCT.md (what + why)
argument-hint: <feature name or slug>
---

Invoke the `product-spec-drafter` subagent to draft `specs/<slug>/PRODUCT.md` for: $ARGUMENTS

If $ARGUMENTS is empty, ask the user which feature before proceeding.

The drafter loads `PRODUCT_SPEC.md` (the 4-pillar substrate) + `docs/PRINCIPLES.md`, surveys
existing code/specs for overlap, plans 3–6 forcing questions, **parks them as Open Questions**
(it cannot call `AskUserQuestion` — `CLAUDE.md` §3), and writes PRODUCT.md: Problem · Users &
scenarios · Success Criteria (EARS) · Scope In/Excluded · Open Questions. **What + why only — no
HOW.** Map each criterion to a pillar; flag pillar/principle conflicts.

After it returns, resolve its Open Questions with the user (one at a time; relay to the chat
channel if the user is on one), re-dispatch with answers, then run `spec-validator`. Gate to
Phase 1: the user approves PRODUCT.md.
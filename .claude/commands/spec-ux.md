---
description: Phase 1 — design UX flows + states + design tokens (design-gate #1)
argument-hint: <slug>
---

Invoke `ux-flow-designer` and `design-system-steward` to produce the UX design for: $ARGUMENTS

Gate: `specs/<slug>/PRODUCT.md` must be approved first.

- `ux-flow-designer` writes `specs/<slug>/UX.md`: information architecture, user flows (Mermaid),
  and **every interaction state** per screen (loading / empty / error / success / partial /
  disabled), plus zh-TW microcopy. "Boil the ocean" — cover all states.
- `design-system-steward` confirms/extends the token registry in `docs/STEERING.md` (and bootstraps
  `DESIGN.md` if absent), ensuring every new surface maps to existing tokens — gain/loss/neutral,
  chart series, category colors — with **no raw hex/px** and no AI-slop patterns.

This is **design-gate #1 (plan-stage)**: the user approves UX.md + the token plan before any code.
Park decisions as Open Questions for the orchestrator to ask.
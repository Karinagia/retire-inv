---
description: Validate a spec artifact's structure
argument-hint: <path to PRODUCT.md / UX.md / TECH.md / PLAN.md>
---

Invoke the `spec-validator` subagent to validate: $ARGUMENTS

If $ARGUMENTS is empty, ask which artifact. The validator does a **structure-only** check (it does
not judge content quality): required sections present for the artifact type, **EARS-format**
acceptance criteria well-formed, Mermaid/ASCII diagram syntax valid, cross-references resolve, no
leftover TODOs/placeholders in non-Open-Questions sections, and **every specialist-derived claim
carries its tier-tagged citation** (`docs/STEERING.md`).

It returns a PASS/WARN list keyed by `<section> — <nit>`. WARNs route back to the drafter
(WARN-loop). It does not edit the artifact.
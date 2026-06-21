---
description: Phase 5 — live visual audit of the running app (design-gate #2)
argument-hint: [slug or screen]
---

Invoke the `design-reviewer` subagent to audit the running app for: ${ARGUMENTS:-the changed screens}

The reviewer serves the static `index.html` and drives it via Playwright: screenshots at 3
viewports, then scores **Design A–F** and a **separate AI-Slop A–F** against `docs/STEERING.md`
tokens + `DESIGN.md`. It checks interaction-state completeness (loading/empty/error/success/
partial/disabled), token discipline (no raw hex/px), and visual parity with existing patterns.
It applies **CSS-first surgical fixes** with before/after screenshot pairs, reverts on
regression, and **self-limits** (stops after N fixes / >X% risk).

This is **design-gate #2 (live-stage)**. The reviewer **recommends; it never blocks the user's
final design choice** (gstack ETHOS). It returns the grades, the evidence, and any parked
design questions for the user.
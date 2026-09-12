---
name: adversarial-review
description: Adversarial review rubric for BrushTales — assume the implementation is broken and prove it.
---

## When to load me

Load this skill before the adversarial-review step of every implementation batch. The `adversary` agent loads it on every invocation.

## Mission

Assume the implementation is broken and go out of your way to prove it. Report findings only; do not edit files or fix findings yourself.

## Finding categories

Categorize every finding exactly once:

1. **blocking** — correctness, security, crashes, data loss, broken privacy invariants, or safety-critical gaps that must be fixed before merge;
2. **major** — serious user-facing edge cases, performance cliffs, untested behavior, or regressions that should be fixed before merge;
3. **minor** — non-critical gaps, cleanup, weak coverage, or small edge cases; and
4. **nit** — cosmetic or wording issues.

## Review checklist

For every changed file and code path:

- **Correctness:** Does it satisfy the planning task and acceptance criteria? Check boundaries, null states, races, interruption, and recovery.
- **Tests:** Does a meaningful test catch regressions? Is it testing behavior rather than implementation details or a tautology?
- **Conventions:** Does it follow `AGENTS.md`, the project’s TypeScript/Expo conventions, and local test conventions?
- **Edge cases:** Check denied permissions, unavailable camera, poor lighting, device rotation, app backgrounding, audio interruption, empty profiles, malformed local data, and low-confidence detection.
- **Privacy and security:** No secrets, child frames, child voice recordings, or unnecessary network transfer. Camera processing remains on-device.
- **Safety and UX:** No clinical claims, shame/punishment loops, unsafe brushing instructions, or child-accessible parent controls.
- **Workflow:** Check task scope, planning index synchronization, branch/PR expectations, and generated artifacts.

## Re-review loop

After the builder addresses findings, review the updated diff again. Repeat until there are no blocking or major findings. Minor and nit findings must be listed in the PR remainder as fixed, deferred, or not agent-fixable.

## Output format

```text
## Adversarial Review — <diff target>

### Blocking
- (or "none")

### Major
- (or "none")

### Minor
- (or "none")

### Nit
- (or "none")
```

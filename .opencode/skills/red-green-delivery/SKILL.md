---
name: red-green-delivery
description: Test-first delivery for BrushTales code changes, with proof of failure, smallest green implementation, and clear batch boundaries.
---

## When to load me

Load this skill before starting an application implementation task through the `builder` agent. If the implementation plan does not reference it, stop and ask the orchestrator to load it first.

## The red-green cycle

### 1. RED — write the failing test first

For every behavior change, bug fix, or refactor, the first implementation artifact is a test that fails for the right reason. The test must prove the requested behavior or reproduce the bug.

Capture proof of RED:

- the test is discovered and compiles;
- it fails before the implementation exists; and
- the failure is the expected assertion or missing-behavior failure.

Do not write production implementation before the failing test. Do not skip RED because the change appears small.

### 2. GREEN — make the smallest change

Implement only what is needed to make the new test pass. Do not add unrelated features, refactors, visual polish, or speculative abstractions. Follow the project’s TypeScript, React Native, Expo, and test conventions.

### 3. REFACTOR — only within the same bounded task

Refactor only after GREEN. If the refactor changes behavior or adds a new guarantee, add a new failing assertion first. Keep the task focused.

## Batch boundaries

One planning task (`planning/NNN-*.md`) is one delivery batch. A batch ends only when:

1. the tests are green;
2. adversarial review has no blocking or major findings;
3. the verification gates pass;
4. the task Markdown and SQLite metadata are updated; and
5. the change is committed on its feature branch and delivered through a pull request.

Coordination-only changes such as research, planning, or skill documentation may use document/schema validation instead of inventing a failing application test, but they still require review and verification appropriate to the change.

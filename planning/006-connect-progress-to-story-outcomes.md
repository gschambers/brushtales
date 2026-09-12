# 006 — Connect brushing progress to story outcomes

- **Status:** todo
- **Priority:** high
- **Sequence:** 6
- **Labels:** ml, story, session
- **Depends on:** 002, 004, 005

## Goal

Combine time, motion signal, and detector confidence into a gentle progress value that can influence authored story branches.

## Acceptance criteria

- Scoring is isolated from UI and covered by deterministic tests.
- Confidence uncertainty never traps the child or removes access to a positive ending.
- Explicit child choices remain meaningful independently of the brushing estimate.
- The story engine supports at least two outcomes and a camera-free path.
- Product copy avoids clinical claims and avoids punishment, shame, or lost-streak language.

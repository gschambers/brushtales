# Prototype-first BrushTales app implementation plan

**Goal:** Make the reviewed web prototype the actual root React Native/Expo app experience, preserving its complete flow and styling while wiring existing local domain seams underneath it.

**Source:** `docs/superpowers/specs/2026-09-21-brushtales-prototype-first-app-design.md`

## Tasks

1. Add RED root-flow tests for every prototype state and transition.
2. Add prototype theme/state data and reusable React Native shell primitives.
3. Port welcome/profile/settings/complete/act/choice states verbatim.
4. Port brushing surface and atlas geometry from prototype CSS.
5. Replace `app/index.tsx` and root chrome so old onboarding is unreachable.
6. Wire session controller/audio/sensing/persistence without changing the UI
   state machine; preserve direct audio-only fallback only as a fixture.
7. Run full CI and agent-browser state verification at 320px/430px; fix visual
   parity regressions before completion.

## Non-negotiable acceptance criteria

- No old “Choose your explorer”, story shelf, generic profile shell, or
  native-slice-only opening is shown from the root route.
- The root app matches the prototype’s state names, copy, controls, layout,
  palette, atlas, toothbrush, countdown, ring layering, and responsive behavior.
- The complete prototype choice flow is present after Act 3.
- Camera/sensing failure keeps the same brushing composition and remains
  non-punitive.
- No raw child media, account, network, or medical claim is introduced.

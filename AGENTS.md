# BrushTales agent guide

## Mission

BrushTales is a child-focused, audio-first storybook that makes a complete toothbrushing session feel like a small adventure. Brushing progress should influence an authored story without shaming a child or pretending to provide a dental diagnosis.

The v0 target is a local-first iOS/Android app with:

- multiple on-device child profiles;
- a two-minute session, normally twice per day;
- camera-based, on-device motion/progress feedback;
- one short branching story with clear decision points and several outcomes; and
- expressive, pre-generated narration rather than native device TTS.

## Working assumptions

- The primary audience is children who need adult supervision while brushing. Design for a parent or caregiver to start the session and configure settings.
- The app is an engagement and habit aid, not a dental instrument. Never describe a score as proof that teeth are clean.
- Camera frames, audio recordings, and profile data remain on the device in v0. Do not add analytics, accounts, ads, social sharing, or cloud inference without an explicit product and privacy decision.
- The app should work offline after story/audio/model assets have been installed.

## Recommended technical direction

- Prefer **React Native with Expo and TypeScript** for the first native cross-platform build. Use an Expo development build/prebuild when native camera or ML modules are required.
- Use `expo-camera` for the initial camera experience and `expo-keep-awake` for the active two-minute session. If frame-rate access is insufficient for detection, move the camera layer to `react-native-vision-camera` and keep the rest of the app in Expo/React Native.
- Run detection locally. Start by measuring brush/hand motion and coverage cues; do not assume a generic object detector can reliably identify a toothbrush. A small custom model or a MediaPipe/ML Kit-based pipeline may be evaluated after a test set of real brushing videos exists.
- Keep story content data-driven: scene IDs, narration asset IDs, choices, score gates, and endings belong in typed JSON/TypeScript data, not scattered through UI components.
- Generate narration during content production and ship audio assets. Never put a TTS provider secret in the client. The current leading candidate is ElevenLabs; see `research/2026-09-12-tts-research.md`.
- Use simple local persistence first (for example, AsyncStorage or SQLite if session history becomes relational). Store only what is needed for profiles, settings, session summaries, and story progress.

## Product and safety rules

- Ask for camera permission at the point of need and explain plainly that frames are processed on-device and not saved.
- Provide a camera-free fallback timer/story mode when permission is denied, the camera is unavailable, or detection confidence is low.
- Never require a child to make exaggerated or unsafe brushing movements. The brush, not a fast arm motion, should be the source of progress.
- Use encouraging language such as “let’s explore another path” instead of failure, punishment, lost streaks, or negative health claims.
- Put adult-only controls behind a parent gate. Do not expose provider settings, debug overlays, or profile deletion controls to a child accidentally.
- Do not retain child images or voice. Treat any future upload or recording feature as a new privacy review; child images, video, and audio can be personal information under COPPA.
- Include a visible stop/pause control and handle app backgrounding, interruptions, low battery, camera denial, and device rotation without losing the session.

## Story and audio conventions

- Write in short scenes with one idea per audio clip. Keep decision prompts unambiguous when the child cannot look at the screen for long.
- Make the story understandable from audio alone. Visuals may reinforce a scene but must not be required to understand the plot or make a choice.
- Use explicit timing markers for the brushing flow: start, four approximate 30-second regions, one-minute encouragement, and completion. These are coaching cues, not claims of clinical coverage.
- Keep a stable narrator voice and consistent pronunciation of names. Maintain a pronunciation/voice bible beside future story assets.
- Include captions/transcripts and independent volume controls for narration, music, and effects where practical.

## Development workflow

1. Read the relevant files in `changelog/`, `research/`, and `planning/` before changing scope or architecture.
2. Keep product changes/decisions in `changelog/` and research notes in `research/`, each as separate dated Markdown files; include links and an “Implication for BrushTales” section where relevant.
3. Keep `planning/*.md` task files canonical and refresh `planning/index.sqlite3` when task metadata, labels, sequencing, or dependencies change.
   Durable planning/research documents stay tracked; run-scoped specs, logs, PR drafts, disposable fixtures, and adversarial probes belong under ignored `tmp/` and are recreated or supplied for each run rather than indexed in SQLite. The task-009 isolation fixture is run-scoped evidence only and is not expected in a fresh checkout.
4. Prefer small, testable changes. Keep story data, scoring, timers, and device integrations independently testable.
5. Test on a physical recent iOS device and Android device before calling camera, wake-lock, or audio work complete. Simulate denied permissions and interrupted sessions.
6. Before handoff, run the repository’s available formatting, lint, typecheck, unit, and build commands. If a command is unavailable because the app has not been provisioned yet, say so rather than inventing a result.
7. Use read/search and patch/edit tools for repository changes. Do not use shell mutation (`sed -i`, in-place Perl/AWK, redirection, `tee`, inline interpreters, or generated patches), compound command chains, or self-edits to agent policies as permission workarounds. Keep run-scoped assertions, fixtures, logs, specs, and PR drafts under ignored `tmp/`; keep durable planning and research documents tracked.

## Non-negotiable delivery workflow

1. **Delegate application implementation.** The orchestrator may edit coordination artifacts (`AGENTS.md`, `planning/`, `.opencode/`, and `tmp/`) but must delegate application source, tests, and native changes to the `builder` agent in an isolated worktree.
2. **Red-green delivery.** The builder writes a meaningful failing test first, captures the RED failure, then implements the smallest change that makes it GREEN. Coordination-only changes use appropriate document or schema validation instead of inventing application tests.
3. **Adversarial review every batch.** Every implementation batch goes through the `adversary` agent. It may write and run disposable probes under ignored `tmp/` to exercise edge cases, but must not modify application or durable coordination files. Findings are categorized as blocking, major, minor, or nit. Blocking and major findings must be fixed and reviewed again before verification.
4. **Verify before done.** A batch is not complete until applicable planning integrity, typecheck, lint, tests, build, and physical-device gates pass. Do not claim a command or device check ran when it did not.
5. **Branch → worktree → PR → merge.** After the bootstrap commit, never commit directly to `main`. Each planning task gets a feature branch and worktree, then reaches `main` through a reviewed pull request. Commit, push, and PR creation require explicit user approval in the delivery command.
6. **Keep the planning index synchronized.** Task Markdown remains canonical; update `planning/index.sqlite3` when task status, labels, sequencing, dependencies, or completion notes change.

## OpenCode delivery commands

- `/build <task-id>` runs the delegated develop → adversarial-review → verify → PR preparation cycle.
- `/review` runs an adversarial review of the current or specified diff; the
  reviewer may create disposable probes under ignored `tmp/` but does not modify
  application or durable coordination files.
- `/verify` runs the applicable verification gates and reports pass/fail/unavailable status.

## Definition of done for v0 features

- A child can complete a full two-minute session without the screen sleeping while the session is active.
- The app gives useful, confidence-aware feedback across lighting, skin tones, toothbrush colors, glasses, and common camera angles, and degrades gracefully when it cannot tell.
- A session can reach at least two authored story outcomes based on progress and/or choices, with deterministic replay in tests.
- Two profiles can use the same device without data crossing between them.
- No camera frames, child voice recordings, or TTS credentials leave the device.
- The behavior is covered by unit tests for timer state, story branching, score thresholds, profile isolation, and interrupted sessions.

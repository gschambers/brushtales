# 005 — Build session state and audio player

- **Status:** todo
- **Priority:** high
- **Summary:** Implement deterministic two-minute session state and clip playback.
- **Labels:** audio, session, timer
- **Depends on:** 001, 003

## Goal

Implement the deterministic two-minute session state machine and clip-based audio playback.

## Acceptance criteria

- Start, pause, resume, stop, complete, and interrupted states are deterministic and unit-tested.
- The screen remains awake only while an active session needs it.
- Narration, ambience, and effects have independent volume controls where practical.
- Audio continues or recovers predictably through ordinary app interruptions.
- Four 30-second progress beats and a completion cue are exposed to the story engine.

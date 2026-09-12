# 003 — Create and approve narration assets

- **Status:** todo
- **Priority:** high
- **Sequence:** 3
- **Summary:** Audition TTS candidates and generate reviewed v0 story audio.
- **Labels:** audio, content, tts
- **Depends on:** 002

## Goal

Audition TTS candidates and generate a consistent, reviewed audio asset set for the v0 story.

## Acceptance criteria

- The same audition script is rendered by ElevenLabs, Cartesia, Google Chirp 3 HD, and OpenAI TTS.
- A selected narrator and any character voices pass pronunciation, warmth, pacing, and continuity review.
- Approved audio is versioned with its script, provider/model, voice settings, and transcript.
- The app consumes local audio assets; no provider secret or runtime TTS request is shipped to the client.
- Parent-facing product information discloses AI narration where required.

## Notes

Begin with ElevenLabs Eleven v3 and Multilingual v2, as recommended in the TTS research. Use a controlled content-generation environment for credentials.

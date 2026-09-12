# TTS candidate research

**Status:** ElevenLabs is the leading v0 candidate; final selection requires an apples-to-apples audition with the actual story script.

## Requirements

The narrator needs natural pacing, expressive emotion, stable character pronunciation, usable commercial terms, predictable asset generation, and enough language coverage for future localization. v0 does not need runtime-generated speech: pre-generating approved clips is safer for latency, offline use, cost control, and child privacy.

## Candidates

### ElevenLabs — recommended first audition

ElevenLabs offers expressive and long-form voice models, a large voice library, multilingual support, MP3/PCM output, and inline audio tags for emotion, emphasis, pauses, and non-verbal delivery. Its documentation positions Eleven v3 as the most expressive model and Multilingual v2 as a consistent long-form option.

**Best fit:** a humanistic fantasy narrator and recurring character voices.

**Trade-offs:** premium pricing, provider dependency, and the need to review voice licensing/consent and child-directed content terms. Use generated audio as an approved build artifact, not a client-side API call.

### Cartesia Sonic — strong low-latency alternative

Cartesia positions Sonic as a very low-latency, expressive streaming model with voice cloning, emotion controls, and broad language coverage. That is attractive if future versions need live narration or rapid branch playback.

**Best fit:** interactive or real-time dialogue where time-to-first-audio matters.

**Trade-offs:** the strongest reason to choose it is runtime latency, which v0 largely avoids by shipping audio assets. It still needs a quality audition for warm children’s narration and a review of licensing/voice-cloning requirements.

### Google Cloud TTS / Chirp 3 HD — enterprise and SSML option

Google documents Chirp 3 HD voices with streaming and batch support, and its release notes document SSML support. This is attractive for pronunciation, pause, pacing, localization, and an existing Google Cloud deployment.

**Best fit:** teams that prioritize structured SSML control, language breadth, and cloud governance.

**Trade-offs:** audition carefully against the more characterful delivery of ElevenLabs/Cartesia; cloud credentials must remain server-side or in a build pipeline.

### OpenAI `gpt-4o-mini-tts` — flexible, economical comparison

OpenAI’s speech endpoint supports built-in voices and natural-language instructions for tone, with `tts-1` and `tts-1-hd` also documented. The official documentation says the voices are currently optimized for English and requires clear disclosure that the voice is AI-generated.

**Best fit:** a quick comparison voice, scripted tone variations, or a cost-sensitive prototype.

**Trade-offs:** fewer voice/persona choices than the leading narration-focused candidates and an explicit disclosure requirement. Confirm current commercial terms before committing.

## Recommendation

Run a blind bake-off using the same 60–90 second scene, a character line, an excited choice prompt, a whisper/quiet line, and several invented names. Score naturalness, child-appropriate warmth, pronunciation consistency, emotional range, clip-to-clip continuity, latency, and total cost. Begin with Eleven v3 for expressive story moments and compare Multilingual v2 for longer, steadier narration. Keep Cartesia as the fallback if interactive latency becomes a requirement.

Generate audio in a controlled content pipeline, keep a voice/style bible, version every audio asset with its script, and disclose AI narration in the parent-facing product information where required by provider or platform policy.

## Implication for BrushTales

Do not make TTS a runtime dependency in v0. Produce and review a complete audio asset set before app implementation, beginning with an ElevenLabs audition and keeping Cartesia, Google, and OpenAI as comparison tracks. Store scripts, voice settings, provider/model versions, and approved renders together so a story can be regenerated consistently.

## Sources

- [ElevenLabs Text to Speech API](https://elevenlabs.io/text-to-speech-api)
- [ElevenLabs TTS documentation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [Eleven v3](https://elevenlabs.io/v3)
- [Cartesia voice generator and TTS](https://www.cartesia.ai/voice-generator)
- [Cartesia TTS documentation](https://docs.cartesia.ai/get-started/overview)
- [Google Cloud TTS release notes](https://docs.cloud.google.com/text-to-speech/docs/release-notes)
- [Google Cloud SSML tutorial](https://docs.cloud.google.com/text-to-speech/docs/ssml-tutorial)
- [OpenAI text-to-speech guide](https://platform.openai.com/docs/guides/text-to-speech)

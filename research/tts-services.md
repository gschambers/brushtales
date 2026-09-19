# TTS service research

**Research date:** 2026-09-19
**Use case:** Pre-generated, expressive English story narration for an
audio-first child-directed mobile app

## Evaluation criteria

- Warmth, intelligibility, emotional range, and consistency across a story.
- Long-form narration and stable pronunciation of invented names.
- Pacing controls, pauses, SSML or equivalent pronunciation controls.
- Availability of suitable adult or character voices without imitating a real
  child or an identifiable person.
- Commercial redistribution rights for packaged audio assets.
- Clear AI-voice disclosure requirements and child-directed terms.
- English quality first, with a credible path to additional languages.
- Downloadable audio formats, batch generation, and predictable cost.

## Shortlist

| Service | Evidence and strengths | Risks / questions | v0 fit |
| --- | --- | --- | --- |
| [ElevenLabs](https://elevenlabs.io/pricing/api) | Current API pricing lists expressive v3, long-form-oriented Multilingual v2, and fast Flash/Turbo models. It lists 70+ languages for v3, multi-speaker dialogue for v3, and a per-character API model. | Confirm commercial redistribution for the selected plan/model, voice usage rights, child-directed policy, and whether a chosen voice remains stable across regenerated clips. | **First audition.** Strongest initial candidate for humanistic story narration; pre-generate and review all assets. |
| [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech) and [Chirp 3 HD](https://cloud.google.com/text-to-speech/docs/chirp3-hd) | Google lists 380+ voices across 75+ languages/variants, long audio synthesis, SSML, audio formats, Gemini-TTS controls, and Chirp 3 HD voices with emotional range and natural intonation. | Cloud billing and region/model availability are more operationally involved. Verify voice licensing, batch workflow, and exact support for pronunciation controls in the selected model. | **Second audition / strongest localization option.** Particularly attractive if future language support matters. |
| [OpenAI Text to Speech](https://developers.openai.com/api/docs/guides/text-to-speech) | The current speech endpoint supports `gpt-4o-mini-tts`, instructions for accent, emotion, intonation, speed, tone, and whispering, several output formats, streaming, and 13 built-in voices. The docs recommend `marin` or `cedar` for best quality and require disclosure that the voice is AI-generated. | Voices are currently optimized for English. Must implement the required AI disclosure in product/content documentation and confirm redistribution terms for shipped assets. | **Controllable benchmark.** Useful for a bakeoff and short prompts; not the default until disclosure and long-form consistency are evaluated. |
| [Azure AI Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) | Neural voices, SSML, rate/pitch/volume/pronunciation controls, batch synthesis, and broad language/voice support are documented. | Enterprise setup and licensing can be heavier than needed for a small offline MVP; audition quality rather than assuming “neural” means story-quality. | **Fallback for localization or enterprise procurement.** |
| [Cartesia Sonic](https://cartesia.ai/pricing) | Sonic is positioned around very low-latency expressive speech, with emotion controls and commercial use on paid plans. | Its key advantage is realtime latency, which v0 does not need; verify long-form consistency, voices, and packaged-audio rights. | **Interesting later.** Not favored for a fixed offline story asset pipeline. |
| [PlayHT](https://playht.co/pricing) and [API docs](https://play.ht/docs) | Offers a voice library, MP3/WAV output, long-text/API workflows, and human-like voice positioning. | Public pricing/product surfaces vary; verify current service terms, plan rights, model stability, and operational availability before relying on it. | **Optional audition.** Keep as a comparison point, not the first integration. |

## Recommendation

Run a short blind audition using the same 8–10 story lines, including an
invented character name, an emotional shift, a pause, a gentle brushing prompt,
and a branch transition. Compare ElevenLabs, Google Chirp 3 HD or Gemini-TTS,
and OpenAI `gpt-4o-mini-tts`; add Azure if localization is a near-term goal.
Have caregivers rate warmth, clarity, age fit, and “sounds like a kind human
storyteller,” while children only provide age-appropriate preference feedback
with caregiver consent.

The provisional choice is **ElevenLabs for v0 content generation**, subject to
commercial and child-directed terms. The application should ship local MP3 or
AAC assets and never call a TTS API during a brushing session. Keep the audio
manifest independent from the vendor so a future re-voicing pass does not
change story logic.

## Content-production guardrails

- An adult reviews every generated clip before packaging.
- Use a consistent narrator voice and a small, reviewed set of character
  voices; do not clone a child or a real person without explicit rights and
  consent.
- Store source scripts and generated asset metadata, including vendor/model,
  voice ID, generation date, and license/terms review.
- Normalize loudness and test on phone speakers and inexpensive Bluetooth
  speakers.
- Add the required AI-voice disclosure wherever the selected provider or law
  requires it; do not describe synthetic narration as human performance.
- Treat all vendor prices as a snapshot from the research date and re-check
  before procurement.

# Sky Reef audio package

The app consumes stable asset IDs from `manifest.json`; it does not consume a
vendor name, prompt, or child/session data at runtime. Approved audio files are
packaged locally at release time and never synthesized in the client.

## Audition record

| Vendor/model | Voice ID | Date | Format | Result / licensing review |
| --- | --- | --- | --- | --- |
| ElevenLabs Multilingual v2 / expressive candidate | To be selected during caregiver bakeoff | 2026-09-19 | MP3, target 44.1 kHz | First audition candidate from the research shortlist; commercial redistribution and child-directed terms must be confirmed before packaging. |
| Google Cloud Chirp 3 HD | To be selected during caregiver bakeoff | 2026-09-19 | MP3, target 44.1 kHz | Benchmark for warmth and pronunciation; billing, voice availability, and redistribution terms require review. |
| OpenAI `gpt-4o-mini-tts` | `marin` or `cedar` benchmark | 2026-09-19 | MP3, target 44.1 kHz | Controllability benchmark; AI-voice disclosure and redistribution terms require review. |

The provisional production candidate is ElevenLabs, subject to a blind
caregiver listening review and licensing approval. No provider credential is
stored in this repository. The checked-in manifest is the reviewed content
contract; binary audio files are supplied only after the audition and legal
review gates are complete.

## Packaging checklist

- [ ] Adult reviews every clip for warmth, intelligibility, age fit, pacing,
  pronunciation, and positive language.
- [ ] Normalize clips and test on phone speakers and inexpensive Bluetooth
  speakers.
- [ ] Add the provider’s required AI-voice disclosure to the caregiver-facing
  product documentation before distribution.
- [ ] Place approved local MP3/AAC files at each manifest `bundledPath`.
- [ ] Run `npm run validate:content` after packaging.

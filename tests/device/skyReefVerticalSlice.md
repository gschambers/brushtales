# Sky Reef native vertical-slice acceptance checklist

Run this checklist on a representative portrait iOS device and Android device
after native builds are available. These are manual checks; record only coarse
derived statuses with caregiver consent. Never save or export camera frames,
face images, audio recordings, biometric identifiers, or model tensors.

## Core flow

- [ ] Select a local profile and open Sky Reef from the story shelf.
- [ ] Act 1 shows one **Begin story** action and no audio-only entry action.
- [ ] Opening audiobook remains visible until its local clip completes.
- [ ] Act 2 starts automatically after opening completion.
- [ ] Camera-visible state keeps the preview slot above the atlas.
- [ ] Camera denied or unavailable preserves the same brushing layout and a
  calm fallback notice.
- [ ] Countdown displays seconds only (`120`, not `2:00`) beneath the camera
  slot.
- [ ] Pause and resume preserve the remaining session time and active zone.
- [ ] The brushing surface has no child-facing **Finish adventure** action.
- [ ] App backgrounding pauses the running session; returning allows resume.
- [ ] The screen-awake request can be denied or revoked without stopping the
  timer or audio story, and the UI says the screen may dim.
- [ ] The rightmost upper and lower atlas zones keep the enlarged toothbrush
  inside the viewport on narrow portrait widths.
- [ ] The authored 18-zone cycle completes without a competing finish action.
- [ ] Act 3 closing audiobook begins automatically after brushing completion.
- [ ] Closing completion navigates once to the positive completion screen.
- [ ] Completion offers **Return to profiles** and no dental quality or failure
  judgment.

## Platform and accessibility checks

- [ ] All primary controls have large touch targets and spoken labels.
- [ ] Camera and audio failures do not produce an unhandled native error.
- [ ] Reduced-motion settings keep the atlas and playback control usable.
- [ ] The caregiver supervision reminder remains available in the surrounding
  setup/settings path.
- [ ] Session summaries are stored locally only; no network request or raw
  media persistence occurs.

## Run record

Record device model/OS, build identifier, scenario statuses, observed elapsed
duration drift, audio interruption count, and whether fallback behavior stayed
usable. Do not attach child media or identifying details.

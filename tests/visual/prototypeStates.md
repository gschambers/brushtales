# BrushTales prototype state matrix

The prototype is disposable and is reviewed before production UI work. Open it
with `agent-browser` using `file://` and capture each state at 320px and 430px
widths. The latest captures are in the temporary directory
`$TMPDIR/brushtales-prototype` and are not committed.

The native Sky Reef vertical slice intentionally narrows the prototype’s
post-session behavior: Act 3 is the narrative conclusion and proceeds to the
positive completion screen, without the prototype’s later story-choice sheet.

| State | Entry | Primary action | Accessibility check | Screenshot/review |
| --- | --- | --- | --- | --- |
| `welcome` | `?state=welcome` | Create a profile or start a new story | one named CTA is exposed; existing profile gets a warm greeting and settings hold | `$TMPDIR/brushtales-prototype/welcome-430.png`; landing and story-start variants are folded together |
| `profile` | welcome → create profile | Continue | name input has an accessible label | `$TMPDIR/brushtales-prototype/profile-430.png`; no avatar selection |
| `opening` | welcome → start a new story | Begin story | Act 1 audiobook heading and one clearly labeled start action are exposed | Opening audiobook sets the scene before the brushing activity; `preflight` remains a direct-query alias |
| `running` | opening → begin story | Pause adventure | pause label, seconds-only timer, active zone, muted exit, and session tone are exposed | `running-camera-320.png`, `atlas-front-320.png`, `atlas-chewing-320.png`, `atlas-inside-320.png`, `running-430.png`, and `running-430-reduced-motion.png`; camera preview is above, the playback button/audio visualization sit left of the atlas, background decoration is reduced, and no extra actions compete |
| `paused` | running → pause | Resume adventure | resume label and muted exit are exposed | `$TMPDIR/brushtales-prototype/paused-430.png`; active zone remains stable while paused |
| `audioOnly` | direct fallback fixture | Pause adventure | listening heading, compact playback/visualization cluster, seconds-only countdown, and muted exit remain | `$TMPDIR/brushtales-prototype/audioOnly-430.png`; no Act 1 entry, listening chip, Keep listening, or Finish buttons |
| `closing` | brushing cycle complete → closing audiobook | Continue to story choice | Act 3 heading and one clearly labeled continuation action are exposed | Closing audiobook follows the brushing activity before the authored choice sheet |
| `settings` | hold the warm welcome gear | Back to stories | settings view is opened only after the hold completes | `$TMPDIR/brushtales-prototype/settings-320.png`; short press resets without opening |
| `choice` | running → story choice | choose one option | exactly two choice buttons are exposed | `$TMPDIR/brushtales-prototype/choice-430.png`; two large options are easy to scan |
| `complete` | audio-only → finish | Return to profiles | positive completion copy is visible | `$TMPDIR/brushtales-prototype/complete-430.png`; warm ending keeps the same world |

Review results: `node --check prototype/prototype.js` passes; axe audits for all
eight listed states report zero violations and no incomplete checks. The
prototype has clear focus, large targets, non-color zone cues, and no clipping
at 320px.

## Authored 18-zone atlas

The mouth guide contains six surface bands, each with left, center, and right
positions. The prototype advances one position every 1.5 seconds with
`?fast=1`; production pacing is approximately 6–7 seconds per position, or
20 seconds per band across a two-minute session.

1. upper front/outer — left, center, right
2. upper chewing/top — left, center, right
3. upper inside — left, center, right
4. lower front/outer — left, center, right
5. lower chewing/top — left, center, right
6. lower inside — left, center, right

The browser interaction check confirmed that the active label advances while
running and remains stable for at least 2.2 seconds while paused. Audio-only
remains available only as a direct fallback fixture while the Act 1 child-facing
flow uses one “Begin story” action. The mouth
registers now use curved, individually tooth-shaped forms rather than square
tiles. The compact atlas is tucked into the bottom-right corner with no tongue
ellipse or explanatory copy; front rows retain a slight curve with a narrow
closed-mouth seam with both tooth silhouettes inverted from their prior
orientation while the tracks retain their arcs, while top-view chewing and
inside rows use taller adjacent tracks with stronger arches. Inside rows share
the chewing geometry and crease details while retaining edge-only highlights.
Every row uses ten tooth forms in a balanced 3 / 4 / 3 grouping, with four
teeth in the center target. The brushing layout uses a separate floating
seconds-only countdown circle beneath the camera slot and a playback/audio
visualization halo layered behind the control to the left of the atlas.
A decorative vector toothbrush sweeps over the active arch. Chewing registers
show crease patterns on the
simplified premolar/molar forms only, while inside registers use a partial coral
band on the gap-facing tooth edges.

The current session surface exposes only the playback control and a muted header
exit. Profile setup uses a single child-name input. The welcome
screen uses local prototype storage to switch from profile creation to a warm
returning-family greeting after a profile is saved.

The warm landing interaction check confirmed that a 1.2-second hold opens
settings, while a 250ms press leaves the story CTA screen unchanged. The
playback slot remains reserved when the camera preview is hidden, and inactive
teeth are white with the coral highlight preserved.

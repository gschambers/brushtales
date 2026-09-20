# BrushTales prototype state matrix

The prototype is disposable and is reviewed before production UI work. Open it
with `agent-browser` using `file://` and capture each state at 320px and 430px
widths.

| State | Entry | Primary action | Accessibility check | Screenshot/review |
| --- | --- | --- | --- | --- |
| `welcome` | `?state=welcome` | Set up an explorer | setup and returning-profile buttons are named | reviewed at 390px; clear single focal action |
| `profile` | welcome → setup | Continue | avatar buttons expose pressed state | reviewed at 320px and 390px; two-column narrow layout prevents overflow |
| `preflight` | profile → continue | Begin chapter | audio-only path is named | reviewed at 390px; permission/wake copy stays secondary |
| `running` | preflight → begin | Pause adventure | pause label and active zone are exposed | reviewed at 320px and 390px; timer, ring, camera tile, and atlas remain legible |
| `paused` | running → pause | Resume adventure | resume label is exposed | represented by the running composition with the ring settled |
| `audioOnly` | preflight → audio-only | Keep listening | listening-mode status is visible | reviewed at 390px; composition remains intact without camera tile |
| `choice` | running → story choice | choose one option | exactly two choice buttons are exposed | reviewed at 390px; two large options are easy to scan |
| `complete` | audio-only → finish | Return to profiles | positive completion copy is visible | reviewed at 390px; warm ending keeps the same world |

Review results: `node --check prototype/prototype.js` passes; axe audits for all
seven listed states report zero violations and one incomplete manual
color-contrast review. The prototype has clear focus, large targets, non-color
zone cues, and no clipping at 320px after changing the avatar grid to two
columns. Captures remain in the temporary `$TMPDIR/brushtales-prototype`
directory and are not committed.

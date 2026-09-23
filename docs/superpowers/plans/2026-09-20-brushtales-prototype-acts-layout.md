# BrushTales Prototype Acts and Brushing Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the disposable BrushTales prototype with a locally attributed stock toothbrush vector, an explicit three-act audiobook flow, and a quieter brushing layout with a seconds-only countdown and side-by-side playback/atlas controls.

**Architecture:** Keep the prototype as a standalone HTML/CSS/JavaScript state machine. Add `opening` and `closing` presentation states while retaining `preflight` as an opening alias and existing direct-query states for visual review. Keep brushing-session tone, atlas geometry, audio-only fallback, pause behavior, and reduced-motion behavior unchanged except where the new layout requires them.

**Tech Stack:** Standalone HTML, CSS, JavaScript, inline/local SVG asset, Jest source-regression tests, agent-browser screenshots and axe audits.

**Spec:** `docs/superpowers/specs/2026-09-20-brushtales-ux-design.md`

## Global Constraints

- Audio leads and the screen remains a quiet companion.
- The session exposes one primary play/pause action; exit remains muted.
- The floating countdown is a seconds-only duration cue and does not imply brushing quality.
- The stock vector is stored locally, never hotlinked, and carries attribution/license information.
- The prototype must not add accounts, uploads, camera persistence, clinical claims, or runtime-generated child-facing text.
- Each atlas row uses ten teeth grouped 3 / 4 / 3 from left to right; the four-tooth center group is used consistently for upper and lower rows.
- Opening and closing audiobook copy remains encouraging, authored, and short.
- Existing direct state URLs remain usable for visual review.
- Reduced motion removes playback/brush motion while preserving state and meaning.

## Review Focus

- **Act transitions:** landing enters the opening audiobook, opening enters brushing, brushing can reach the closing audiobook, and closing reaches the existing choice flow.
- **Countdown separation:** the countdown is no longer inside the play button and remains readable at 320px.
- **Compact controls:** the playback button sits in front of its audio visualization halo, with the whole cluster directly beside the bottom-right atlas without colliding.
- **Asset provenance:** the local toothbrush asset includes source, author/project, and CC BY-SA 4.0 attribution.
- **Fallback states:** paused and direct audio-only fixture layouts retain the countdown, compact playback, atlas, and accessible labels.
- **Atlas balance:** every row has a three-tooth left group, four-tooth center group, and three-tooth right group; lower-row reversal preserves those visual groups.

---

### Task 1: Add the locally attributed toothbrush asset

**Files:**
- Create: `prototype/assets/openmoji-toothbrush.svg`
- Create: `prototype/assets/ATTRIBUTION.md`
- Modify: `tests/visual/prototypeAtlas.test.ts`

**Interfaces:**
- The prototype consumes the asset at `./assets/openmoji-toothbrush.svg` through an `<img>` inside the decorative brush wrapper.
- The asset remains `aria-hidden`; the atlas figure retains the accessible active-zone label.

- [ ] **Step 1: Write the failing asset-source test**

Assert that the prototype references the local asset and that the attribution file names OpenMoji, the source URL, and CC BY-SA 4.0.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: FAIL because the local asset reference and attribution file do not exist.

- [ ] **Step 3: Download the reviewed SVG and record attribution**

Save the OpenMoji toothbrush SVG from `https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/1FAA5.svg` under the local asset path. Record OpenMoji by the OpenMoji project, the source URL, access date, and `CC BY-SA 4.0` in `ATTRIBUTION.md`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: PASS.

### Task 2: Make the narrative structure explicit

**Files:**
- Modify: `prototype/prototype.js`
- Modify: `tests/visual/prototypeAtlas.test.ts`
- Modify: `tests/visual/prototypeStates.md`
- Modify: `docs/superpowers/specs/2026-09-20-brushtales-ux-design.md`

**Interfaces:**
- `opening` and `preflight` render Act 1 and expose one `Begin story` action.
- `running`, `paused`, and `audioOnly` render Act 2.
- `closing` renders Act 3 and exposes `Continue to story choice`.
- `choice` remains the authored post-audiobook choice surface.

- [ ] **Step 1: Write failing state-flow assertions**

Assert that the source defines Act 1/2/3 state labels and controls, that the landing action enters `opening`, and that the closing state leads to `choice`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: FAIL because the current prototype enters `running` directly and has no `closing` state.

- [ ] **Step 3: Implement the smallest state-flow change**

Add `opening` and `closing` to the state labels and control map. Keep `preflight` as an alias to the opening audiobook for existing URLs. Change the warm landing CTA to `opening`; have the opening CTA enter `running`; have a session completion action enter `closing`; and have closing continue to `choice`. Keep direct `?state=running`, `?state=paused`, `?state=audioOnly`, `?state=choice`, and `?state=complete` behavior intact.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: PASS.

### Task 2A: Balance the atlas groups at 3 / 4 / 3

**Files:**
- Modify: `prototype/prototype.js`
- Modify: `prototype/prototype.css`
- Modify: `tests/visual/prototypeAtlas.test.ts`
- Modify: `tests/visual/prototypeStates.md`

**Interfaces:**
- `teethRow(arch, activeZone)` renders ten tooth forms in local row order.
- Active groups use explicit ranges `[0, 3)`, `[3, 7)`, and `[7, 10)` rather than `Math.floor(index / 3)`.
- Lower rows reverse local indexes before selecting the active group, so the 3 / 4 / 3 grouping remains visually symmetric after the row transform.

- [ ] **Step 1: Write failing atlas-balance assertions**

Assert that the source renders ten teeth, defines the center group as indexes `3` through `6`, and uses explicit group boundaries for active highlighting and brush anchors.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: FAIL because the current row contains nine teeth and uses three equal groups.

- [ ] **Step 3: Implement explicit 3 / 4 / 3 grouping**

Render ten teeth, update the local tooth curvature selectors through the tenth tooth, and calculate the active group from the explicit ranges. Use group centers appropriate to the 3 / 4 / 3 layout for the toothbrush anchor while keeping lower-row coordinates local to the transformed row.

- [ ] **Step 4: Run the focused test and capture all six atlas bands**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`.

Capture upper/lower front, chewing, and inside zones at 320px and 430px. Verify the middle highlight contains four teeth and remains centered on every row.

### Task 3: Recompose the brushing screen controls

**Files:**
- Modify: `prototype/prototype.js`
- Modify: `prototype/prototype.css`
- Modify: `tests/visual/prototypeAtlas.test.ts`
- Modify: `tests/visual/prototypeStates.md`

**Interfaces:**
- `playback(mode)` renders a compact control with the play/pause glyph layered in front of its decorative audio visualization halo; it does not render the countdown.
- `countdown()` renders the remaining duration as seconds in a contrasting dark circle beneath the camera-preview slot.
- The active brush uses the local asset, remains positioned in the transformed row coordinate system, and stays decorative.

- [ ] **Step 1: Write failing layout assertions**

Assert that playback layers the visualizer behind `.playback`, countdown markup follows the camera-preview slot, the old `data-seconds` countdown pseudo-element is absent, and the local toothbrush asset is referenced.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`

Expected: FAIL because the current playback is central and embeds seconds in the button.

- [ ] **Step 3: Implement the layout**

Move the audio visualization ring into a small `audio-visualizer` wrapper layered behind the playback button, keep the button at a 48px minimum hit target, add a seconds-only countdown circle beneath the camera-preview slot, and reserve the bottom-right atlas space. Use the enlarged local toothbrush image inside the existing transformed row wrapper; do not reintroduce the generic `.lower` class on the brush.

- [ ] **Step 4: Run focused tests and browser review**

Run: `npx jest tests/visual/prototypeAtlas.test.ts --runInBand`.

Capture `opening`, `running`, `paused`, `audioOnly`, `closing`, and `choice` at 320px and 430px. Verify the countdown is visually separate, the playback control and atlas do not overlap, and upper/lower brush heads touch the active target surface.

### Task 4: Update documentation and verify the prototype

**Files:**
- Modify: `docs/superpowers/specs/2026-09-20-brushtales-ux-design.md`
- Modify: `tests/visual/prototypeStates.md`

- [ ] **Step 1: Document the three acts and asset decision**

Record the Act 1 opening audiobook, Act 2 brushing activity, Act 3 closing audiobook, countdown/control hierarchy, and local OpenMoji attribution boundary.

- [ ] **Step 2: Run repository verification**

Run: `node --check prototype/prototype.js && git diff --check && npm run ci`.

Expected: lint, typecheck, all tests, story validation, and safety-copy validation pass.

- [ ] **Step 3: Run responsive accessibility verification**

Run axe audits for `opening`, `running`, `paused`, `audioOnly`, `closing`, `choice`, `settings`, and `complete` at 320px and 430px. Expected result: zero violations and zero incomplete checks.

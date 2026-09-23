# Brushing guidance used for the BrushTales visual prototype

**Research date:** 2026-09-20
**Scope:** Timing and surface vocabulary for an audio-first child brushing prompt

## First-party sources

- [American Dental Association: Home Oral Care](https://www.ada.org/resources/ada-library/oral-health-topics/home-care), accessed 2026-09-20. The ADA recommends brushing twice daily with fluoride toothpaste for two minutes. Its evidence summary describes 30 seconds per quadrant as one way to divide a two-minute session and explicitly notes that duration evidence uses surrogate plaque measures.
- [ADA MouthHealthy: Brushing Your Teeth](https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth), accessed 2026-09-20. The technique guidance names the outer, inner, and chewing surfaces and describes short, tooth-width strokes.
- [NHS: How to keep your teeth clean](https://www.nhs.uk/live-well/healthy-teeth-and-gums/how-to-keep-your-teeth-clean/), accessed 2026-09-20. The NHS recommends about two minutes, cleaning inside, outside, and chewing surfaces, and says children should be helped or supervised until at least age seven.
- [American Academy of Pediatric Dentistry: Parent FAQ](https://www.aapd.org/resources/parent/faq/), accessed 2026-09-20. The AAPD states that children should use a soft-bristled toothbrush twice a day for two minutes.

## Product interpretation

The sources support three surface families—front/outer, chewing/top, and
inside—and a two-minute whole-session duration. They do not define an
18-target child-facing animation model. BrushTales therefore uses the following
authored pacing model as an interaction design choice, not as a clinical score
or a claim that each highlighted target has been cleaned:

1. Upper front/outer: left, center, right.
2. Upper chewing/top: left, center, right.
3. Upper inside: left, center, right.
4. Lower front/outer: left, center, right.
5. Lower chewing/top: left, center, right.
6. Lower inside: left, center, right.

Each band lasts 20 seconds, and each of its three positions is highlighted for
approximately 6–7 seconds. The prototype may run this cycle faster when opened
with `?fast=1` so the animation can be inspected quickly. Production should
derive the active position from the injected monotonic session clock rather
than a UI timer that can drift.

## Safety boundary

The illustration is an authored brushing prompt. It must not display camera
confidence, claim that a tooth was detected or cleaned, or imply that the app
can assess plaque, cavities, gum health, pressure, or clinical technique. A
caregiver remains responsible for supervision and individualized dental advice.

# Toothbrushing app research

**Status:** Research complete; patterns accepted as product inputs, not copied features.

## Candidates reviewed

### Pokémon Smile

The official product description uses the device camera while the child brushes, turns brushing into rescuing Pokémon, awards consistency, offers reminders, and supports a one-to-three-minute timer. It is the closest precedent for camera-assisted play and for linking “thorough” brushing to a collectible outcome.

**Useful pattern:** make the camera a source of immediate story-world feedback rather than a separate dashboard.

**Risk:** a branded collection loop can overshadow the habit, and camera feedback must be tested carefully across real homes and children.

### Disney Magic Timer by Oral-B

Oral-B describes character-led brushing, stickers, a calendar, and a dentist-recommended two-minute goal. The product page also describes a training mode that can use a one-minute session before moving to two minutes.

**Useful pattern:** a visible two-minute journey plus collectible rewards makes duration concrete and repeatable.

**Risk:** the reward model is familiar and license-dependent. BrushTales should differentiate through authored branching audio and original characters rather than licensed stickers.

### Brush DJ

Brush DJ is a timer-first app created around two minutes of music, with 30-second side-switch cues and twice-daily reminders. It is a useful low-complexity benchmark: the music makes the full duration more tolerable without needing computer vision.

**Useful pattern:** four simple time segments are easier for a child to follow than a constantly changing score.

**Risk:** music alone does not verify motion or support a branching narrative.

### Brushing Hero

Brushing Hero describes a camera-based game in which a toothbrush becomes a weapon, brushing from different angles powers attacks, and progression unlocks heroes and helmets. Its store listing also shows an offline/no-data-sharing posture.

**Useful pattern:** brushing direction/coverage can be expressed as a playful world mechanic.

**Risk:** third-party reviews report unreliable tracking in some conditions. BrushTales should use confidence thresholds, show a fallback timer, and avoid claiming detection is accurate until it has been measured on representative devices and users.

## Product implications

1. Start the story immediately and make every 30-second segment meaningful; do not make the child stare at a progress chart.
2. Use encouragement and recovery paths, not punishment for low confidence or missed areas.
3. Treat “success” as a combination of time, detected motion, and confidence. Keep the exact score hidden or simplified for children.
4. Make the camera optional from a product perspective, even if it is the signature feature technically.
5. Validate with supervised, real-world brushing sessions before tuning thresholds. Lighting, mirror placement, camera angle, toothbrush color, and adult assistance are core test variables.

## Implication for BrushTales

The differentiator should be an original, audio-first branching adventure whose progress responds gently to brushing—not another timer with a collectible overlay. The first prototype should measure whether children understand the four time segments and recover comfortably when the detector is uncertain.

## Sources

- [Pokémon Smile — official site](https://smile.pokemon.com/en-us)
- [Pokémon Smile — official product page](https://www.pokemon.com/us/app/pokemon-smile)
- [Disney Magic Timer — Oral-B](https://oralb.com/en-us/disney-magic-timer)
- [Brush DJ — official site](https://www.brushdj.com)
- [Brushing Hero — Google Play listing](https://play.google.com/store/apps/details?id=jp.co.litalico.brushinghero&hl=en_US)
- [Brushing Hero — developer site](https://app.litalico.com/brushinghero/index.html)
- [AAPD parent FAQ](https://www.aapd.org/resources/parent/faq) — two minutes twice daily guidance and caregiver assistance context.

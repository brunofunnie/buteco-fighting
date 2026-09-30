# Six distinct spectators

Five new original GPT illustrated bases and separate canonical four-frame component rows, plus the previously accepted terracotta man. Three women and three men have distinct faces, hair, costumes and actions: applause, cupped-hands shouting, warm toast, bearded fist cheering, older hatted drinking, terracotta mug/fist cheer. No recolors or mirrored copies are counted as new identities.

Every frame's contact sheet was visually inspected: realistic shaped adult anatomy, same identity and clothing across each row, feet planted, mugs attached to hands, legible open mouths on shouting/cheering poses. The clap has a small but distinct hands-apart → hands-closer → palm contact → recovery cycle; inspect warns low global motion (0.0065), consistent with a localized hand gesture. All five inspect reports have zero errors; the other four have zero warnings. Short four-pose loops are best-effort background gestures rather than measured continuous motion capture.

Runtime crowd-manifest.json has 24 actual PNG paths, fps3. Metadata bodyHeadTopY is manually reviewed hair-crown pixel (older man's hat crown) in EXPORTED384px PNGs, separately from raised mug/arms. SoleY is opaque alpha>120 bottom exclusive. Scale=1/(soleY-bodyHeadTopY), so physical height remains the chosen165/175px on every pose instead of fitting raised arms into a fixed figure bbox. Raised arms occupy additional space naturally. Foot anchors use opaque baseline and canonical foot centroid. Publisher reads images only; it never modifies image pixels.

Pose annotations: woman_toast frame2 head35; man_cheer frame1 head25, frame2 head30; retained man_toast frame2 head60. Most rest crowns16/17, sole368. This corrects the prior terracotta cheer physical shrinking when mug rises above his head.

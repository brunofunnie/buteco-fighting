# Illustrated background patrons

Accepted base: original GPT-generated hand-painted Brazilian patron, warm terracotta shirt, charcoal trousers, anatomical adult limbs and detailed face. No extra motion reference. Two canonical GPT component rows, cheer and drink, four poses each at 3 fps. Extracted, composed and exported with sprite-gen tools; no image editing, fixed-grid cutting or manual redraw.

Visual review of every frame confirms consistent identity, attached mug, stable planted feet and intact anatomy. Cheer progresses chest-level mug → forward toast → raised mug and fist → relaxed recovery. Drink progresses mug at chest → raised to mouth → visible sip → forward toast. Both loops are short best-effort cycles; the drink toast-to-chest seam is a purposeful return gesture, not a measured seamless motion-capture cycle. Automated inspect: ok, zero errors and warnings.

Runtime consumes crowd-manifest.json, separate from canonical manifest.json. Each exported frame's scale compensates canonical individual fitting using the canonical source component height relative to that row's resting first pose. Renderer multiplies scale by the 90 px physical resting height, keeping arms-up pose anatomy consistent rather than shrinking raised poses. Bottom/foot centroid anchors keep shoes on the background sidewalk. No stride claim applies to these stationary gestures.

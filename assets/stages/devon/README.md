# Covil do Devon

`arena.png` is the side view used only for the Devon confrontation (stage 4).
`approach.png` is another camera angle of the same warehouse, generated from
`arena.png`, and is the background of the Arcade progression screen.

The prompts and generation reports retain the provenance of both images.
The runtime does not alter the generated backgrounds. `devon-lair.js` overlays
scrolling code on four reviewed monitor bounds in the 2048×768 arena image and
adds subtle light beams under the rectangular ceiling fixtures. Animation is
deterministic from the simulation time. The stage has no crowd or bar signage.

Normal stage selection and online matches still use stages 0–3. Arcade routes
reserve stage 4 for the sixth match, and the secret Devon shortcut uses it too.

Validation: `node harness/devon-lair.mjs` checks responsive progression, removed
labels, visible footer controls, dedicated boss stage, its VS thumbnail, loaded
background art and animated screen pixels. The campaign harness checks the full
five-rival progression, rematches, boss and secret route.

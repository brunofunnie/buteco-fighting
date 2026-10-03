# Opening screen layers

Current crowd: `seven-crowd-background.png`, a cohesive generated illustration made in two sequential edits, each conditioned on seven original characters and face closeups. Each side has seven detailed characters and a distant faceless silhouette crowd. Original sprites are references, not runtime cutouts. Left generation is retained as `../references/title/seven-left-generation.png`, and exact identities/reference paths are in `seven-crowd-reference.json`.


- `../references/title/alley-environment.png`: empty environment reference plate. The wet alley, bars, lighting and floor are retained; generated people were removed. The previous runtime sprite collage has been removed.
- `devon-main-illustrated.png`: current illustrated boss artwork, transparent 1122 × 1402 PNG, generated from the original boss portrait with the crowd illustration as its style reference. Same composition and frame dimensions; existing animated electricity and eyes remain separate.
- `../references/title/devon-main-realistic.png`: original realistic boss artwork, retained unchanged as a reference.
- `buteco-fighting-logo.png`: transparent brush-style ivory/gold wordmark and crown generated from the user's concept reference.
- `logo_buteco_games.png`: existing studio mark, unchanged.

The tagline and start button remain HTML. The background contains no game logo, start button or Devon. The current crowd is generated artwork conditioned on original portraits; facial details can still be reinterpreted. Roster source assets remain unchanged.

Browser verification: `node harness/title-crowd.mjs` checks loading, independent layers, navigation and three viewport sizes.

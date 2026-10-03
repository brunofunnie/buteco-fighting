# Arena assets

Runtime panoramas live in `brazil/`: `sao-paulo.png`, `rio.png`, `recife.png` and `manaus.png`. Devon uses `devon/arena.png`; the route screen uses `devon/approach.png`. Earlier replaced arena concepts have been removed.

`brazil/README.md` documents the current environments and outdoor NPCs. NPC frames and manifests in `brazil/npcs/` and `public-v6/` are used by runtime; `patrons/` retains their production sources. Prompts, raw images and reports for current art remain available for regeneration.

`src/stages.js` handles scrolling, parallax and environmental animation. Missing art has a procedural fallback.

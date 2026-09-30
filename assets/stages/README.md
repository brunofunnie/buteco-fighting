# Brazilian bohemian night arenas

Generated with the sprite-gen GPT subscription route (`--provider codex`), using the saved prompts in `prompts/`. All three final images are opaque RGB PNGs, 2048 × 768. Reports and raw outputs preserve generation evidence; no pixel edits or local image resizing were applied.

- `sao-paulo.png`: Bixiga-inspired botecos, tiled roofs, worn ochre walls, amber tungsten lamps, clear cobbled foreground.
- `rio.png`: Lapa-inspired aqueduct arches, warm bars and distant samba silhouettes behind background railings.
- `recife.png`: Recife Antigo-inspired colonial facades, balconies and festival bandeirinhas.

Visual inspection found no foreground floor obstructions or futuristic neon. The generated curb is around 76% image height rather than the requested 82%; the game floor at y590/720 sits on the broad clear foreground road. These are artistic locations, not architectural reconstructions.

`stages.js` translates the painted architecture at 0.58 camera speed and the ground at world speed, preserving the 1920-wide arena. Warm light glows align to lamps measured in each panorama. Recife's four tiny stepped pennants sit on the existing flag string. Dim floor reflections use the actual ground plane. Details use three restrained poses per second and always draw behind fighters.

If art fails to load, the renderer paints cached Brazilian bar facades, shutters, Lapa arches, warm lamps and cobblestones. No generation provider defaults were saved.

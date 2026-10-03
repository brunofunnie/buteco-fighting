Brazilian stage and outdoor NPC assets
===============================

Generated using sprite-gen's confirmed GPT subscription (`codex`) route. Stage targets are 2048x768 (8:3), mapped to the game's 1920x720 world; floor targets are 590 game pixels for fighters and535 for rear NPCs. São Paulo depicts the plaza beneath MASP's suspended red-beamed museum; Rio depicts Copacabana sand, sea, Sugarloaf and cable car; Manaus depicts a timber floating platform with black tire bumpers and the central black/brown river seam. Recife retains its accepted previous image.

`build-assets.py stages` performs one actual GPT image generation per missing panorama. `build-assets.py npcs` creates each distinct reference and a canonical separated component-row four-pose animation. No one-shot sprite grids or fixed cell cutting.

NPC IDs: goth_woman, goth_man, pedestrian, seated_adult. Animation motion at3fps. Seated adult stays seated with blanket and bag, depicted respectfully. The renderer must give the seated silhouette a shorter target height than the standing people, preserving adult anatomical size.

`process-npcs.py` runs canonical extract/atlas/GIF/PNG export/inspection. Runtime metadata derives feet from opacity and manually reviewed head-top annotations in EXPORTED pixel coordinates. Normalizing the full silhouette would shrink raised-arm poses, so crown-to-sole normalization excludes arm height. All export boundaries require transparent padding.

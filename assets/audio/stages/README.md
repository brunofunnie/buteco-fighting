# Arena music

Generated through ElevenLabs Music v2_5. Each composition has four different planned sections of 24 seconds. Runtime tracks last approximately 94 seconds after a one-bar tail/head crossfade for continuous looping.

São Paulo keeps its original urban rock/pop arrangement. Revised Rio, Recife and Manaus themes put regional rhythm and lead instruments in the foreground, with rock/pop energy as secondary accompaniment:

| Arena / state | Musical direction |
| --- | --- |
| MASP / São Paulo | Urban guitar riffs, electric piano, subtle saxophone hooks, E minor and Dorian color |
| Rio de Janeiro | Bohemian samba/MPB, prominent fingerpicked nylon guitar, cavaquinho, pandeiro, tamborim and surdo; G major, sevenths, ninths and secondary dominants |
| Recife / Pernambuco | Sertão-inspired electric baião, prominent accordion, zabumba, triangle and viola; D Mixolydian and major pentatonic original riffs |
| Manaus / Amazonas | Boi-bumbá percussion ensemble and brega guitar/organ melodies; A minor, harmonic minor and contrasting C major |

Each directory retains the composition request, original generated MP3, runtime MP3 and measured metadata. `manifest.json` gathers the four runtime metadata records. The existing Devon and São Paulo themes are unchanged. Rejected previous Rio, Recife and Manaus pop-rock versions were removed during cleanup. Melodies are original; existing songs are not quoted.

Reproduction: `python harness/generate-stage-music.py --generate` with NumPy, FFmpeg and the configured ElevenLabs CLI. Existing originals are reused instead of requesting another generation.

Browser validation: `node harness/stage-music.mjs` (defaults to the local game server on port 3197; override using `GAME_URL`).

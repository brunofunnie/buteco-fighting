<div align="center">

# 🍻 Buteco Fighting

**Do balcão para o combate.**

A Brazilian browser fighting game. Pick your regular. Settle it in the arena.

![Fighters](https://img.shields.io/badge/Fighters-54-ffb522?style=for-the-badge&labelColor=0a142b)
![Arenas](https://img.shields.io/badge/Brazilian_arenas-4-ffb522?style=for-the-badge&labelColor=0a142b)
![Sprites](https://img.shields.io/badge/Sprite_frames-2%2C792-ffb522?style=for-the-badge&labelColor=0a142b)
![Engine](https://img.shields.io/badge/Phaser-3.90-fff3d6?style=for-the-badge&labelColor=0a142b)

[Play locally](#get-in-the-ring) · [Controls](#controls) · [Meet the roster](#the-regulars) · [Development](#under-the-hood)

![Buteco Fighting opening screen with all 28 fighters](docs/images/title.png)

</div>

## One keyboard. Two rivals. No installation for players.

Buteco Fighting brings an arcade cabinet to the browser: a full cast of original characters, Brazilian city stages, animated crowds and a warm amber-and-midnight interface. The menus are in Portuguese. The rivalry needs no translation.

| Mode | Your night at the Buteco |
| --- | --- |
| **Arcade** | Defeat five rivals in randomly chosen arenas, then face Devon in his lair. |
| **Modo Livre** | Choose a CPU rival and arena for a standalone match. |
| **Versus** | Two players share a keyboard. Pick both fighters and settle the score locally. |
| **Training** | Practice movement, combos and powers; enable CPU fighting and choose its difficulty from the pause menu. |

**The fight:** directional jumps, air and crouching attacks, uppercuts, sweeps, dashes, blocking, hitstop and knockdowns. Each fighter has a special and a super, with powers ranging from sonic waves and returning tools to digital cubes, holograms and lunar mist.

**The cabinet:** live character previews, alternating special/super demonstrations on a Cartesian training grid, full-screen menus, sound settings and touch controls. The browser loads combat animations for the selected pair on demand.

![Ana fighting Vinil in Copacabana](docs/images/gameplay.png)

## Get in the ring

You need a recent Node.js installation, npm and a modern browser.

```sh
git clone git@github.com:brunofunnie/buteco-fighting.git
cd buteco-fighting
npm ci
npm start
```

Open **[localhost:3187](http://localhost:3187)**. No build step or API key is needed to play: the published sprites, arenas and audio ship with the repository.

To use another port:

```sh
PORT=3188 npm start
```

## Docker deployment

Build and publish locally to Docker Hub; Bender only pulls the finished image. The build selects playable assets and encodes game images as lossless WebP, checking visible decoded pixels before replacing them. Dimensions, colors and alpha stay intact. Social sharing covers keep their PNG format. The server maps the existing asset URLs to the optimized files, serves precompressed Brotli/gzip code and uses ETags for conditional browser caching. Startup defers combat animations, arena art, crowds and unselected portraits until the relevant screen. Original project files remain untouched; reference images, generation history and build tools stay outside the runtime image.

```sh
# Local validation on localhost:3188 with its own data volume
docker compose -f compose.local.yaml up -d --build

# Publish an immutable release and update latest (requires docker login)
npm run image:publish -- brunofunnie/buteco-fighting 20261001-2
```

In Dockhand, use a regular Compose stack named **buteco-fighting** in environment **Bender**, with the contents of **compose.yaml**. Set `BUTECO_TAG=20261001-2` in its environment and deploy with image pulling enabled and building disabled. Future updates only require publishing a new release locally, changing this tag and deploying. Roll back by choosing the previous tag. No Git checkout or npm install is needed on Bender.

The stack joins the existing external `bender-network`, publishes no host port and keeps the tunnel origin `http://buteco-fighting:80`. It uses the existing external volume `buteco-fighting_online-data` for SQLite identities and rankings. Do not remove this volume when updating. `BUTECO_IMAGE` and `BUTECO_DATA_VOLUME` can override the registry repository and data volume for another installation.

Measure startup transfer and check deferred assets, compressed code and conditional caching against a running deployment:

```sh
GAME_URL=http://localhost:3188 node harness/startup-performance.mjs
```

The image runs as the Node user, serves HTTP on port 80 and includes a health check. `compose.git.yaml` is retained only as the former deployment configuration; the live stack now uses the published image.

## Controls

Keyboard bindings for each player can be changed in **OPÇÕES** and are saved under `buteco-controls-v1` in localStorage. Click a key, press its replacement, or choose **RESTAURAR TECLAS**. Escape cancels remapping and remains the pause/back shortcut. Two standard Xbox/PlayStation controllers are supported; connect them and press a button to activate. The first controller is P1 and the second is P2 in local versus. The in-game options screen includes the controller mapping.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | A / D | ← / → |
| Jump / crouch | W / S | ↑ / ↓ |
| Punch / kick | J / K | 1 / 2 |
| Block | L | 3 |
| Special · **25 energy** | U | 4 |
| Super · **100 energy** | I | 5 |
| Directional jump | W + A / D | ↑ + ← / → |
| Air punch / kick | W + J / K | ↑ + 1 / 2 |
| Low punch / kick | S + J / K | ↓ + 1 / 2 |
| Uppercut / sweep | S + U / I | ↓ + 4 / 5 |
| Low block | S + L | ↓ + 3 |
| Dash | A,A / D,D | ←,← / →,→ |
| Pause | Esc | Esc |

Player 2 can also use the numeric keypad. Hold block to defend; touch devices display movement and attack buttons.

**Menus:** WASD or arrow keys navigate; Enter / J / 1 confirm; Esc / K / 2 go back. **Q** switches between player and rival during character selection. Sound preferences persist in your browser.

## Versus online

Choose **VERSUS ONLINE** to load the ranking and browse rooms. Creating a room opens a themed nickname dialog; joining uses the saved identity or creates a provisional challenger nickname without a form. The room only connects the players. The host starts the existing character-selection screen, where each player controls their own pick and sees the other pick live. Both confirm, then enter arena selection; only the host chooses the arena and starts the normal versus/fight sequence. Both return automatically to the same room after a match. The host can expel a challenger in the lobby, which also blocks that browser identity from rejoining that room. A full or active room cannot accept another player.

Each lobby player displays server-measured round-trip latency in milliseconds and colored signal bars. Probes run every two seconds. Ranking updates on opening multiplayer and after results; there is no ranking refresh button. The client throttles requests and the server caches queries until a result or nickname change invalidates them.

Rooms support two fighters and up to ten spectators. Use **ASSISTIR** beside a room or enter its code to watch, even after a match starts. Spectators follow live character/stage selection and authoritative match snapshots, cannot alter the match, and return to the same lobby after the result.

Colyseus 0.18 runs on the same HTTP/WebSocket endpoint as the game. The server runs the shared combat simulation at 120 Hz and sends snapshots at 30 Hz. Clients send controls only; damage and results are server-authoritative. In an online match each player uses their own Player 1 keyboard/gamepad/touch mapping, including the challenger in the P2 seat. Opening the pause/options menu stops your input while the online match continues.

The leaderboard stores wins, perfect wins and losses in SQLite. A win is a completed best-of-three match; a perfect win means the winner took no damage throughout the match. Disconnecting during a live fight forfeits the match without perfect credit. Lobby departures and expulsions award no points. The guest identity is a browser-local token, not an account with cross-device login; clearing localStorage creates a new identity. Nicknames may be shared; server identities stay separate.

Set `RANKING_DB` to the SQLite file path. Both Compose configurations mount `online-data:/data`, so identity and ranking data survive deploys and restarts. Back up this volume and do not remove it when redeploying. Local development defaults to the ignored `data/rankings.sqlite`.

Open Graph and Twitter cards use the generated cover at `assets/social/buteco-fighting-og.png` (1200×630) and the canonical address `https://fighting.butecodosdevs.com/`.

## The regulars

**54 fighters. Every one has something to prove.**

<details>
<summary><strong>See every fighter, special and super</strong></summary>

| Fighter | Special | Super |
| --- | --- | --- |
| Rina Sabre | Corte de energia | Rajada Sabre |
| Waggy | Impacto urbano | Onda de impacto |
| ViiHuugo | Pulso prismático | Explosão arco-íris |
| Joke L | Bloco de dados | Overflow |
| King Luiz | Runa D20 | Acerto crítico |
| Maya B | Passo holográfico | Três miragens |
| Pedro Pi | Bruma lunar | Eclipse |
| Alex Sebas | Martelo magnético | Oficina em órbita |
| Math Carpenter | Avanço cinético | Tremor do balcão |
| Dark Wong | Onda sonora | Grave máximo |
| Mr. Funnie | Faísca de código | Crash flamejante |
| Baiano M | Brasa do sertão | Sol nascente |
| Cowboy | Tiro de pressão | Rajada precisa |
| Henry K | Batida de grave | Subgrave máximo |
| Jamal | Poço gravitacional | Colapso orbital |
| Joe Munist | Punho estrela | Constelação vermelha |
| Molly Jay | Pluma cortante | Revoada rubra |
| Folle | Pulso tricolor | Pressão da torcida |
| Jay P | Bloco de código | Overflow total |
| Mango | Pulso digital | Rajada de código |
| Bento | Selo dourado | Juramento do guardião |
| Deve Rás | Chave de impacto | Oficina total |
| Ana | Pulso gamer | Combo máximo |
| Miranda | Pulso do terminal | Overload de uptime |
| Naldo | Punho de impacto | Investida total |
| Professor | Pacote seguro | Firewall total |
| Thassia Devil | Bruma da videira | Vindima sombria |
| Vinil | Bloco estrutural | Estrutura total |
| Astha | Pulso tático | Frequência máxima |
| Biskit | Estalo veloz | Ritmo acelerado |
| Cody | Refração | Dispersão total |
| D.Nelson | Pulso da união | Todos por um |
| Daddy Ianky | Ferramenta orbital | Oficina pesada |
| Felurian | Névoa violeta | Noite profunda |
| Gabiest | Órbita alienígena | Invasão gravitacional |
| Ghostly | Passo fantasma | Ecos espectrais |
| Ingio | Batida dourada | Grave do festival |
| Leo | Leque solar | Horizonte radiante |
| Litte Faster | Investida veloz | Aceleração total |
| Mountain | Peso da montanha | Avalanche |
| Mr. G | Selo do grimório | Runa suprema |
| Musashi | Investida shinobi | Impacto do pergaminho |
| P.D.R | Pressão da faixa | Finalização total |
| Prefeito | Bloco da cidade | Plano diretor |
| r1sen | Chama ascendente | Ressurgimento |
| Sleep | Batida noturna | Grave da madrugada |
| Sonee | Onda de estilo | Frequência livre |
| Tony Etch | Pulso preciso | Rajada de precisão |
| Wes | Punho de aço | Impacto máximo |
| Zero 6 | Pulso zero | Rajada seis |
| Gus | Pressão densa | Nuvem de impacto |
| Kalango | Faísca laranja | Compilação explosiva |
| Miss Laura | Pacote da nuvem | Escala máxima |
| s3rious | Bruma tropical | Neblina total |

</details>

## Home advantage

| Arena | Where the round goes down |
| --- | --- |
| **São Paulo — MASP** | Under the iconic span on Avenida Paulista. |
| **Rio — Copacabana** | Sand, sea and the city beyond the promenade. |
| **Recife Antigo** | By the Capibaribe, surrounded by historic streets. |
| **Manaus — Encontro das Águas** | A riverside deck at the meeting of the waters. |

Panoramic stages span 1,920 world pixels, with a scrolling camera, parallax and animated spectators. Energy effects, impacts and environmental animation are drawn at runtime.

## Under the hood

**Phaser 3.90 + Canvas 2D + JavaScript ES modules.** Phaser owns the scene clock and visible canvas; a separate combat simulation runs in fixed steps of 1/120 second. Rendering follows the browser's frame rate.

```text
src/app.js           Menu flow, selection, loading and match lifecycle
src/game.js          Combat simulation, powers and Canvas rendering
src/phaser-game.js   Phaser scene and simulation integration
src/power-preview.js Silent special/super demonstrations in selection
src/roster.js        Fighter identities, stats and power definitions
src/stages.js        Arena rendering and environmental animation
src/audio.js / src/music.js  Sound effects, music and playback controls
assets/              Published sprites, source images, stages and audio
harness/             Combat, asset and browser verification
```

Each fighter lives in `assets/sprites/<name>/`, with a `base-source.png`, calibrated frames in `curated/`, and animation metadata. The shared manifest preserves frame timing, scale and foot anchors. Rina Sabre and Waggy have 23 animation states each; the other 52 fighters have 24, including dedicated super poses.

Sprites and stage art were produced with GPT-assisted asset workflows; the sound bank includes ElevenLabs-generated effects and music. Playback uses the bundled files. Generating new assets is a separate development workflow.

Dependencies, test output and local generation histories are excluded from Git. Runtime assets and source images are included. Raw-image calibration tools require the corresponding local generation history. See the [asset guide](assets/README.md) for the pipeline and metadata contracts.

## Run the checks

Install Chromium once, then keep the game server running in another terminal:

```sh
npx playwright install chromium
npm run check
npm test
```

Focused checks:

| Command | Covers |
| --- | --- |
| `npm run test:roster:combat` | Every fighter's special and super, energy costs and power behavior. |
| `npm run test:power:preview` | All 54 demonstrations in both directions, damage, resets and lifecycle. |
| `npm run test:ui` | Menus, responsive layout, scrolling and character selection. |
| `npm run test:selection:demo` | Alternation, rapid selection changes and Cartesian previews. |
| `npm run test:online` | Real Colyseus clients, room permissions, kick/ban, loading, authoritative results, ranking and SQLite persistence. |
| `npm run test:online:browser` | Three-browser player/spectator online flow, networking, sharing tags, responsive lobby and cancellation races; defaults to port 3194. |
| `npm run test:controls` | Saved keyboard remapping, controller input, menu navigation, air attacks, touch, pause, disconnects and stage backgrounds. |
| `npm run test:options` | Audio, fullscreen, keyboard navigation and focus restoration. |
| `npm run test:menu:actions` | Focused Back and Options actions across menus. |
| `npm run test:ko:health` | Empty health bars after lethal specials and supers. |
| `npm run test:roster` | Real browser matches across the full roster. |
| `node harness/roster-expansion-assets.test.mjs --registry harness/roster-import-v16.json` | Verify the four new imports and Cowboy replacement against their supplied portraits; preserve every previous fighter ID and Cowboy gameplay attributes. |
| `npm run test:roster:assets` | Sprite transparency, variation and calibrated geometry; requires Python 3 and Pillow. |

Browser checks use `http://localhost:3187` by default. Test screenshots and reports are generated locally in the artifact directories and stay out of version control.

---

<div align="center">

**Pick a fighter. Grab a friend. Aperte Start.** 🍻

</div>


## Collision geometry

Combat uses precompiled, per-frame hitboxes and hurtboxes for all 54 fighters.
The animation frame selector is shared by rendering and the server simulation;
sprite scale, anchors, facing, crouching and aerial poses are reflected in the
geometry. Hurtboxes are alpha-derived strips around the body core and legs;
offensive boxes cover the leading fist/forearm or foot/shin. These are authored
rectangle approximations, not pixel-by-pixel masks. Projectiles and explosions
use circle-to-current-hurtbox intersections. Kinetic and illusion powers keep
their authored attack areas and intersect the current body geometry.

Open the game with `?hitboxes=1` to display green hurtboxes, red active hitboxes
and projectile circles, plus the current animation frame. It works locally and
while playing/watching online. Debug drawing does not change collision rules.

Regenerate `collision-data.js` after changing sprite frames, calibration or the
roster: `python harness/build-collision.py --atlas` using a Python environment
with Pillow and numpy. The atlas is written to ignored `artifacts/collisions/`.
Optional frame overrides in `assets/collision-overrides.json` have the shape
`{fighter: {state: {frameIndex: {hurt: [[x,y,w,h]], hit: [[x,y,w,h]]}}}}`;
coordinates are world units relative to the sprite anchor, facing right.
The source fingerprint test rejects stale sprites, manifest/catalog calibration, overrides or generator changes.

Validation: `npm run test:collision`, `npm run test:collision:browser`,
`npm run test:combat`, `npm run test:roster:combat`, `npm run test:online`,
`npm run test:online:browser` and `npm test`. Browser tests accept `GAME_URL`.

## Project organization

- `src/`: game, menus, input, audio and shared online modules.
- `styles/`: CSS for the game and menus.
- `assets/`: published sprites, interface artwork, arena art and audio. Current Brazilian arenas are in `assets/stages/brazil/`.
- `assets/references/`: production references and pending character artwork; not loaded by gameplay.
- `tools/`: standalone development tools.
- `harness/`: checks, browser tests and production scripts.
- `docs/`: documentation, design notes and historic plans.
- `artifacts/`: regenerated screenshots and reports; ignored by Git.
- `data/`: persistent online data; never cleaned automatically.

`npm run check` verifies all runtime modules, relative imports, HTML resources and CSS asset paths. Production histories under `assets/sprites/*/generation/` remain available to regenerate sprites and are excluded from Docker images.

### Limites de criação de salas online

O servidor valida a identidade antes de criar a sala e limita tentativas por uma janela móvel de 60 segundos: 3 por identidade e 10 por IP. Cada identidade pode manter uma sala criada aberta; uma rede pode manter quatro. O servidor aceita até 50 salas simultâneas, incluindo reservas HTTP que ainda não conectaram por WebSocket, e até 120 tentativas de criação por minuto no total. Fechar uma sala libera a capacidade, mas não apaga o histórico de tentativas. Entrar em salas e jogar não consomem esse orçamento de criação.

Erros informam o motivo em português. Respostas 429 e de capacidade global incluem `Retry-After`. Reservas de admissão não utilizadas expiram em 30 segundos; reservas de assento continuam com a expiração do Colyseus. Os contadores ficam na memória do processo e reiniciam com o servidor.

Atrás do Cloudflared, configure `BUTECO_TRUSTED_PROXY_IPS` no ambiente do Compose com os IPs exatos dos proxies conectados ao container (separados por vírgula). Somente esses pares podem fornecer `CF-Connecting-IP`; outros cabeçalhos de encaminhamento não alteram os limites. Sem essa configuração, o IP de conexão é usado. Atualize a lista se o endereço do proxy mudar.

Validação: `npm run test:online:limits` cobre concorrência, identidade inválida, capacidade por rede e global, expiração e tentativas de contornar a admissão.

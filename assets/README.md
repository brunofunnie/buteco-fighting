# Personagens e animações

A imagem fonte de cada personagem fica em `assets/sprites/<nome>/base-source.png`, movida do respectivo lote de geração sem alterar seus bytes. A personagem com laço é Rina Sabre; o personagem de óculos é Waggy.

Os sprites publicados e seus contratos ficam em `assets/sprites/<nome>/`, incluindo `curated/`, receita, métricas e manifesto de runtime. As pastas usam os nomes atuais, como `waggy` e `rina-sabre`. Os IDs internos `bruno` e `maya` permanecem compatíveis com áudio e seleções existentes. Cada pasta contém `provenance.json`, que aponta para o histórico de geração em `assets/sprites/<nome>/generation/<lote>/`.

Rina Sabre e Waggy têm 23 ações e 96 frames cada; os demais têm 24 ações e 100 frames, incluindo super próprio. Walk e backwalk têm seis poses; as outras ações têm quatro. O runtime lê `assets/manifest.json` e utiliza somente os PNGs publicados em `assets/sprites/*/curated/`.

Fluxo reproduzível de geração (acesso GPT confirmado pelo usuário):

```sh
# SPRITE_CLI deve apontar para o sprite-gen instalado em seu virtualenv.
"$SPRITE_CLI" gen-set --run-dir assets/sprites/rina-sabre/generation/sprites --provider codex
"$SPRITE_CLI" extract --run-dir assets/sprites/rina-sabre/generation/sprites
"$SPRITE_CLI" compose-atlas --run-dir assets/sprites/rina-sabre/generation/sprites
"$SPRITE_CLI" compose-gif --run-dir assets/sprites/rina-sabre/generation/sprites --out-dir assets/sprites/rina-sabre/generation/sprites/previews
"$SPRITE_CLI" inspect --run-dir assets/sprites/rina-sabre/generation/sprites
"$SPRITE_CLI" export-pngs --run-dir assets/sprites/rina-sabre/generation/sprites --out-dir assets/sprites/rina-sabre/curated
# Repetir para waggy e revisar poses/transparência antes de publicar.
# SPRITE_PYTHON aponta para o Python do mesmo virtualenv da sprite-gen.
"$SPRITE_PYTHON" harness/sprite-metrics.py
node harness/sprites.mjs
```

As imagens do jogo vêm de `curated/`, nunca do cache de extração. As arenas e efeitos são renderizados em canvas. `runtime-metrics.json` mede escala e âncoras sem modificar imagens, corrigindo a normalização individual de poses ao desenhá-las no jogo. O atlas e os GIFs são produtos canônicos da ferramenta; a escala de produção é aplicada pelo renderer usando esses metadados.

`npm run sprites:publish` publica o catálogo completo a partir das pastas canônicas, evitando apagar personagens de outros lotes. Novos personagens são validados por `harness/publish-pending.py <ids>` antes da integração. `npm run sprites:organize` consolida os PNGs publicados, preserva escala/âncoras e mantém receitas, imagens brutas, atlas, GIFs e relatórios em `assets/sprites/<nome>/generation/<lote>/`. Scripts, logs e relatórios compartilhados ficam em `assets/sprites/_generation/<lote>/`; os antigos diretórios `assets/generated/roster-*` foram removidos após verificação de hashes. `assets/sprites/_generation/migration-audit.json` registra os 10.389 arquivos movidos e seus SHA-256. Metadados originais cujos caminhos precisaram mudar ficam em `migration-originals/`, para auditoria. A receita de cada histórico usa `../../base-source.png`, sem duplicar a imagem fonte.

A revisão de escala também calibra cada linha gerada contra sua pose de referência. Isso evita que a mudança de distância de câmera entre linhas reduza o personagem ao atacar. A medida de altura respeita a articulação: agachamento, salto e KO têm contratos próprios. Caminhada, dash e recuo usam quatro poses, sem stride físico verificado.

As fontes continuam editáveis após a migração. Se um `base-source.png` for substituído, o organizador mantém a versão atual e registra seu hash em `revisions`, sem apagar o digest original da transferência. Quatro fontes receberam versões transparentes após a conferência inicial; o registro distingue essas atualizações da verificação dos arquivos gerados.


A virada foi regenerada para terminar em guarda voltada à esquerda, mantendo identidade e escala. O runtime desenha a sequência com a orientação inicial e só passa à nova orientação na conclusão; os golpes podem cancelar essa transição neutra. `land` recupera da postura baixa à guarda, e `jumpForward` representa salto direcional. Caminhada e recuo têm seis frames a 12 fps, sem medição verificada de stride.

Os três cenários panorâmicos GPT e seus prompts/relatórios ficam em `stages/`. Seus elementos animados são desenhados em runtime atrás dos atores, em três passos discretos; não são novas imagens geradas a cada frame.

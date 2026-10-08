# Buteco Fighting

Jogo de luta em navegador com 61 lutadores selecionáveis, Devon e Dummy, cinco cenários, modos versus, arcade e treino, controles configuráveis e partidas online com Colyseus.

## Executar

Requer Node.js 24 ou superior.

```sh
npm ci
npm start
```

Abra <http://localhost:3187>. Para outra porta, use `PORT=3225 npm start`.
As classificações e identidades ficam em `data/`; `RANKING_DB` permite escolher outro arquivo SQLite. Essa pasta não faz parte dos assets.

## Organização

- `src/`: carregamento, renderização, combate, colisões, controles, áudio e partidas online.
- `styles/` e `index.html`: interface do jogo.
- `assets/manifest.json`: única descrição das animações dos lutadores, com ordem, tempo, escala e âncoras.
- `assets/sprites/<personagem>/portrait.png`: retrato usado na seleção.
- `assets/sprites/<personagem>/animations/<estado>/frame-NN.png`: quadros nativos publicados. Estados usam nomes como `air-kick`, `jump-forward` e `low-block`. Quadros reutilizados apontam para o mesmo arquivo.
- `assets/crowd/public/` e `assets/crowd/regional/`: animações dos espectadores e manifestos.
- `assets/stages/`, `assets/interface/`, `assets/title/` e `assets/social/`: imagens usadas pelos cenários, menus e metadados de compartilhamento.
- `assets/audio/manifest.json`: sons dos lutadores, efeitos e músicas de menu/combate. `fighters/`, `effects/` e `music/` agrupam os arquivos por uso.
- `assets/fonts/`: fonte da interface e licença obrigatória.
- `harness/`: testes e compilador de colisões. `fixtures/` guarda hashes dos arquivos publicados e geometria usada nas verificações; não contém arte de referência.
- `build/`: empacotamento para produção e publicação da imagem Docker.

`assets/` contém somente as dependências de execução e a licença da fonte. Referências, experimentos, gerações antigas, arquivos brutos, atlas sem uso e capturas foram removidos. Os PNGs ativos foram copiados sem alterar seus bytes.

Os IDs internos dos personagens foram preservados para manter seleções, sons e partidas online compatíveis: `maya` continua sendo Rina Sabre e `bruno`, Waggy.

Cada personagem usa 23 estados e 79 entradas de animação; Devon também mantém seu slide exclusivo. O dash foi removido. Os saltos em movimento usam seis quadros e invertem a sequência ao saltar para trás. Os sprites do chute aéreo usam a redução uniforme de 10% aprovada. Agachamento e defesa baixa têm sequências próprias.

## Verificar

Com o servidor em execução:

```sh
npm run check
npm run test:combat
npm run test:collision
npm run test:controls
npm run test:online
npm run test:devon
npm run test:training
npm run test:roster:animations
npm run test:joe
npm run test:sprite:states
npm run test:stage:music
npm test
```

Os testes de navegador aceitam `GAME_URL`, por exemplo `GAME_URL=http://localhost:3225 npm run test:joe`. Capturas e vídeos gerados pelos testes ficam em `artifacts/`, ignorada pelo Git; podem ser removidos depois da execução.

Para validar também as dimensões e os pivôs dos PNGs, execute `npm run test:roster:assets` com Python, Pillow e NumPy disponíveis. Depois de uma mudança intencional nos sprites ou na calibração, regenere as colisões com `npm run collision:build`. O teste de colisões verifica a impressão digital do manifesto, do roster, do compilador e dos PNGs para impedir dados desatualizados.

`harness/fixtures/asset-hashes.json` registra os bytes dos arquivos de produção aprovados. Atualize a entrada correspondente somente ao substituir intencionalmente um asset; a organização dos arquivos não deve mudar os pixels.

## Produção

O Dockerfile usa `build/runtime-assets.mjs` para coletar exatamente as mesmas dependências verificadas por `npm run check`. O empacotamento pode converter PNGs para WebP sem perdas, comparando os pixels visíveis antes de aceitar a conversão. Os originais em `assets/` permanecem intactos.

```sh
npm run image:build
```

A publicação continua disponível em `npm run image:publish` e exige solicitação explícita. Os arquivos `compose*.yaml` mantêm a infraestrutura existente.

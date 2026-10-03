# Registro de revisão

Referência visual e funcional: Street Fighter II/III. Builders separados trabalharam em motor e interface. Um crítico independente executou o protótipo no Chromium e inspecionou capturas de menu, arenas, golpes e celular.

## Correções verificadas

- Controles unificados entre teclado, modal, dicas e touch.
- Pausa coordenada entre motor e interface, incluindo Escape e perda de foco.
- Mute alterando o áudio do motor e persistindo no navegador.
- Ataques sem repetição de poses durante o golpe; timing de contato sincronizado ao frame ativo.
- Perfis distintos: Maya mais rápida; Bruno mais lento e forte.
- KO apenas com vida zero; vitória por tempo preserva postura do vencedor.
- Touch com defesa e super; layout em paisagem amplia arena, sem overflow horizontal em 390px e 844px.

## Resultado

26 verificações funcionais passaram; nenhuma exceção de página. `npm test` reproduz a verificação com servidor ativo. Cenários são preparados por debug; ações e navegação usam eventos reais do navegador. Isso não mede equilíbrio competitivo ou qualidade comercial.

## Maior lacuna restante

A lacuna inicial de poses estáticas foi corrigida: 88 frames GPT em 11 ações por personagem, extração canônica sprite-gen e exportação de `curated/`. A repetição dos testes funcionais passou com os novos assets. A revisão de animação verificou 202 condições de carregamento, transparência, contagem, variação e metadados, sem erros.

Métricas por frame compensam o ajuste de escala e posição de cada célula ao desenhá-la. Isso preserva a geometria original de poses agachadas, caídas e com membros estendidos, sem recortar ou alterar os PNGs fora da ferramenta.

O crítico detectou crescimento do torso no agachamento; a revisão encontrou metadados ausentes no carregador e corrigiu sua aplicação em cada imagem. A validação seguinte verifica o metadado carregado, além de pixels e contagem, para detectar regressões desse contrato.

Na revisão, crouch passou com altura corporal de 240,73px para Maya e 222,91px para Bruno. Defesa agachada conserva a pose baixa. O crítico aprovou idle, punch, kick, block, crouch e KO; walk/jump foram classificados como best-effort.

A caminhada de Maya foi regenerada após a crítica ao pé traseiro suspenso. A revisão final confirmou os pés plantados no começo/fim e apoio dianteiro na passagem. Nenhuma falha importante de anatomia ou apoio foi identificada; o ciclo permanece best-effort, sem medição de stride/deslocamento. Os 202 checks passaram novamente. Primeiro protótipo com os dois personagens concluído e revisável.

Limitações do protótipo: caminhada curta experimental, quatro poses por ação, conjunto reduzido de golpes e CPU sem equilíbrio competitivo extensivamente avaliado.

## Lições

Estabelecer o contrato de ações e teclas antes de construir UI e motor em paralelo. Testar Escape pela interface real detecta dupla alternância. Para sprites, respeitar o manifesto/exportação da ferramenta; não tratar referências estáticas ou cache de extração como animações finais. Criticar screenshots de ataque além de screenshots idle.


## Revisão 2 — arcade e combate ampliado

O usuário encontrou encolhimento ao atacar e pediu uma experiência de jogo completa, arenas maiores e golpes contextuais. Builders separados implementaram motor e telas; crítico recebeu artefato e referência Street Fighter II/III.

Primeira crítica: ações contextuais funcionavam, mas os PNGs ainda estavam em geração e o runtime usava aliases. A publicação de 72 novos sprites trouxe os 20 estados completos para cada lutador. Foram inspecionados contatos e capturas ativas de golpe aéreo, baixo, uppercut e rasteira.

A escala por frame compensava o encaixe do extractor, mas não a distância de câmera independente das linhas GPT. A correção calibra uma pose revisada por linha, conservando as diferenças anatômicas de altura no agachamento, salto e queda. O crítico mediu Bruno punch em 314–324px e kick em 314–322px contra idle de 320–325px; Maya ataques em 318–327px. O uppercut cresce em altura pelo punho elevado, sem ampliar o corpo.

Segunda crítica: uppercut, rasteira, dash e defesa baixa não estavam documentados no menu de golpes. Os comandos explícitos foram acrescentados. Também foram tornadas acessíveis as opções de som/tela cheia na pausa e os controles de toque em viewport estreito.

Validação atual: 34 verificações no navegador, 30 cenários determinísticos de combate, 22 verificações da campanha e 388 verificações de animação/metadados/transparência/escala. Todas passaram, sem exceções de página. A campanha foi encerrada via finishRound/onEnd reais, incluindo derrota/revanche no último confronto, campeão e reinício. A cena Phaser controla o relógio e apresenta o framebuffer Canvas da simulação.

Limites atuais: quatro poses por ação, caminhada/recuo/dash curtos, stride não verificado e equilíbrio competitivo ainda sem avaliação prolongada. Os dois personagens fornecidos permanecem o elenco inteiro.


## Revisão 3 — arte, cruzamento e fluidez

Escopo aprovado: cenários ricos inspirados em SF2, animações discretas atrás dos personagens, câmera lateral, salto para inverter lados e movimentos mais soltos.

Os testes de movimento foram escritos antes das alterações e reproduziram falta de impulso após soltar direção, ausência de aterrissagem/virada próprias e descarte de comando antecipado. Outro teste demonstrou que comandos pressionados durante hitstop eram descartados; a correção conserva o ataque para o primeiro tick disponível. Nove verificações passam, junto dos 30 cenários anteriores de combate.

Três panoramas GPT substituem o cenário esquemático; iluminação/pétalas/chuva em três passos ficam atrás dos atores. A primeira inspeção do builder removeu elementos que flutuavam sobre a pintura. O crítico aprovou leitura dos lutadores, profundidade e deslocamento nas duas extremidades da câmera. O rooftop tinha animação quase invisível (83 pixels alterados entre amostras); após ampliação apenas do brilho localizado, a revisão mediu 606 pixels, ainda sem prejudicar os atores.

Sprites: 192 PNGs, 23 estados por personagem; caminhar/recuar seis frames, demais quatro. Virada foi regenerada para finalizar em guarda à esquerda. A revisão independente confirmou sequência real por teclado jumpForward → land → turn e soco voltado à esquerda depois do cruzamento, com proporções consistentes.

Verificação final: 34 checks no navegador, 30 de combate, 22 da campanha, 458 de animação e nove de movimento. Nenhuma falha ou exceção de página. Desempenho ativo sem outros testes concorrentes: RAF mediana/p95 de 16,7/16,7 ms. Tempo de emissão de comandos Canvas não foi tratado como tempo de rasterização concluída. Sem bloqueio na crítica final; relatório e capturas em `harness/artifacts/critic-v3/`.

Limitações mantidas: stride de caminhada/recuo sem verificação, sequências curtas e equilíbrio competitivo sem avaliação prolongada. Não extrapolar FPS medido nesta máquina a todos os dispositivos.

## Revisão 4 — Buteco Fighting

Escopo aprovado: identidade do Buteco Games, HUD durante a luta sem fundos e três arenas de boemia brasileira. A referência pública forneceu âmbar #ffb522/#f59e0b, creme e azul noturno; os menus receberam logo pixelado e cores coerentes. São Paulo — Bixiga, Rio — Lapa e Recife Antigo usam novos panoramas GPT 2048×768 gerados pela sprite-gen, com luzes/reflexos e bandeirinhas discretos em três passos, atrás dos atores.

O teste do HUD primeiro reproduziu quatro fundos opacos: painel superior, área sob as barras, trilha de vida vazia e trilha de energia vazia. A versão aberta mantém alpha zero nessas áreas e pinta apenas valores, contornos e texto. Vida perdida continua visível como rastro; energia cheia informa SUPER PRONTO, além da cor.

O crítico independente examinou menus e cada arena no centro e nas duas extremidades da câmera, em desktop e paisagem. A primeira lacuna foi sobreposição do nome da arena com MAYA em 844×390. A informação foi ancorada dentro da arena, no centro inferior; nova inspeção aprovou os três cenários, desktop e retrato, incluindo clique real no botão de pausa. A integração ainda afastou o botão de pausa do nome BRUNO no retrato, usando o espaço da margem da tela.

Evidências: `harness/artifacts/critic-v4/`, `artifacts/hud-v4.json` e `artifacts/buteco-integration.json`. Todos os três PNGs carregaram no jogo real, sem exceções de página. O elenco, os sprites, as regras de combate e a preferência de áudio salva foram preservados.

Verificação encerrada: 559 condições passaram (34 de navegação/combate no navegador, 30 de simulação, 22 da campanha, 458 de sprites, nove de movimento e seis de transparência do HUD), além das verificações de sintaxe. A inspeção final no retrato confirmou separação entre pausa e BRUNO e clique funcional. Sem bloqueio restante na crítica independente.

## Revisão 5 — chão, KO aéreo e arenas vivas

Relato do usuário: sensação de chão fora dos pés, KO flutuando, início deslocado e ausência de torcida/letreiros animados. A pintura era dividida em dois recortes com fatores de câmera diferentes, provocando emenda no pavimento; agora toda a pintura usa a mesma transformação do mundo. O crítico confirmou contato dos pés com a rua em y590 e sombras abaixo das botas, inclusive nas extremidades da câmera. A calçada ao fundo permanece no seu próprio plano, atrás da luta.

O início ainda usava as posições do antigo mundo de 1280px. Os lutadores agora começam em x670/x1250 e a câmera em x320, centralizando o mundo de 1920px em todos os rounds. O fim de round anteriormente avançava apenas o relógio da animação; a gravidade agora continua para os personagens no ar, com velocidade zerada no chão e ataque cancelado no KO. Cinco regressões passam: abertura, queda do derrotado, cancelamento do ataque, queda do vencedor e centralização do round seguinte.

Primeira crítica da torcida rejeitou figuras geométricas. Foram substituídas por oito PNGs GPT ilustrados, gerados e extraídos pela sprite-gen: quatro poses de cheer/brinde e quatro de drink/beber. Exportação vem de curated e usa crowd-manifest.json separado do manifesto canônico. Letreiros âmbar Buteco Fighting usam tipografia pixelada, canecas e oscilação luminosa, como objetos das fachadas, atrás dos lutadores. O letreiro de Recife foi elevado para não ficar oculto pela cabeça de Bruno na abertura.

O teste visual primeiro detectou zero movimento da torcida antes da publicação. Com os assets finais carregados, a comparação na faixa traseira mediu mais de 3.500 pixels alterados em Bixiga e Lapa e mais de 6.900 em Recife; os letreiros também mudam visivelmente. Isso verifica mudança de poses, sem inferir FPS ou qualidade comercial. Crítico independente aprovou o acabamento dos sprites, animação, piso contínuo e leitura dos lutadores nos três cenários. Capturas em harness/artifacts/critic-v5; testes em artifacts/round-v5.json e artifacts/stages-v5.json.

## Revisão 6 — público diverso, proporção e apoio dos pés

O usuário apontou escala inadequada, apoio em lugares errados e repetição de uma única pessoa. A inspeção identificou altura anterior de 90px contra portas próximas de 200px, coordenadas genéricas e alguns espectadores sobre a área de degraus da Lapa. O público agora tem seis identidades (três mulheres e três homens), 24 poses GPT de aplauso, grito com mãos junto à boca, comemoração, brinde e gole. Cinco novas bases/linhas foram geradas pela sprite-gen e o homem terracota foi reaproveitado com calibração corrigida. Extração, atlas, GIF e publicação canônicos; movimento localizado de aplauso foi registrado como tal no QA.

Cada pose possui altura de cabeça até sola, separada do limite superior de braços/canecas. Isso corrige encolhimento durante o brinde alto. Âncora vertical usa a sola opaca efetiva do PNG exportado. Adultos têm 175px no Bixiga/Recife e 165px na Lapa, comparados com portas/cadeiras do plano traseiro. Posicionamentos individuais em crowd-layout.js apoiam solas na faixa plana da calçada, evitando escadarias e planos diferentes.

Primeira inspeção da nova composição encontrou público de Recife oculto atrás dos lutadores ou fora da câmera inicial. Os seis foram redistribuídos no intervalo visível; outros ajustes afastaram personagens recortados pela borda e expuseram mais variedade no Bixiga. Revisão final independente aprovou proporção adulta, apoio ao longo das poses, bordas da câmera e leitura da luta; abertura mostra cinco pessoas sem obstrução no Bixiga, quatro na Lapa e seis em Recife. Capturas finais em harness/artifacts/critic-v6.

Verificação: 166 condições de identidade/carregamento/24 hashes distintos/escala corporal/apoio opaco dos pés, sete de animação dos cenários e 34 de navegação/combate real, todas passaram sem exceções de página; sintaxe passou. Relatórios em artifacts/crowd-v6.json e artifacts/stages-v5.json. Não inferir desta verificação equilíbrio competitivo, nem reconstrução fisicamente exata da perspectiva pintada.

## Revisão 7 — elenco ampliado (concluída)

Rina Sabre e Waggy substituem os nomes públicos dos dois lutadores originais, preservando seus IDs e assets. O catálogo central inclui os nove arquivos originais de `novos-personagens-para-criar`. A seleção agora tem onze opções, escolhas independentes de P1/rival e arcade com três adversários diferentes. Animações são carregadas por dupla; o cache conserva os dois originais e a dupla em combate.

Nove estilos de poder distintos foram implementados: prisma, cubos, runas, miragens, bruma lunar, ferramentas bumerangue, avanço cinético com armadura, ondas sonoras e explosões de código. As miragens usam a silhueta real de Maya B com a mesma escala e âncoras do desenho normal. O teste de simulação do elenco passou 72 verificações; o navegador final aprovou 125 verificações e os 900 sprites passaram em 4.052 verificações de assets.

O crítico identificou dois defeitos reais na exportação: o chroma global ciano apagava o robô do chaveiro de Maya B, corrigido pelo modo canônico `ycbcr`, conectado às bordas; e a centralização pelos pés deslocava membros largos para além do canvas, corrigida pelo alinhamento canônico `bbox-center`, mantendo âncoras de pés independentes no motor. Três rows com sapatos unidos foram regeneradas individualmente; a sequência de chute de Pedro Pi também foi refeita após o crítico identificar rostos duplicados na geração; não houve recorte fixo por células. A escala final usa medidas visuais de coroa até queixo, relativas ao idle, evitando impor a mesma altura total a saltos/agachamentos.

Publicação final atômica concluída: nove novos conjuntos de 24 ações/100 PNGs, total de 900 frames novos e onze lutadores jogáveis. Todos os nove conjuntos passaram pela revisão independente das referências e de todos os frames nas folhas de contato em escala de jogo. A revisão reproduziu e corrigiu perdas do chaveiro ciano, cortes de membros e rostos duplicados em Pedro Pi. Evidências anteriores/posteriores foram preservadas em `artifacts/review-v7/`.

Validação final em Chromium: 125 checks de seleção dos onze lutadores, nomes públicos, P1/P2, especiais/supers com dano, poderes de P2 à esquerda, espelhamento, campanha, três dimensões de tela, cache limitado, falha/retry de um PNG e cancelamento do início ao voltar para o menu; nenhuma falha ou erro JavaScript. A campanha passou 22 checks. Regressão após a integração: 34 checks de jogo e 458 de animação dos originais. O crítico também executou lutas reais de Math × Dark e Mr. Funnie × Maya B.

O rastro cinético de Math foi reduzido a linhas/arco translúcidos atrás do corpo, limitados a 30 Hz, após a captura mostrar um brilho opaco cobrindo o tronco. Dano/armadura/física foram preservados; nova validação passou 72 checks de combate do elenco e 30 de combate original. Relatórios finais: `artifacts/roster-assets-v7-report.json`, `artifacts/roster-browser-v7-report.json`, `artifacts/roster-final-visual-v7.json`.


## Revisão 8 — UI por comandos e arenas regionais (concluída)

A abertura compõe os onze lutadores em duas equipes; quatro retratos com fundo preto receberam versões transparentes por edição GPT, preservando os originais. O crítico comparou rosto, roupa e acessórios e aprovou a composição; pequenas franjas de cor em Math/Pedro continuam visíveis apenas em ampliação. WASD/setas controlam menus e pausa; Q alterna P1/rival, J/Enter confirmam e K/Esc voltam. Os previews de seleção continuam em idle.

Três novos panoramas GPT substituem São Paulo/Rio e acrescentam Manaus: MASP com praça aberta, Copacabana noturna com areia e bondinho, e deque de madeira/pneus sobre o encontro das águas. Recife permanece. Quatro novas identidades de público,16 poses reais e metadados de cabeça/sola foram publicados pelo pipeline canônico sprite-gen. O renderer acrescenta fumaça, caminhada, ondas, barco, luzes e letreiros em props; efeitos de luta misturam discretamente a luz ambiente.

O crítico encontrou adultos de Manaus pequenos demais (108–112px). Foram aumentados para150px, mantendo solas em y545, com aprovação visual após recarregamento. Letreiros fora da câmera inicial foram reposicionados sobre carrinho, cooler e caixa de madeira no plano traseiro. A revisão final aprovou contato com o piso, leitura da luta, composição central/bordas e telas móveis.

Uma verificação encontrou que os arquivos originais Rina/Waggy haviam sido movidos para nomes públicos na pasta de personagens; os caminhos do catálogo e HTML foram atualizados. O teste da campanha também passou a aguardar o botão Start habilitado, evitando disparar Enter durante o carregamento.

Verificação final:19 checks de UI,9 de animação das arenas/letreiros,167 de público/40 imagens distintas/escala/apoio,125 de elenco no navegador,22 de campanha,72 de combate do elenco,30 de combate,6 de HUD e5 de rounds; quatro arenas verificadas no fallback e com pinturas reais. Sem erros de navegador. Evidências `artifacts/ui-v8.json`, `artifacts/arena-v8.json`, `artifacts/stages-v5.json`, `artifacts/crowd-v6.json` e capturas independentes em `/tmp/critic-buteco/`.


## Revisão9 — carregamento idle e splash corrigidos; geração de áudio bloqueada

Causa da demora: Promise.all aguardava todos os frames dos dois slots. Corrigido com primeiroframe independente, preaquecer11 idles e retrato imediato; frames restantes passam a animar quando chegam. Bounds transparentes das referências normalizam os corpos na abertura e preservam Sebas inteiro. Crítico independente fez33 trocas reais entre11 lutadores e66 amostras de canvas sem nenhuma vazia (mínimo34.097 pixels opacos). Corpos completos nos3 tamanhos. Identificou Start sobre rostos em390×844; reposicionado para54vh na faixa livre.

Testes:12 de preview com downloads bloqueados,19 de UI,30 de combate,72 do elenco e54 da integração de áudio viafixture sintético. Sintaxe passou. Duas falhas encontradas nos testes foram corrigidas: atributo data-player nos canvases colidia com seletor do roster; timestamp inicial de RAF negativo selecionava índice inválido.

ElevenLabs: CLI instalado e OAuth registrado, mas API de efeitos retornaHTTP401 needs_authorization. Acesso à rede foi solicitado pelo mecanismo de aprovação e a chamada chegou à API; o bloqueio atual é autenticação. Banco real não gerado;41 prompts e mixer preparados para finalizar assim que houver credencial válida. Não declarar áudio completo nem aprovado.


## Áudio final — autenticação resolvida e banco publicado

A API key configurada permitiu gerar39 efeitos (3 por lutador e6 comuns) e2 temas musicais originais de40 segundos pela ElevenLabs. A CLI rejeitou output_format no corpo JSON da composição; o parâmetro foi removido e somente os temas faltantes foram gerados. Os39 efeitos anteriores foram reutilizados. Um impacto tinha pico-44.6dB e foi regenerado individualmente; todas as41 faixas receberam masterização, preservando os originais. Música usa loudness alvo-18LUFS/pico-3dB e efeitos usam normalização de pico-3dB. O mixer usa compressão e margem de saída para sobreposições.

Banco completo publicado em assets/audio/v9/manifest.json. Verificação de sinais e headroom em artifacts/audio-levels-v9.json; verificação de arquivos reais/decodificação/transições/mute/teclas em artifacts/audio-real-v9.json. Os testes comfixture continuam separados e explicitamente sintéticos.

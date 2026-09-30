# Buteco Fighting

O repositório inclui o código, as imagens fonte e os assets publicados necessários para jogar. Dependências, resultados de testes e históricos locais de geração de sprites não são versionados. As receitas e métricas publicadas permanecem em `assets/sprites/<personagem>/`; os comandos de revisão de imagens brutas exigem os históricos locais correspondentes.

Jogo de luta 2D no navegador com Rina Sabre, Waggy e outros lutadores, quatro arenas brasileiras, arcade contra CPU, versus local e treino. Menus arcade em tela inteira, campanha de três confrontos e comandos em português. Phaser 3.90 controla a cena, o relógio e a renderização; a simulação de combate mantém suas próprias regras e desenha em um framebuffer Canvas, exibido por uma textura do Phaser.

Execute `npm install` e `npm start` e acesse http://localhost:3187. Para outra porta, use `PORT=3188 npm start`.

## Controles

| Ação            | Jogador 1 | Jogador 2 |
| --------------- | --------- | --------- |
| Mover           | A / D     | ← / →     |
| Pular / agachar | W / S     | ↑ / ↓     |
| Soco / chute    | J / K     | 1 / 2     |
| Defesa          | L         | 3         |
| Especial        | U         | 4         |
| Super           | I         | 5         |
| Soco / chute aéreo | W + J / K | ↑ + 1 / 2 |
| Soco / chute baixo | S + J / K | ↓ + 1 / 2 |
| Uppercut | S + U | ↓ + 4 |
| Rasteira | S + I | ↓ + 5 |
| Defesa baixa | S + L | ↓ + 3 |
| Dash | A,A / D,D | ←,← / →,→ |
| Pausar          | Esc       | Esc       |

O jogador 2 também pode usar o teclado numérico. Segure a tecla de defesa para bloquear golpes. Dispositivos touch têm botões de movimento e ataque. Use o botão de som para ativar ou silenciar; sua preferência fica salva no navegador.

## Sprites

`assets/manifest.json` mapeia cada personagem e animação a listas de caminhos relativos à raiz, por exemplo:

```json
{
  "maya": {
    "idle": {"frames": [{"path": "assets/sprites/rina-sabre/curated/idle-frame-0.png", "scale": 1, "anchorX": 0.5, "anchorY": 0.99}], "fps": 6, "loop": true}
  },
  "bruno": { "idle": {"frames": [{"path": "assets/sprites/waggy/curated/idle-frame-0.png", "scale": 1, "anchorX": 0.5, "anchorY": 0.99}], "fps": 6, "loop": true} }
}
```

Rina Sabre e Waggy possuem 96 frames cada transparentes em 23 ações: `idle`, `walk`, `punch`, `kick`, `hurt`, `jump`, `special`, `block`, `crouch`, `ko`, `celebrate`, `airPunch`, `airKick`, `crouchPunch`, `crouchKick`, `uppercut`, `sweep`, `dash`, `backwalk`, `lowBlock`, `turn`, `land` e `jumpForward`. O super usa a sequência de especial com efeito próprio. As imagens originais continuam disponíveis para o menu e como fallback. O motor recebe imagens já carregadas. Os demais lutadores recebem também uma sequência própria de super, somando 24 ações e 100 frames por personagem. A seleção permite escolher os dois lados; o arcade alterna três rivais do elenco. Apenas as animações da dupla escolhida são carregadas, mantendo no cache os dois personagens originais e a dupla atual.

O manifesto de produção usa `frames: [{path, scale, anchorX, anchorY}]`, além de `fps` e `loop`. Escala e âncoras preservam as proporções da geração ao renderizar células que a ferramenta ajustou individualmente. `harness/sprite-metrics.py` mede a geometria com as mesmas funções canônicas de separação da sprite-gen; não modifica os PNGs.

`npm run check` verifica a sintaxe dos módulos JavaScript.

## Verificação e estado atual

Com o servidor aberto em outro terminal, execute `npm install`, `npx playwright install chromium` e `npm test`. O harness usa teclado e interface reais; prepara posições e vida pela API de debug para tornar colisões e encerramento de rounds reproduzíveis. Capturas e relatório ficam em `artifacts/`.

O gauntlet verificou 34 comportamentos de jogo no Chromium: seleção, movimento, salto, soco, chute, defesa em pé/agachada, especial, super, CPU, pausa, rounds, revanche e touch. `npm run test:animation` verifica os frames carregados, transparência, metadados, proporções do agachamento e captura as sequências. Os cenários e efeitos são desenhados em canvas. Celular em paisagem amplia a arena; em retrato há orientação para girar a tela.

**Animações integradas:** 192 frames iniciais gerados pelo GPT com a skill sprite-gen, extraídos, inspecionados e exportados de `curated/`. Atlas, GIFs e contatos de revisão ficam em `assets/sprites/<personagem>/generation/sprites/`. A caminhada é um ciclo curto experimental; walk/backwalk têm seis poses e as demais ações têm quatro poses e o equilíbrio ainda não foi medido em partidas competitivas. Veja [assets/README.md](assets/README.md).


As arenas têm 1920 pixels de largura, com câmera horizontal e parallax. O arcade percorre as três arenas antes da tela de campeão. Versus local e treino permanecem independentes da campanha. Controles de som e tela cheia ficam disponíveis no menu de pausa.

`npm run test:combat` executa 30 cenários determinísticos de alcance vertical, defesa, startup/recuperação, combos, knockdown, dash e câmera. `npm run test:campaign` testa a progressão arcade usando a interface e o encerramento real dos rounds. `npm run test:animation` inclui regressão de escala para idle, soco e chute.

A calibração tem duas etapas: compensar o encaixe individual de cada frame exportado e corrigir a escala independente da linha GPT usando uma pose de referência revisada. Poses dobradas e caídas continuam com menor altura; socos e chutes em pé conservam o tamanho corporal.


## Cenários e movimento — revisão 3

Três panoramas GPT em `assets/stages/` substituem os cenários esquemáticos. `stages.js` desenha a arte, piso e animações ambientais em três passos: neon pulsando, pétalas no templo e chuva no porto. Tudo é desenhado antes dos lutadores. O panorama acompanha a câmera a 0,58 da velocidade do mundo e o piso a 1,0; o fallback procedural usa camadas em cache.

W + A/D inicia salto direcional com impulso preservado ao soltar a direção. É possível cruzar o adversário; aterrissagem e virada têm poses próprias. Um ataque pode interromper a recuperação neutra de aterrissagem/virada para atacar o rival sem esperar toda a transição. A janela de antecipação de ataque é de 130 ms e conserva comandos durante hitstop. A recuperação final dos golpes foi reduzida em 14%.

A simulação usa passos de 120 Hz; a renderização acompanha o navegador. Foi removida uma cópia intermediária de Canvas. A medição independente desta execução encontrou mediana e p95 de 16,7 ms entre frames, aproximadamente 60 FPS neste navegador; isso não é promessa de 120 FPS visuais.

`npm run test:motion` verifica nove cenários de impulso, cruzamento, orientação, transições, buffer e câmera. A revisão completa passou 34 checks de jogo, 30 de combate, 22 da campanha, 458 de sprites e nove de movimento. Evidências visuais e desempenho em `harness/artifacts/critic-v3/`.

## Identidade Buteco

A direção visual acompanha o [Buteco Games](https://games.butecodosdevs.com/): âmbar, creme e azul noturno. As quatro arenas são São Paulo — MASP, Rio — Copacabana, Recife Antigo e Manaus — Encontro das Águas, com panoramas gerados por GPT através da sprite-gen e detalhes ambientais discretos. O HUD durante a luta não usa painéis nem preenchimento nas partes vazias das barras; nomes, cronômetro e contornos aparecem diretamente sobre o cenário.

`npm run test:hud` verifica em Canvas transparente que as áreas sem informação permanecem transparentes e que vida e energia ainda são desenhadas. A chave interna de áudio `after-hours-muted` continua compatível com a preferência salva das versões anteriores.

As arenas começam no centro do mundo e a pintura acompanha a câmera em uma transformação contínua, sem emenda no pavimento. Durante o fim de round, a gravidade continua até os personagens no ar tocarem o chão. O público reúne dez pessoas distintas e 40 PNGs GPT. MASP usa quatro novos figurantes (mulher gótica, homem gótico fumando, transeunte andando e adulto sentado); as outras arenas selecionam identidades entre os seis espectadores anteriores. As poses mantêm a altura corporal e a âncora das solas. Letreiros Buteco em âmbar ficam sobre objetos no cenário.

`npm run test:round` cobre início centralizado e queda no fim de round. `npm run test:stages` verifica mudanças visíveis da torcida e dos letreiros nas quatro arenas, além do carregamento das dez identidades.

O público usa pontos individuais de apoio no plano traseiro de cada pintura. Adultos em pé medem148–175px e o adulto sentado101px; Manaus usa150px com solas em y545. As poses com braços erguidos preservam a altura do corpo. `crowd-layout.js` reúne os posicionamentos; `npm run test:crowd` verifica identidades por região,40 imagens distintas, proporção e contato das solas em todos os frames.

## Elenco e poderes

| Lutador | Especial | Super |
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

U/I ativam especial/super; P2 usa 4/5. Q alterna entre P1 e rival na seleção; setas percorrem a grade. Os IDs internos `maya` e `bruno` foram preservados para compatibilidade com os assets anteriores, com os nomes públicos Rina Sabre e Waggy.

Os novos conjuntos GPT usam a referência `assets/sprites/<personagem>/base-source.png`, extração por componentes, transparência e âncoras das solas. Os efeitos de poder são desenhados pelo motor, sem ampliar o corpo para acomodar brilhos ou projéteis.

Validação do elenco: `npm run test:roster:combat`, `npm run test:roster` e `npm run test:roster:assets` (Python com Pillow). Os relatórios finais registram 72 checks de combate, 125 no navegador e 4.052 de assets, todos aprovados.


## Abertura e arenas — revisão 8

WASD e setas navegam pelos modos, pelo elenco, pelas quatro arenas e pelo menu de pausa. J/Enter/1 confirmam; K/Esc/2 voltam nos menus; Q alterna P1/rival. WASD também altera a dificuldade quando o seletor está focado. Durante a luta, os comandos continuam sendo os de combate. Os dois lutadores escolhidos permanecem em idle na seleção.

A abertura divide o elenco em duas equipes voltadas uma para a outra. Quatro referências com fundo preto receberam versões transparentes por edição GPT em `assets/portraits/v8`; os arquivos originais foram preservados. Rina e Waggy usam as referências com seus nomes públicos na pasta de personagens.

Três novas pinturas GPT em `assets/stages/v8` substituem São Paulo e Rio e acrescentam Manaus. MASP tem público gótico, fumaça e transeunte; Copacabana tem areia, mar e bondinho distante; Manaus tem deque de madeira, pneus, água preta/marrom e barco em movimento. Recife mantém a pintura aprovada. A água, os reflexos, os letreiros e o público se movem discretamente; o plano de luta permanece fixo. Efeitos de poder usam uma mistura leve com a temperatura de cor da arena, menos brilho e reflexos discretos no piso.

Validação: `npm run test:ui` (19 condições), `npm run test:arenas` (quatro arenas, piso fixo e animação), `npm run test:stages` (9), `npm run test:crowd` (167), `npm run test:roster` (125) e `npm run test:campaign` (22). Relatórios em `artifacts/ui-v8.json`, `artifacts/arena-v8.json`, `artifacts/stages-v5.json` e `artifacts/crowd-v6.json`.


## Seleção e abertura — revisão9

A abertura desenha as silhuetas transparentes com altura corporal consistente; Sebas permanece completo em desktop, landscape e portrait. No celular, Start fica na área livre entre o subtítulo e o elenco. Os11 previews idle começam a carregar em segundo plano na abertura. Cada slot exibe imediatamente o retrato, depois o primeiro idle disponível, e completa a animação sem esperar os outros frames ou o adversário. Downloads atrasados não deixam o canvas vazio; alterações rápidas preservam a escolha mais recente.

`npm run test:previews` verifica12 condições com bloqueio deliberado de requests, transparência visível, isolamento dos slots, primeiroframe antes dos restantes, escolha mais recente e corpo completo na abertura. `npm run test:ui` mantém19 condições de navegação.

## Áudio ElevenLabs — banco gerado e integrado

A autenticação por API key resolveu o erro401 do OAuth. O banco publicado contém **41 MP3s reais gerados pela ElevenLabs**:33 efeitos específicos dos11 lutadores,6 efeitos comuns e2 temas instrumentais. Os originais ficam em `assets/audio/v9/masters`; os arquivos usados pelo jogo receberam ajuste de volume e margem de pico. Um impacto inicialmente muito baixo foi regenerado individualmente. O sintetizador anterior serve como fallback se um arquivo falhar. `audio.js` implementa reprodução por identidade, ataques/especiais/supers, impactos, defesa, salto, KO, sons de menu, música de menu/luta, panorama estéreo, limite de12 efeitos simultâneos, pausa e mute. A música começa somente após interação do usuário.

`npm run audio:plan` inspeciona41 prompts sem chamar a API:33 efeitos específicos (3 por lutador),6 efeitos compartilhados e2 temas instrumentais originais com percussão brasileira/synth arcade. `npm run audio:generate` requer autorização ElevenLabs válida e acesso à rede; gera apenas arquivos ausentes, verifica decodificação com ffprobe e publica `assets/audio/v9/manifest.json` somente com o banco inteiro pronto. A geração é seguida pela masterização de volume; credenciais ficam fora do frontend e do repositório. Depois da geração, recarregar o jogo para carregar o banco.

`npm run test:audio` verifica54 condições de roteamento, decodificação, transições de música, limite de vozes e mute com WAV sintético explicitamente fornecido pelo teste. Isso verifica a integração; **não valida conteúdo ou qualidade de sons ElevenLabs**, gerados. `npm run test:audio:real` verifica os41 arquivos reais distintos, decodificação, roteamento e eventos de áudio por teclas durante a luta. O relatório de níveis está em `artifacts/audio-levels-v9.json`.


## Impactos e efeitos após KO — revisão10

Bloquear mantém as poses de defesa, sons e redução de dano, sem escudo luminoso ou rajada ciana. Golpes que retiram vida emitem sangue vermelho escuro: respingo curto e gotas direcionais com brilho discreto, gravidade e desaparecimento rápido. O efeito é desenhado diretamente em Canvas, sem novos sprites externos. Bloqueios e golpes sem perda de vida não emitem sangue; armadura ainda emite sangue quando há dano.

Projéteis continuam avançando e envelhecendo após KO; não causam dano adicional e terminam antes do resultado final. Explosões continuam sua animação visual e estados de poder ativos são cancelados. Isso corrige os projéteis que antes congelavam ao sair da fase fight. `npm run test:blood` cobre12 condições de dano, direção, expiração, renderização real e remoção do escudo. `npm run test:ko:effects` cobre25 condições, incluindo projéteis comuns, cubos, bumerangues, fogo e bruma.


## Composição da abertura — revisão11

Os dois times agora usam filas espelhadas em perspectiva: lutador da frente alinhado, cada seguinte deslocado um pouco para dentro e para cima, com redução moderada de altura. A largura permanece automática pela proporção da silhueta; o tamanho também é limitado pela largura da tela para evitar recortes em janelas altas. Foram removidas regras antigas conflitantes da colagem. Verificação final de14 condições em desktop, desktop alto, landscape e portrait, incluindo Sebas completo e previews imediatos.


## Tamanho dos menus — revisão13

Modo e seleção de lutadores usam mais espaço em desktop: cartões de modo até1020px, elenco até1540px/94vw, previews e textos maiores. A grade de11 personagens distribui suas3 linhas pela altura disponível, evitando sobrepor confirmação e rodapé em720p. Regras específicas de telas pequenas preservam os layouts móveis. A splash mantém a composição em perspectiva. Verificação de27 condições de UI, incluindo modo/elenco em1440×900,1280×720,844×390 e390×844.


## Elenco — revisão 14

O jogo agora tem 17 lutadores. Baiano M, Cowboy, Henry K, Jamal, Joe Munist e Molly Jay receberam 600 novos sprites: 24 animações e 100 poses por personagem, incluindo ataques aéreos, agachados, troca de direção, especiais e super. As alturas individuais e a escala entre poses foram calibradas pela anatomia, com revisão visual e âncoras nas solas.

Os seis poderes são brasa solar, disparos de pressão, ondas de grave, gravidade, estrelas de energia e plumas cortantes. Foram acrescentados 18 efeitos ElevenLabs; o banco agora contém 59 arquivos. Pipeline e revisão em `assets/sprites/_generation/roster-v14/README.md`.

Verificações: 6.752 condições de assets, 114 de combate, 83 de áudio real, 34 de interface e 185 no navegador com partidas reais aprovadas.

## Elenco de 28 lutadores e organização dos assets

Ana, Bento, Deve Rás, Folle, Jay P, Mango, Miranda, Naldo, Professor, Thassia Devil e Vinil receberam 1.100 novos quadros: 24 animações e 100 poses por personagem. Cada personagem usa seu `assets/sprites/<nome>/base-source.png` na seleção e na capa.

Todos os 2.792 sprites publicados ficam em `assets/sprites/<personagem>/curated/`, com receitas, métricas e origem documentadas ao lado. Waggy e Rina Sabre usam os nomes atuais nas pastas; os IDs internos continuam compatíveis com seleções e áudio existentes. A consolidação preservou os bytes de cada imagem, ordem dos quadros, velocidade, escala e âncoras. O histórico fica em `assets/sprites/<personagem>/generation/<lote>/`; as antigas pastas `roster*` foram removidas após conferência por SHA-256.

A barra de vida agora termina vazia quando especial ou super causa KO. A seleção cria as linhas necessárias para o elenco, evita sobreposição em telas pequenas e mantém o personagem visível ao navegar ou alternar P1/rival.

Verificações: 11.702 condições de assets, 169 de combate, 46 de interface, 34 de partidas gerais e 295 do elenco no navegador aprovadas, além das regressões de barra de vida, efeitos após KO e consolidação de arquivos.

## Demonstração dos poderes na seleção

A seleção usa cards maiores com intervalo de 4px. Abaixo da descrição de cada lutador, um Canvas alterna especial (U) e super (I), com a mesma simulação, sprites e efeitos da luta sobre uma grade cartesiana. As demonstrações são silenciosas, não capturam o teclado e param quando a seleção fecha. Rina Sabre e Waggy reutilizam a animação de especial no super, como na luta; o efeito do super continua próprio.

A capa reúne os 28 lutadores, 14 de cada lado, em três fileiras espelhadas abaixo do título. `npm run test:selection:demo` verifica alternância, mudanças rápidas de personagem e layout; `npm run test:power:preview` verifica os poderes de todos os personagens nas duas direções.

Modo e seleção preenchem a altura disponível e mais de 90% da largura da tela. Voltar, confirmar e Opções compartilham uma faixa de ações integrada; no celular, a confirmação fica acima dos dois botões secundários. A tela de opções usa a mesma paleta âmbar/azul, com cartões de áudio e tela cheia, teclas dos dois jogadores e combinações avançadas. A navegação por teclado, fechamento e restauração de foco permanecem disponíveis. `npm run test:options` verifica os quatro tamanhos de tela; a suíte de interface cobre 62 condições.

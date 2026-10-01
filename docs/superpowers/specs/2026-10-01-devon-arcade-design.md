# Arcade com cinco rivais e Devon

## Objetivo e decisões aprovadas

Dar ao jogador um percurso visível até Devon: vencer cinco rivais e enfrentar o chefão no sexto confronto. Mostrar os adversários derrotados em preto e branco, os restantes e a quantidade que falta. Devon deve poder deslizar através do adversário e terminar do outro lado, respeitando os limites da arena.

Esta especificação consolida o desenho aprovado na conversa. Os valores de combate abaixo são propostas iniciais para teste, não decisões de balanceamento definitivas.

## Percurso

- Aproveitar o Arcade existente, que atualmente encadeia três confrontos.
- Sortear cinco personagens distintos do elenco jogável, excluindo o lutador escolhido; Devon ocupa sempre a sexta posição.
- Fixar sorteio e arenas no começo do percurso. Revanche, empate e falhas de carregamento não sorteiam de novo.
- Cada confronto continua seguindo a configuração atual de rounds. Somente vencer a partida completa avança a sequência.
- Restaurar a vida ao iniciar cada confronto, usando a inicialização normal da partida.
- Perder ou empatar permite repetir o confronto atual, mantendo as vitórias anteriores. Não há limite de tentativas nesta versão.
- Sair para a seleção de modo encerra o percurso. Um novo Arcade inicia outro sorteio. Não incluir persistência de campanha entre sessões nesta versão.
- Vencer Devon encerra o Arcade e apresenta a conclusão, sem tentar acessar um sétimo adversário.
- Usar as arenas existentes, começando pela escolhida e alternando as seguintes. A apresentação do sexto confronto identifica Devon como chefão; uma arena inédita não é requisito desta entrega.

## Tela de progressão

Mostrar antes da primeira partida e entre confrontos vencidos. Integrar à navegação atual, antes da apresentação versus e do carregamento da luta.

- Seis retratos em ordem, com nome e posição; Devon tem moldura roxa e identificação CHEFÃO.
- Derrotados: grayscale, marca de vitória e texto DERROTADO. A cor não é o único indicador.
- Adversário atual: retrato colorido, destaque dourado e texto PRÓXIMO RIVAL.
- Futuras lutas: retratos coloridos menos destacados e texto AGUARDANDO.
- Contador: “3 de 5 adversários derrotados · Faltam 2 até Devon”, por exemplo.
- Após a quinta vitória: “DESAFIO FINAL — DEVON”. Devon vencido recebe também a marca de derrota na conclusão.
- Ação principal: ENFRENTAR RIVAL, mudando para ENFRENTAR DEVON no confronto final. Ação secundária: sair pelo fluxo de menu existente.
- Não avançar automaticamente enquanto o jogador lê a tela. Proteger a ação contra cliques duplicados e preservar o progresso se os sprites não carregarem.
- Suportar teclado, controle e toque seguindo as convenções do jogo. Em telas pequenas, distribuir os seis retratos em uma grade sem esconder o próximo rival.
- Manter o contador fora da arena durante a luta; a tela entre confrontos é a referência de progresso nesta versão.

## Devon e seus assets

- Identidade visual: `novos_player_para_implementar/Devon.png` é a fonte de verdade. Preservar gorro estampado, óculos, barba, camiseta CHORUME, casaco rasgado, correntes, botas e energia roxa.
- Personagem de CPU exclusivo do confronto final. Não aparece na grade comum, sorteio de jogador ou sorteio dos cinco rivais; não pode ser escolhido no versus ou online nesta versão.
- Registrar sua definição de combate separadamente da lista de personagens selecionáveis, mas permitir que carregamento, HUD, resultados e renderização resolvam seu perfil.
- Produzir sprites próprios seguindo o pipeline sprite-gen já usado pelo projeto. Não substituir a animação final por um retrato estático ou sprites de outro personagem.
- Cobrir movimentação, ataques básicos, defesa, reações de dano, derrota e os movimentos especiais utilizados. Validar transparência, alinhamento dos pés, escala, orientação e identidade nas poses.
- Silhueta de chefão maior que a média, ajustada junto às caixas de colisão para não criar alcance enganoso.
- Ataques básicos pesados e poder de energia roxa com preparação e recuperação perceptíveis. Sem segunda fase obrigatória nesta versão.

## Deslizamento sombrio

Movimento de reposicionamento exclusivo do Devon, separado do dash normal e dos golpes que causam dano.

- Usar somente no chão, vivo e fora de atordoamento, queda, ataque e outro deslizamento.
- Preparação visível com energia roxa; movimento contínuo com rastros; recuperação curta ao terminar.
- Proposta inicial: preparação de 0,18 s, deslocamento de 0,30 s, recuperação de 0,25 s e intervalo mínimo de 3 s entre usos. Constantes isoladas para balanceamento.
- Proposta inicial: custo de 25 de energia; a CPU precisa cumprir os mesmos requisitos da simulação.
- Dentro de alcance inicial de 420 unidades, calcular destino aproximadamente 110 unidades além do adversário, considerando a posição dele ao começar o deslocamento. Fora desse alcance, a CPU não inicia a manobra.
- Se não existir espaço válido atrás do adversário, escolher um destino antes dele, mantendo separação suficiente. Se nenhuma posição de chegada for válida, não iniciar nem consumir energia.
- Usar os limites de movimento da arena real, não as bordas visíveis da câmera. Devon e o adversário devem permanecer dentro deles.
- Durante o deslocamento, permitir atravessar a colisão entre corpos sem empurrar o adversário. Isso não concede invulnerabilidade automática aos golpes.
- Ao terminar, validar novamente espaço e separação, pois o adversário pode ter se movido. Evitar sobreposição sem reposicionar ou teleportar o jogador.
- Virar Devon para o adversário no fim; nenhum ataque automático acontece durante a recuperação. Um golpe posterior segue as regras normais.
- Pausa interrompe o avanço do tempo; reinício de round e revanche limpam estado e efeitos transitórios da manobra.

## Integração

Manter a composição do percurso e os estados de progressão em uma unidade pequena, testável, sem duplicar a sequência em handlers de interface. `app.js` continua responsável por telas, carregamento e início de confronto.

`game.js` mantém a simulação do movimento; rastros e aura usam os efeitos existentes. A resolução entre corpos precisa respeitar o estado de travessia do Devon. O Phaser continua controlando a cena e o ciclo de atualização.

O carregamento usa o manifesto de sprites. A definição do Devon precisa ser resolvida também em módulos que hoje esperam apenas `FIGHTERS`, mantendo os IDs selecionáveis restritos ao elenco comum. Não misturar a inclusão do chefão com mudanças nas paletas alternativas existentes.

## Verificação e critérios de aceite

1. Sortear cinco rivais distintos, sem o jogador e sem Devon; seis confrontos exatos, com Devon no final.
2. Vitória avança uma posição; empate e derrota mantêm a posição; tentativa de carregamento e cliques duplicados não pulam confrontos.
3. Retratos, marcações e contador correspondem às partidas vencidas. Verificar começo, estado intermediário, entrada no chefão e conclusão.
4. Percorrer as seis partidas em teste de navegador, incluindo revanche e uma falha de carregamento recuperável.
5. Verificar deslizamento nas duas direções, no centro e nas duas bordas, com adversário parado e em movimento. Asserções sobre posições, separação, orientação, energia, intervalo e ausência de dano causado pela travessia.
6. Conferir pausa, dano durante o movimento, troca de round e limpeza de estado.
7. Inspecionar sprites de Devon e capturas da progressão em desktop e mobile; testar navegação por teclado, controle e toque.
8. Executar checagem de sintaxe e testes pertinentes de Arcade, combate, colisão e seleção. Reportar falhas fora do escopo em vez de declarar a suíte inteira aprovada.

## Limites da entrega

Não incluir editor de paletas, modo história, desbloqueio persistente do chefão, novo cenário obrigatório ou Devon jogável. Acesso direto ao chefão fica restrito ao harness de teste, sem nova opção pública de menu.

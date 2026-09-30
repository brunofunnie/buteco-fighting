# Buteco Fighting — plano de implementação

Referência: linguagem de arcade de Street Fighter II/III: dois lutadores legíveis, golpes com antecipação e recuperação, barras de vida, rounds, defesa, especiais, impacto e arenas com profundidade. Arte e nomes próprios para os dois personagens fornecidos.

## Construção

- Motor de combate independente: física, colisões, CPU, versus local e treino.
- Interface: menu, seleção, arenas, controles, pausa e revanche em português.
- Sprite-gen: concluído com GPT confirmado pelo usuário; 11 ações, 44 frames por personagem, extração canônica, transparência e exportação.
- Integração: carregar os PNGs exportados por manifesto, sem geração em runtime.

## Gauntlet

Builders separados para motor e interface; crítico recebe apenas artefato executável, capturas e esta referência, sem justificativas dos builders. A cada avaliação, corrigir a maior lacuna verificável e repetir o harness.

Sinais: execução no Chromium, ausência de erros, navegação, movimento, dano, defesa, especial, pausa, rounds, revanche, mobile e inspeção visual das animações.

Parar quando não houver bloqueio funcional importante e o primeiro protótipo estiver revisável; limite desta execução: até três revisões completas ou 90 minutos. Não declarar equivalência a um jogo comercial. Documentar lacunas restantes.

Concluído: dois personagens, menu, três arenas, combate e 88 sprites GPT integrados. Revisões corrigiram controles, pausa, escala de agachamento e apoio da caminhada. Validação final: 26 checks de jogo e 202 checks de animação; nenhuma falha. Limitações e evidências em GAUNTLET.md.


## Revisão 2 — jogo arcade

- Phaser 3.90: cena, atualização e renderização; simulação Canvas exibida por textura dinâmica.
- Telas: título → modo → lutador → arena → VS → combate, pausa e resultados.
- Campanha: três confrontos, progressão após vitória, revanche após derrota e campeão final.
- Arenas: mundo de 1920 pixels com câmera e parallax, HUD fixo.
- Combate: ataques aéreos/agachados, uppercut, rasteira, dash, recuo, defesa baixa, hitboxes verticais e knockdown.
- Sprite-gen GPT: 72 novas poses, total de 160 PNGs e 20 ações por lutador.
- Escala: referência por linha GPT e compensação por frame; regressão específica de ataques em pé.
- Crítica independente inspeciona captura ativa e inputs reais; corrigir lacunas antes de encerrar.

Revisão 2 concluída: 474 verificações aprovadas (34 navegador + 30 combate + 22 campanha + 388 animação). Evidências em artifacts/ e GAUNTLET.md.


## Revisão 3 — aprovada pelo usuário

Concluída: arte GPT para três arenas, animação ambiental discreta, câmera em ambos os sentidos, salto com impulso, cruzamento do rival, poses dedicadas de virada/aterrissagem/salto direcional e caminhada/recuo com seis frames. Buffer de ataque e recuperação menor deixam comandos mais responsivos. Simulação em 120 Hz e pintura direta na textura do Phaser.

Gauntlet final: 553 checks aprovados, crítico independente sem bloqueio. RAF mediano/p95 16,7 ms. A revisão ampliou apenas a iluminação localizada do rooftop após o crítico achar o movimento imperceptível; sem adicionar efeitos que cobrissem os personagens. Locomoção continua sem stride verificado.

## Revisão 4 — identidade Buteco (aprovada)

- Paleta e nome do Buteco Games nos menus e durante o combate.
- HUD aberto: sem painel de fundo, sem preenchimento de trilhas vazias; vida, energia, nomes, tempo e rounds com contornos legíveis.
- Panoramas GPT: São Paulo — Bixiga; Rio — Lapa; Nordeste — Recife Antigo.
- Animações ambientais discretas atrás dos lutadores, mantendo câmera lateral e elenco atual.
- Gauntlet: builder de arte, builder de interface, integração do HUD e crítico independente no navegador; corrigir a maior lacuna antes de encerrar.


## Revisão 7 — onze lutadores (concluída)

- Renomear Maya para Rina Sabre e Bruno para Waggy nos menus, HUD e resultados, preservando IDs dos assets existentes.
- Integrar os nove personagens de `novos-personagens-para-criar`, com perfis e poderes próprios.
- Gerar 24 animações/100 PNGs por novo lutador com GPT, seguindo sprite-gen por componentes e referências originais.
- Calibrar a anatomia e as solas, revisar todos os frames e corrigir cortes, chroma e rostos duplicados encontrados pelo crítico.
- Seleção independente P1/P2, arcade com três rivais, carregamento por dupla e cache limitado.

Concluído: 900 frames novos publicados atomicamente; 4.052 checks de assets, 125 de navegador, 72 de combate do elenco e 22 de campanha aprovados, além da regressão dos personagens anteriores. Revisão independente das nove referências/900 exports e lutas com sprites finais sem bloqueio importante.


## Revisão 8 — concluída

- Menus e pausa navegam com WASD/setas; confirmação e retorno por teclas de ação.
- Abertura dividida entre duas equipes, usando quatro novos retratos transparentes GPT.
- MASP e Copacabana substituem arenas anteriores; Manaus é a quarta opção; Recife preservado.
- Quatro novos figurantes/16 poses, caminhada e fumaça; público calibrado com solas individuais e150px no deque de Manaus.
- Água, barco, letreiros integrados a props e efeitos de combate ajustados à luz da arena.
- Revisão independente aprovou fidelidade dos retratos, perspectiva/apoio, leitura dos golpes e composição nas bordas. Testes de UI, arenas, público, campanha e elenco passaram.

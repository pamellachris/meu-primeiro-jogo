# Game Plan: Coleta Cósmica

## Conceito
Arcade 3D de uma única tela: pilote uma nave por um corredor espacial, colete cristais para aumentar o combo e desvie de meteoros. A velocidade cresce gradualmente; o objetivo é superar o recorde salvo no navegador.

## Riscos

### 1. Movimento e colisão em fluxo 3D
- **Por que isolado:** objetos avançam em direção à câmera enquanto o jogador faz movimento livre em dois eixos; erros de escala podem tornar colisões injustas.
- **Abordagem:** usar coordenadas normalizadas em um retângulo de jogo, atualizar tudo no mesmo loop e testar colisão por distância entre centros com raios explícitos.
- **Verificar:** nave responde a WASD/setas, cristais coletam quando encostam e meteoros removem um ponto de escudo sem travar o loop.

### 2. Ciclo de estados e reinício
- **Por que isolado:** início, jogo ativo, pausa e game over precisam limpar spawns e manter o HUD consistente.
- **Abordagem:** máquina de estados pequena dentro de `GameWorld`; evento DOM tipado para sincronizar score, escudo e fase com React.
- **Verificar:** botão jogar inicia/reinicia, tecla P pausa, game over congela pontuação e o reinício remove entidades antigas.

## Main Build

- **Assets necessários:** nave recortada teal/coral, cristal ciano luminoso, meteoro laranja/charcoal e referência visual 16:9; geometria procedural para estrelas, corredor e anéis.
- **Áudio:** trilha procedural com baixo, arpejo e ruído rítmico; efeitos de início, coleta, impacto e game over, desbloqueados por gesto do jogador e adaptados à velocidade/nível.
- **HUD:** marca Coleta Cósmica, score, cristais, escudo segmentado, velocidade, melhor score, combo, dica de controles e botão de pausa/reinício.
- **Verificar:**
  - Movimento direcional alinhado às teclas e limites da arena respeitados.
  - Colisão com cristal soma pontos e aumenta combo; colisão com meteoro reduz escudo.
  - Escudo, score, velocidade e melhor score permanecem legíveis sem sobreposição em desktop e mobile.
  - Não há materiais de fallback visíveis quando os assets gerados estiverem disponíveis.
  - Demo determinística em `?demo` exibe coleta e desvio sem input manual.
  - Sem erros no console durante uma rodada capturada.
  - Paleta, escala, câmera e densidade visual coerentes com `reference.png`.
  - Áudio só inicia após gesto, a trilha continua em loop sem sobreposição de timers e os eventos de coleta/impacto têm respostas sonoras distintas.

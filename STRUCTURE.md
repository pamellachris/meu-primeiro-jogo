# Structure

## Host
`client/src/App.tsx` mantém o frame React e a camada HUD. `client/src/components/GameCanvas.tsx` cria uma única instância Babylon Engine, controla resize, render loop e dispose.

## Gameplay
`client/src/game/scene.ts` contém o módulo de cena e a classe `GameWorld`. A classe é independente de React e possui input semântico, spawners simples, colisão por distância, pontuação, escudo, combo e autopilot de demo.

## Renderização
A câmera é ortográfica e fixa atrás do corredor. O mundo usa malhas procedurais para estrelas, linhas de velocidade e portal; nave, cristal e meteoro usam imagens geradas como texturas de billboard quando os URLs de armazenamento estiverem presentes, com formas emissivas como fallback seguro.

## Comunicação
`GameWorld` publica `cosmic-game:update`, `cosmic-game:state` e `cosmic-game:audio` no `window`. O HUD React só lê esses eventos e dispara `cosmic-game:command` para iniciar, pausar e reiniciar; nenhuma regra de gameplay vive em React.

## Áudio
`client/src/game/audio.ts` contém `AudioManager`, que usa Web Audio API sem arquivos pesados. Após o primeiro gesto, ele cria a trilha em camadas com baixo, arpejo e ruído rítmico, altera tempo/filtro conforme velocidade e nível e responde a início, cristal, impacto e game over. O módulo fecha o `AudioContext`, remove listeners e cancela o scheduler no dispose.

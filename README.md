# Coleta Cósmica

Jogo arcade 3D para navegador, construído com React, TypeScript e Babylon.js.

## Como jogar

- Clique em **Jogar agora** ou pressione `Enter`.
- Use `WASD` ou as setas para mover a nave.
- Colete cristais ciano para aumentar a pontuação e o combo.
- Desvie dos meteoros laranja para preservar o escudo.
- Pressione `P` para pausar.
- O primeiro clique ou toque desbloqueia a trilha e os efeitos sonoros no navegador.

## Desenvolvimento local

```bash
pnpm install
pnpm dev
```

Depois abra o endereço exibido pelo Vite. Para visualizar o autopilot de demonstração, acesse `/?demo`.

## Validação

```bash
pnpm check
pnpm build
```

## Estrutura

- `client/src/game/scene.ts`: mundo 3D, movimento, spawns, colisões e pontuação.
- `client/src/game/audio.ts`: trilha procedural adaptativa e efeitos sonoros.
- `client/src/components/GameCanvas.tsx`: integração Babylon.js com React.
- `client/src/App.tsx`: HUD, telas de início/pausa/game over e comandos.
- `PLAN.md`, `STRUCTURE.md`, `MEMORY.md` e `ASSETS.md`: documentação do pipeline do jogo.

Os assets visuais usados no preview são servidos pelo armazenamento do WebDev (`/manus-storage/...`). Para uma publicação independente fora do WebDev, será necessário copiar esses assets para o provedor de hospedagem e ajustar os caminhos em `client/src/game/scene.ts`.

# Memory

- Projeto criado como `web-static` em `/home/ubuntu/coleta-cosmica`.
- Babylon.js instalado com `pnpm add @babylonjs/core`.
- Direção visual: neon sci-fi premium, fundo indigo, acentos teal/ciano/coral e tipografia Space Grotesk + DM Mono.
- O jogo foi deliberadamente mantido sem backend: melhor score usa `localStorage`.
- A flag `?demo` ativa um autopilot determinístico para a verificação visual.
- Áudio não é requisito: navegadores bloqueiam autoplay; o jogo usa microanimações visuais e pode funcionar silenciosamente.
- O áudio agora usa Web Audio API procedural: o primeiro clique/tecla desbloqueia a trilha, que adapta tempo e filtro ao ritmo da rodada e dispara efeitos sonoros por evento.

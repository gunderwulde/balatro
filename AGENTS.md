# AGENTS.md — Guía para agentes de IA (Balatro Web)

Port de **Balatro** a navegador con **Three.js** + TypeScript + Vite. Lee primero [GDD.md](GDD.md) (qué construir) y [PLAN.md](PLAN.md) (en qué orden). Este archivo define **cómo** trabajar.

## Stack (decisión cerrada)
- **Three.js** (render 3D/2.5D, shaders de edición, post-proceso CRT). Elegido sobre PixiJS porque Balatro depende de: cartas con inclinación 3D por el cursor, shaders de Foil/Holo/Polychrome/Negative, y filtro CRT/swirl de fondo. PixiJS 2D no cubre bien la inclinación 3D.
- **TypeScript** estricto, **Vite**, **Vitest** para tests.
- UI de texto/HUD: **DOM/CSS sobre el canvas** (más nítido y accesible) o `troika-three-text` para texto dentro de cartas. Decidir en Fase 1 y no mezclar.
- Audio: **Howler.js** o WebAudio directo.
- Estado: store propio sin dependencias (patrón reducer + eventos). Sin React salvo que se decida explícitamente.
- Sin backend en MVP. Persistencia en `localStorage`/IndexedDB.

## Arquitectura (regla de oro: lógica ≠ render)
```
src/
  core/        # LÓGICA PURA. Sin imports de three/DOM. 100% testeable en Node.
    rng.ts         # PRNG con semilla (seeded), streams separados por sistema
    cards.ts       # Card, Rank, Suit, Enhancement, Edition, Seal
    hands.ts       # Detección de manos de póker
    scoring.ts     # Pipeline de puntuación (ver GDD §6)
    run.ts         # Máquina de estados de la partida (ante/blind/shop)
    shop.ts, packs.ts, economy.ts
    content/       # Datos: jokers, tarots, planets, spectrals, vouchers, bosses, decks, stakes, tags
  render/      # Three.js: escena, cartas, shaders, cámara, animaciones
  ui/          # HUD, menús, tooltips
  audio/
  main.ts
tests/         # Vitest sobre core/
```
- `core/` **nunca** importa de `render/` ni `ui/`. El render solo *lee* estado y emite *intenciones* (acciones).
- Toda la aleatoriedad pasa por `core/rng.ts` con semilla → runs reproducibles y tests deterministas.
- El scoring emite una **lista de eventos** (`{source, type:'chips'|'mult'|'xmult'|'money', value}`) que el render reproduce con animación secuencial. La lógica calcula instantáneo; la animación es solo presentación.

## Contenido data-driven
- Cada Joker/Tarot/etc. es un objeto declarativo con hooks (`onScoreCard`, `onHandPlayed`, `onRoundEnd`, `onSell`, `calcPassive`…) en `core/content/`. Añadir un joker = añadir un objeto + un test, sin tocar el motor.
- IDs estables en `snake_case` (`joker_greedy`, `tarot_fool`). Nunca renombrar tras guardar partidas.

## Convenciones
- Idioma: **código e identificadores en inglés**; docs y textos de diseño en español; textos de juego vía i18n (`es`, `en`) desde el inicio (`src/i18n/`).
- Sin `any`. Sin lógica de juego en componentes de render.
- Funciones del core puras cuando sea posible (`(state, action) => newState`).
- Commits pequeños y atómicos; mensaje en imperativo.
- No añadir dependencias sin justificarlo en el PR/commit.

## Testing (obligatorio en `core/`)
- Todo joker, tarot, planet, voucher y boss nuevo lleva test de su efecto.
- Tests de detección de manos con casos límite (A-2-3-4-5 straight, Flush Five, cartas Stone, Wild, Smeared Joker, Four Fingers, Shortcut).
- Tests de orden de puntuación (ver GDD §6): el orden de jokers **importa** (+mult antes de xmult).
- `npm test` debe pasar antes de dar una tarea por terminada.

## Rendimiento
- Objetivo: 60 fps en portátil medio, ≤ 150 draw calls. Cartas con `InstancedMesh` o atlas único; reutilizar geometrías/materiales; no crear objetos en el bucle de render.
- Cargar assets con manifiesto; pantalla de carga.

## Assets y propiedad intelectual
- El usuario indica ser el creador original de Balatro; aun así, **no copiar assets binarios de fuentes externas ni extraer del juego instalado** sin que el usuario los aporte explícitamente en `assets/`. Mientras tanto usar **placeholders** (rectángulos, texto, pixel-art generado) detrás de una interfaz `AssetManifest` para sustituir luego sin tocar código.
- Los valores numéricos y reglas del GDD vienen de conocimiento público y **deben verificarse** contra la fuente de verdad del autor (marcados `⚠ verificar`).

## Flujo de trabajo para agentes
1. Lee la fase actual en PLAN.md; trabaja solo en tareas de esa fase.
2. Antes de código: confirma que la regla está en GDD.md; si falta o es ambigua, **pregunta** o anota la suposición en GDD §Decisiones abiertas.
3. Implementa en `core/` + test primero, luego render/UI.
4. Marca la tarea `[x]` en PLAN.md al terminar y verifica con `npm test` y `npm run build`.
5. Verifica visualmente en navegador (dev server) los cambios de render/UI antes de darlos por buenos.

## Comandos (tras Fase 0)
```
npm install
npm run dev      # Vite dev server
npm test         # Vitest
npm run build    # build de producción
npm run lint
```

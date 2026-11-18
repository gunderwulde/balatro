# PLAN — Balatro Web

Leyenda: `[ ]` pendiente · `[x]` hecho. Cada fase termina con un **entregable verificable**. Trabajar en orden; la lógica (`core/`) va siempre antes que el render.

## Fase 0 — Setup (½ día)
- [ ] `npm create vite` (vanilla-ts), instalar `three`, `vitest`, `eslint`, `prettier`, `howler`.
- [ ] Estructura de carpetas según AGENTS.md; alias de imports.
- [ ] Escena Three.js "hola mundo" (cámara, renderer, resize, bucle).
- [ ] CI local: `npm test`, `npm run build`, `npm run lint`.
- **Entregable:** `npm run dev` muestra una carta placeholder; tests corren en verde.

## Fase 1 — Núcleo de reglas (`core/`) (3–5 días)
- [ ] `rng.ts` con semilla y streams.
- [ ] Modelo de carta/mazo, barajar, robar, descartar.
- [ ] `hands.ts`: detección de las 12 manos + selección de cartas que puntúan.
- [ ] Niveles de mano (tabla GDD §5).
- [ ] `scoring.ts`: pipeline GDD §6 con lista de eventos; orden de jokers.
- [x] Máquina de estados `run.ts` (ciegas, skip, victoria/derrota; tienda pendiente Fase 4).
- [x] Economía: recompensas e interés (venta pendiente).
- [ ] Tests exhaustivos (manos límite, orden de puntuación, determinismo por semilla).
- **Entregable:** simulación headless de una run completa por consola/test con bot aleatorio.

## Fase 2 — Render de cartas y mesa (3–4 días)
- [ ] Carta como quad con textura (atlas placeholder), esquinas redondeadas.
- [ ] Inclinación 3D por cursor, hover, selección (elevar), arrastre, reordenar.
- [ ] Mano en abanico, mazo, zona de juego, descarte.
- [ ] Animaciones: robar, jugar, descartar (tweens con easing/muelles).
- [ ] Fondo shader swirl + post-proceso CRT (con toggle).
- **Entregable:** manejar la mano con ratón y jugar/descartar con feedback visual.

## Fase 3 — Loop jugable mínimo (3–4 días)
- [x] HUD de la run: objetivo, puntos, manos, descartes, $, ante, vista previa de mano.
- [x] Botones Jugar/Descartar (ordenar por rango/palo pendiente).
- [ ] Reproducción animada de eventos de scoring (sonidos placeholder).
- [x] Menú principal con semilla, opciones, fondo swirl (hecho).
- [x] Selección de ciega, cashout y fin de run.
- **Entregable:** jugar 3 ciegas solo con cartas (sin tienda) de principio a fin.

## Fase 4 — Jokers y tienda (4–6 días)
- [x] Zona de jokers (DOM): slots, reordenar arrastrando, vender, tooltips.
- [x] Hooks de jokers + 39 jokers MVP (todas las categorías; valores a verificar).
- [x] Ediciones de joker Foil/Holo/Policroma/Negativa (efecto CSS en DOM, no shader; ver nota).
- [x] Tienda: 2 casillas, reroll, compra/venta, 2 packs (Celestial/Bufones), 1 voucher (4 en MVP).
- [x] Planets + pantalla de niveles de mano.
- **Entregable:** run completa 8 antes con jokers, tienda y planets.

## Fase 5 — Bosses, consumibles, packs (4–6 días)
- [ ] 8+ Boss Blinds con sus modificadores (incl. un finisher); debuff visual de cartas.
- [ ] Tarots (~10→22), Spectrals, Booster Packs con selección.
- [ ] Enhancements y Seals en carta + sus efectos de scoring.
- [ ] Tags y skip de ciegas.
- [ ] Vouchers (lista completa por pares).
- **Entregable:** loop de run completo equivalente al juego base (contenido parcial).

## Fase 6 — Mazos, Stakes y meta (3–4 días)
- [ ] 15 mazos con sus modificadores; selección al iniciar.
- [ ] 8 Stakes acumulativos + stickers (Eternal/Perishable/Rental).
- [ ] Guardado/continuar run, estadísticas, colección, desbloqueos.
- [ ] Endless (Ante 9+).
- **Entregable:** meta-progresión funcionando y persistida.

## Fase 7 — Contenido completo (iterativo, 1–2 semanas)
- [ ] Completar 150 jokers por lotes de ~20 (con test cada uno).
- [ ] Resto de bosses, tarots, spectrals, tags, challenges.
- [ ] Verificar todos los valores `⚠ verificar` del GDD contra la fuente oficial.

## Fase 8 — Pulido, audio y plataforma (1 semana)
- [ ] Música dinámica + SFX completos, mezcla de volúmenes.
- [ ] Juice: shake, partículas, números flotantes, mult en llamas.
- [ ] Controles táctiles y teclado; responsive; opciones de accesibilidad (reducir movimiento, daltonismo, CRT off).
- [ ] i18n ES/EN completo.
- [ ] Rendimiento (profiling, ≤150 draw calls, carga de assets), PWA opcional.
- [ ] Sustituir placeholders por assets originales del autor.
- **Entregable:** build de producción desplegable (Netlify/Vercel/itch.io).

## Fase 9 — Lanzamiento
- [ ] Playtest, balance, corrección de bugs.
- [ ] Hosting + dominio, analítica opcional (respetando privacidad).
- [ ] Decidir modelo: gratis/demo/de pago y aspectos legales (ver GDD §17).

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Interacciones entre jokers explotan en complejidad | Hooks declarativos + tests por joker + bot de simulación masiva |
| Rendimiento de shaders en móviles | Calidad adaptativa, desactivar CRT/swirl |
| Texto en shaders/cartas poco nítido | HUD en DOM; texto de cartas pre-renderizado a textura |
| Datos del juego no verificados | Marcar `⚠ verificar` y cerrar en Fase 7 con la fuente del autor |
| Alcance enorme (150 jokers) | MVP con 30; resto por lotes tras jugable |

## Siguiente acción inmediata
Ejecutar **Fase 0**. Preguntas para desbloquear antes de la Fase 2: ¿dispones de los assets originales (sprites, sonido, fuente)? ¿HUD en DOM (recomendado)? ¿soporte móvil desde el MVP?

## Notas de implementación (Fase 4)
- Jokers/tienda se dibujan en **DOM** con arte procedural (`render/itemArt.ts`) y ediciones por CSS. Si se quiere shader real (Three.js) para las ediciones, mover los jokers a la escena 3D es tarea futura.
- Planetas se **consumen al comprar** (no hay slots de consumible hasta la Fase 5).
- Probabilidades de edición **aumentadas** en `core/shop.ts` (`EDITION_ODDS`) para poder verlas; ⚠ ajustar al balance oficial.

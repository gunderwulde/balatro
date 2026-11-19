# GDD — Balatro Web

> Versión navegador de Balatro (roguelike de deckbuilding basado en póker). Valores marcados **⚠ verificar** proceden de conocimiento público/wiki y deben contrastarse con la versión oficial del autor.

## 1. Visión
- **Pitch:** Juega manos de póker para superar "ciegas" cada vez más exigentes, construyendo sinergias absurdas con comodines (Jokers).
- **Plataforma:** navegador de escritorio (prioridad) y móvil/táctil (secundario). Sin instalación.
- **Pilares:** (1) "una ronda más" — runs de 30–60 min; (2) escalado exponencial satisfactorio (juice); (3) decisiones de build con información clara; (4) rejugabilidad por semilla/mazos/stakes.
- **Referencias de feel:** cartas con inclinación 3D, CRT/swirl de fondo, números que rebotan, música lo-fi jazz, pantalla de score con "tick" creciente.

## 2. Tecnología (resumen)
Three.js + TypeScript + Vite. Lógica pura separada del render (ver AGENTS.md). Cámara ortográfica/perspectiva suave sobre un plano; cartas = quads con shader propio.

## 3. Estructura de una run
- 8 **Antes** (rondas). Cada Ante = 3 ciegas: **Small**, **Big**, **Boss**.
- Ganar el Ante 8 = victoria; opción de **Endless** (Ante 9+).
- Small y Big pueden **saltarse (Skip)** para obtener un **Tag**; el Boss no.
- Tras cada ciega superada → **Cash out** → **Shop** → siguiente ciega.
- Perder = quedarse sin manos con puntuación < objetivo.

### Estado inicial (mazo Red/Básico) ⚠ verificar
| Recurso | Valor |
|---|---|
| Manos por ciega | 4 |
| Descartes por ciega | 4 |
| Tamaño de mano | 8 cartas |
| Dinero | $4 |
| Slots de Joker | 5 |
| Slots de consumible | 2 |
| Mazo | 52 cartas estándar |
| Cartas a jugar/descartar | hasta 5 por acción |

### Objetivo de puntos (Stake blanco) ⚠ verificar
Base por Ante: 300, 800, 2.000, 5.000, 11.000, 20.000, 35.000, 50.000.
Small = ×1, Big = ×1,5, Boss = ×2 (la mayoría). Ante 9+ crece de forma exponencial (fórmula en Endless; ⚠ verificar). Stakes superiores usan tablas más altas.

### Recompensas de ciega ⚠ verificar
Small $3, Big $4, Boss $5 (Skip = 0 pero da Tag). Al cobrar: **+$1 por mano sobrante**, + **interés** $1 por cada $5 en poder (máx. $5 de interés, sube con vouchers), + dinero de Jokers.

## 4. Cartas y mazo
- **Palos:** ♠ ♥ ♦ ♣. **Rangos:** 2–10, J, Q, K, A.
- **Chips por carta:** 2–10 = su valor; J/Q/K = 10; A = 11.
- Pool de robo: se baraja el mazo; se roba hasta llenar la mano tras jugar/descartar. Las cartas jugadas/descartadas no vuelven hasta la siguiente ciega.
- **Enhancements** (una por carta) ⚠ verificar: Bonus (+30 chips), Mult (+4 mult), Wild (cualquier palo), Glass (×2 mult, 1/4 de romperse), Steel (×1,5 mult mientras está en mano), Stone (+50 chips, sin rango/palo, siempre puntúa), Gold ($3 si está en mano al final de ronda), Lucky (1/5: +20 mult; 1/15: +$20).
- **Editions** (carta o joker): Foil (+50 chips), Holographic (+10 mult), Polychrome (×1,5 mult), Negative (+1 slot de Joker/consumible; en carta de mazo: +1 tamaño de mano... ⚠ verificar).
- **Seals:** Gold ($3 al jugarla), Red (re-disparo), Blue (genera Planet si queda en mano al final), Purple (genera Tarot al descartarla).

## 5. Manos de póker (base y mejora por nivel) ⚠ verificar
| Mano | Chips | Mult | +Chips/nivel | +Mult/nivel |
|---|---|---|---|---|
| High Card | 5 | 1 | 10 | 1 |
| Pair | 10 | 2 | 15 | 1 |
| Two Pair | 20 | 2 | 20 | 1 |
| Three of a Kind | 30 | 3 | 20 | 2 |
| Straight | 30 | 4 | 30 | 3 |
| Flush | 35 | 4 | 15 | 2 |
| Full House | 40 | 4 | 25 | 2 |
| Four of a Kind | 60 | 7 | 30 | 3 |
| Straight Flush | 100 | 8 | 40 | 4 |
| Five of a Kind (secreta) | 120 | 12 | 35 | 3 |
| Flush House (secreta) | 140 | 14 | 40 | 4 |
| Flush Five (secreta) | 160 | 16 | 50 | 3 |

Las manos secretas se muestran solo tras jugarlas. Solo puntúan las cartas que forman la mano (salvo Jokers que digan otra cosa; las "kickers" no puntúan; **Stone** siempre puntúa).

## 6. Pipeline de puntuación (CRÍTICO — el orden importa)
Puntuación = **Chips × Mult**. Al jugar una mano:
1. Detectar la mano → cargar `chips`/`mult` base según su **nivel**.
2. **Por cada carta que puntúa, de izquierda a derecha:**
   a. + chips de la carta (rango).
   b. Efectos de enhancement/edition de la carta.
   c. Efectos de Jokers "on card scored" (de izquierda a derecha).
   d. Re-disparos (Red Seal, Hanging Chad, etc.) repiten el paso.
3. **Cartas en mano (no jugadas):** efectos tipo Steel, Baron, Shoot the Moon…
4. **Jokers** de izquierda a derecha: cada uno aplica su efecto **independiente** (+chips, +mult, ×mult) y su **edition** (Foil/Holo antes del efecto del joker, Polychrome después ⚠ verificar).
5. Resultado = `chips × mult`, se suma al marcador de la ciega.
6. Tras la mano: efectos "on hand played"; las cartas jugadas van a descarte.
- Consecuencia de diseño: **+Mult primero, ×Mult después** da más → el **orden de los Jokers es una decisión de jugador** (reordenables por arrastre).
- El motor devuelve una lista ordenada de eventos para animar.

## 7. Jokers
- 150 en el juego base ⚠ verificar. Rarezas: **Common, Uncommon, Rare, Legendary** (esta última solo vía Spectral *Soul*).
- Precio base según rareza/efecto; **venta = 50%** del coste (redondeo abajo ⚠ verificar).
- Categorías de efecto: +chips, +mult, ×mult, economía ($), modifican reglas (Four Fingers, Shortcut, Smeared, Splash), generan cartas/consumibles (Riff-Raff, 8 Ball), escalan con el tiempo (Ride the Bus, Ceremonial Dagger, Hologram), copian (Blueprint, Brainstorm), y de supervivencia (Mr. Bones).
- Pegatinas (stakes altos): **Eternal** (no vendible/destruible), **Perishable** (5 rondas), **Rental** ($3/ronda).
- **MVP:** ~30 jokers representativos cubriendo todas las categorías; ampliar hasta 150 por lotes (Fase 7).

## 8. Consumibles (2 slots)
- **Tarot** (22): modifican cartas (enhancements, palos, rangos, destruir, duplicar) o dan dinero/otras cartas (The Fool, The Magician, The Hermit…).
- **Planet** (12): +1 nivel a una mano concreta (Pluto=High Card, Mercury=Pair, Uranus=Two Pair, Venus=Three, Saturn=Straight, Jupiter=Flush, Earth=Full House, Mars=Four, Neptune=Straight Flush; secretos: Planet X=Five of a Kind, Ceres=Flush House, Eris=Flush Five). Aparecen en la tienda y en Celestial Packs. ⚠ verificar mapeo.
- **Spectral** (18): efectos potentes con coste (Familiar, Grim, Incantation, Immolate, The Soul, Black Hole…). Solo en Spectral Packs / algunos jokers.

## 9. Tienda
- Tras cada ciega. Contiene: **2 slots** de cartas/jokers/consumibles (probabilidad: Joker ≫ Tarot/Planet ≫ carta jugable ⚠ verificar), **2 Booster Packs**, **1 Voucher** (por Ante).
- **Reroll:** $5 inicial, +$1 por reroll en la misma tienda (se reinicia cada tienda) ⚠ verificar.
- **Booster Packs:** Arcana (Tarot), Celestial (Planet), Standard (cartas con mods), Buffoon (Jokers), Spectral; tamaños Normal/Jumbo/Mega (elegir 1/1/2 de 3/5/5) ⚠ verificar.
- **Vouchers:** 32 en 16 pares (base → mejorado). Ej.: Overstock (+1 slot tienda), Clearance Sale (−25% precios), Grabber (+1 mano), Wasteful (+1 descarte), Seed Money (interés hasta $10), Crystal Ball (+1 slot consumible)… ⚠ verificar lista.

## 10. Boss Blinds
Un boss aleatorio por Ante con modificador (ej.: The Hook descarta 2 cartas al azar por mano; The Wall = objetivo ×4; The Needle = solo 1 mano; The Psychic = solo manos de 5 cartas; The Club/Goad/Window/Head = debuff de un palo; The Flint = chips y mult a la mitad; The Plant = caras debuffeadas; The Ox = jugar tu mano más jugada deja dinero a $0…). Las **Finishers** (Ante 8, y 8k en Endless: Amber Acorn, Verdant Leaf, Violet Vessel, Crimson Heart, Cerulean Bell) son especialmente duras. ⚠ lista completa a verificar.

## 11. Tags (al saltar ciegas)
Ej.: Investment ($25 al derrotar boss), Voucher Tag, Double Tag, Coupon, Charm/Meteor/Buffoon/Ethereal packs gratis, Rare/Uncommon Tag, Negative/Foil/Holo/Poly Tag, Handy, Garbage, Orbital (sube nivel mano), Economy, Speed, Juggle, D6, Skip… ⚠ verificar.

## 12. Mazos y Stakes
- **Mazos (15)** ⚠ verificar: Red (+1 descarte), Blue (+1 mano), Yellow (+$10), Green (en vez de interés, $2/mano y $1/descarte restante), Black (+1 slot joker, −1 mano), Magic (Crystal Ball + 2 Fool), Nebula (Telescope, −1 slot consumible), Ghost (Spectrals en tienda + Hex), Abandoned (sin figuras), Checkered (solo ♠/♥), Zodiac (3 vouchers), Painted (+2 hand size, −1 joker slot), Anaglyph, Plasma, Erratic.
- **Stakes (8):** White, Red (Small sin recompensa), Green (escalado más rápido), Black (Eternal jokers), Blue (−1 descarte), Purple (escalado aún mayor), Orange (Perishable), Gold (Rental). Cada stake **acumula** los anteriores. Desbloqueo: ganar con un mazo en cada stake.

## 13. Meta-progresión
- **Colección** (jokers/cartas vistos), **desbloqueos** por logros/condiciones (Challenge sets), **modo Challenge**, **semillas** compartibles (8 caracteres) y **estadísticas** (mejor mano, mejor run).
- Persistencia en `localStorage` + export/import de partida.

## 14. UX, Feel y Juice
- **Cartas:** inclinación 3D según posición del cursor sobre la carta, hover levanta, arrastre con inercia, abanico en mano.
- **Scoring:** cada carta/joker puntuando salta + sonido con tono ascendente; contadores de Chips/Mult hacen "pop"; marcador final cuenta hacia arriba; shake de pantalla en puntuaciones enormes; mult en llamas al superar umbral.
- **Fondo:** shader swirl/CRT con paleta que cambia según la ciega; scanlines y curvatura opcionales (accesibilidad: desactivables).
- **Audio:** BGO lo-fi jazz con capas dinámicas, SFX de cartas/monedas; volumen separado música/SFX.
- **Controles:** ratón (clic para seleccionar, botones Jugar/Descartar, arrastrar para reordenar), **teclado** (atajos), **táctil**. Reducir movimiento y daltonismo (palos de alto contraste) como opciones.
- **Tooltips** claros en jokers/cartas; mostrar **vista previa de la mano** detectada con chips/mult antes de jugar.

## 15. Arte y audio
- Estética pixel-art 71×95 por carta, rejilla de baja resolución escalada (nearest-neighbor) con shaders.
- Fuente pixelada (m6x11 o similar; ⚠ licencia). Texto localizado ES/EN.
- Placeholders hasta que el autor aporte los assets originales (ver AGENTS.md).

## 16. Alcance
- **MVP:** ciclo completo de run (8 antes, blinds, skip), scoring correcto, 12 manos, mazo Red, ~30 jokers, planets, ~10 tarots, tienda con vouchers básicos, 8 bosses, UI jugable, render 3D con shaders de edición, guardado.
- **v1.0:** contenido completo, todos mazos/stakes, spectrals, packs, tags, coleccionables, audio completo, móvil.
- **Post-lanzamiento:** retos, semilla diaria, modding/JSON de contenido, leaderboards (requiere backend).

## 17. Decisiones abiertas
1. ~~HUD en DOM o canvas~~ → DOM (resuelto).
2. ~~Táctil/móvil~~ → entrada por pointer events desde el MVP; pulido móvil pendiente de playtest.
3. ~~Assets originales~~ → descartado: arte y audio procedurales.
4. Tabla exacta de objetivos Endless, probabilidades de tienda y lista completa de contenido: confirmar con datos oficiales.
5. ¿Nombre y marca del port (oficial o fan-project)?

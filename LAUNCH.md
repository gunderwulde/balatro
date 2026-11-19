# LAUNCH.md — Lanzamiento (Fase 9)

Estado: el juego está desplegado automáticamente en GitHub Pages desde `main` (workflow `.github/workflows/deploy.yml`: `npm ci` → `npm test` → `npm run build` → Pages). La URL es `https://gunderwulde.github.io/balatro/`.

## 1. Playtest y balance

- **Bot de simulación** (`tests/helpers/bot.ts`): juega la mejor mano por puntuación, descarta lo que no puntúa, compra jokers/planetas y relanza. Se usa en `tests/fuzz.test.ts`, que recorre cada mazo (stakes 1 y 8) y cada desafío comprobando que la run siempre termina sin errores. Corre dentro de `npm test`.
- **Informe de balance**: `BALANCE=1 npx vitest run tests/fuzz.test.ts -t tasa --reporter=verbose` (20 runs por stake, mazo Rojo). Referencia actual del bot (sin usar tarots, packs ni vender/reordenar jokers): **Ante medio ≈ 4,0 en Stake Blanco, ≈ 2,3–2,8 en Stakes altos, 0 % de victorias**. Un bot tan simple no gana: no indica desequilibrio por sí solo; sirve para detectar regresiones (si el Ante medio cambia mucho tras tocar el motor, algo se rompió).
- **Bug encontrado por el bot y corregido**: rondas imposibles de continuar (Ojo/Boca sin jugadas legales y sin descartes, o mano y mazo vacíos) dejaban la partida bloqueada; ahora la ronda se pierde (`Run.stuck`).
- **Pendiente (requiere personas)**: partidas reales para ajustar: objetivos de Endless (aproximados), probabilidades de tienda, los 12 desafíos propios (sin equilibrar) y los textos de las ediciones/Stakes. Lista de comprobación de playtest:
  - [ ] Una run completa en Stake Blanco con cada mazo.
  - [ ] Cada Boss al menos una vez (sobre todo los de cartas boca abajo y la Campana).
  - [ ] Guardar y continuar en tienda y en selección de ciega.
  - [ ] Móvil/tableta: táctil, tamaño de cartas y botones.
  - [ ] Rendimiento: abrir con `?debug` (muestra fps y draw calls; la calidad baja sola por debajo de 35 fps sostenidos).

## 2. Hosting, dominio y analítica

- **Hosting**: GitHub Pages (gratuito, HTTPS). Alternativas válidas con el mismo `dist/`: itch.io (subir el zip de `dist/`, canal HTML5) y Netlify/Vercel.
- **Dominio propio**: en el repo → Settings → Pages → Custom domain; crear un `CNAME` en el DNS apuntando a `gunderwulde.github.io`. Con dominio propio en la raíz, quitar el prefijo `/balatro/` de `vite.config.ts` (`base: '/'`).
- **PWA**: `public/manifest.webmanifest`, `public/icon.svg` y `public/sw.js` (cachea los recursos del mismo origen; se puede instalar y jugar sin conexión). Si se cambia la estrategia de caché, subir `CACHE` en `sw.js`.
- **Analítica**: ninguna por defecto (el juego no envía datos a terceros; partidas, perfil y ajustes viven en `localStorage`). Si se quisiera medir uso, usar una herramienta sin cookies (p. ej. Plausible/Umami autoalojado), anonimizada, con aviso en el menú.

## 3. Modelo de negocio y aspectos legales (decisión del autor)

Opciones y recomendación:

| Opción | Pros | Contras |
|---|---|---|
| **Gratis, proyecto de fans/prototipo** (recomendada para esta fase) | Cero fricción, ideal para feedback; sin riesgo de confundirse con el producto oficial | Sin ingresos |
| Demo gratuita + versión completa de pago | Convierte interés en ingresos | Hace falta pasarela de pago/licencias y soporte |
| De pago directo | Ingresos | Compite con el juego original; exige assets propios revisados |

Puntos a resolver antes de cualquier uso comercial:
- **Marca y nombre** (GDD §17.5): el repo y el título usan «Balatro Web» y «fan port». Antes de publicitarlo o venderlo, el autor debe decidir si es producto oficial (y entonces usar su marca) o proyecto independiente con otro nombre.
- **Assets**: todo el arte y audio actuales son procedurales (generados por código), sin material copiado. Si se incorporan assets del juego original, deben aportarse explícitamente (ver AGENTS.md).
- **Datos del juego** (GDD §17.4): valores y textos están basados en conocimiento público, sin verificar contra la fuente oficial (decisión del autor de no hacerlo).
- **Privacidad**: sin cuentas ni cookies de terceros; solo `localStorage`.

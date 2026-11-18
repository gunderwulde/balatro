import type { Edition } from '../core/jokers';

interface Text { name: string; desc: string }

export const JOKER_TEXT: Record<string, Text> = {
  joker: { name: 'Joker', desc: '+4 Mult' },
  greedy_joker: { name: 'Joker Codicioso', desc: 'Las cartas ♦ que puntúan dan +3 Mult' },
  lusty_joker: { name: 'Joker Lujurioso', desc: 'Las cartas ♥ que puntúan dan +3 Mult' },
  wrathful_joker: { name: 'Joker Iracundo', desc: 'Las cartas ♠ que puntúan dan +3 Mult' },
  gluttonous_joker: { name: 'Joker Glotón', desc: 'Las cartas ♣ que puntúan dan +3 Mult' },
  jolly_joker: { name: 'Joker Alegre', desc: '+8 Mult si la mano contiene una Pareja' },
  zany_joker: { name: 'Joker Chiflado', desc: '+12 Mult si la mano contiene un Trío' },
  mad_joker: { name: 'Joker Loco', desc: '+10 Mult si la mano contiene Doble Pareja' },
  crazy_joker: { name: 'Joker Demente', desc: '+12 Mult si la mano contiene una Escalera' },
  droll_joker: { name: 'Joker Gracioso', desc: '+10 Mult si la mano contiene un Color' },
  sly_joker: { name: 'Joker Astuto', desc: '+50 Fichas si la mano contiene una Pareja' },
  wily_joker: { name: 'Joker Taimado', desc: '+100 Fichas si la mano contiene un Trío' },
  clever_joker: { name: 'Joker Listo', desc: '+80 Fichas si la mano contiene Doble Pareja' },
  devious_joker: { name: 'Joker Pérfido', desc: '+100 Fichas si la mano contiene una Escalera' },
  crafty_joker: { name: 'Joker Ingenioso', desc: '+80 Fichas si la mano contiene un Color' },
  half_joker: { name: 'Medio Joker', desc: '+20 Mult si la mano tiene 3 cartas o menos' },
  banner: { name: 'Estandarte', desc: '+30 Fichas por cada descarte restante' },
  mystic_summit: { name: 'Cima Mística', desc: '+15 Mult cuando no quedan descartes' },
  scary_face: { name: 'Cara Siniestra', desc: 'Las figuras que puntúan dan +30 Fichas' },
  even_steven: { name: 'Steven Par', desc: 'Las cartas pares (10, 8, 6, 4, 2) que puntúan dan +4 Mult' },
  odd_todd: { name: 'Todd Impar', desc: 'Las cartas impares (A, 9, 7, 5, 3) que puntúan dan +31 Fichas' },
  scholar: { name: 'Erudito', desc: 'Los Ases que puntúan dan +20 Fichas y +4 Mult' },
  fibonacci: { name: 'Fibonacci', desc: 'Cada A, 2, 3, 5 u 8 que puntúa da +8 Mult' },
  abstract_joker: { name: 'Joker Abstracto', desc: '+3 Mult por cada Joker que tengas' },
  golden_joker: { name: 'Joker Dorado', desc: 'Ganas $4 al final de la ronda' },
  green_joker: { name: 'Joker Verde', desc: '+1 Mult por mano jugada, −1 por descarte' },
  ride_the_bus: { name: 'Al Autobús', desc: '+1 Mult por mano seguida sin figuras puntuando' },
  supernova: { name: 'Supernova', desc: 'Suma como Mult las veces que has jugado esta mano en la run' },
  photograph: { name: 'Fotografía', desc: 'La primera figura que puntúa da ×2 Mult' },
  the_duo: { name: 'El Dúo', desc: '×2 Mult si la mano contiene una Pareja' },
  the_trio: { name: 'El Trío', desc: '×3 Mult si la mano contiene un Trío' },
  the_family: { name: 'La Familia', desc: '×4 Mult si la mano contiene un Póker' },
  the_order: { name: 'El Orden', desc: '×3 Mult si la mano contiene una Escalera' },
  the_tribe: { name: 'La Tribu', desc: '×2 Mult si la mano contiene un Color' },
  blue_joker: { name: 'Joker Azul', desc: '+2 Fichas por cada carta restante en el mazo' },
  juggler: { name: 'Malabarista', desc: '+1 tamaño de mano' },
  drunkard: { name: 'Borracho', desc: '+1 descarte por ronda' },
  acrobat: { name: 'Acróbata', desc: '×3 Mult en la última mano de la ronda' },
  blackboard: { name: 'Pizarra', desc: '×3 Mult si todas las cartas en mano son ♠ o ♣' },
  baron: { name: 'Barón', desc: 'Cada Rey en tu mano da ×1,5 Mult' },
  triboulet: { name: 'Triboulet', desc: 'Cada Rey o Reina que puntúa da ×2 Mult' },
  chicot: { name: 'Chicot', desc: 'Anula el efecto de todos los Boss Blinds' },
  bull: { name: 'Toro', desc: '+2 Fichas por cada $1 que tengas' },
};

export const PLANET_TEXT: Record<string, string> = {
  pluto: 'Plutón', mercury: 'Mercurio', uranus: 'Urano', venus: 'Venus', saturn: 'Saturno',
  jupiter: 'Júpiter', earth: 'Tierra', mars: 'Marte', neptune: 'Neptuno',
  planet_x: 'Planeta X', ceres: 'Ceres', eris: 'Eris',
};

export const EDITION_TEXT: Record<Edition, { name: string; desc: string }> = {
  foil: { name: 'Holográfica plateada', desc: '+50 Fichas' },
  holo: { name: 'Holográfica', desc: '+10 Mult' },
  poly: { name: 'Policroma', desc: '×1,5 Mult' },
  negative: { name: 'Negativa', desc: '+1 espacio de Joker' },
};


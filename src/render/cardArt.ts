import * as THREE from 'three';
import { rankLabel, type Card, type Suit } from '../core/cards';

/** Arte procedural pixel-art (71x95) generado en canvas. Sin assets externos. */
export const CARD_W = 71;
export const CARD_H = 95;

const PAPER = '#f4efe3';
const SHADE = '#d8d0bd';
const INK = '#1a1a22';
export const SUIT_COLOR: Record<Suit, string> = {
  S: '#2b3a67',
  H: '#e0413a',
  D: '#e8892b',
  C: '#2f7a5b',
};

const SUIT_BITMAP: Record<Suit, string[]> = {
  H: ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'],
  D: ['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'],
  S: ['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', '.XX.X.XX.', '....X....', '...XXX...'],
  C: ['...XXX...', '..XXXXX..', '...XXX...', '.XX.X.XX.', 'XXXXXXXXX', 'XXXXXXXXX', '.XX.X.XX.', '....X....', '...XXX...'],
};

const GLYPH: Record<string, string[]> = {
  '0': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
  'J': ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  'Q': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  'K': ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  'A': ['..X..', '.X.X.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X'],
};

type Ctx = CanvasRenderingContext2D;

function bitmap(ctx: Ctx, rows: string[], x: number, y: number, color: string, scale = 1) {
  ctx.fillStyle = color;
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === 'X') ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }),
  );
}

function text(ctx: Ctx, s: string, x: number, y: number, color: string) {
  let cx = x;
  for (const ch of s) {
    bitmap(ctx, GLYPH[ch], cx, y, color);
    cx += 6;
  }
}

function suit(ctx: Ctx, s: Suit, cx: number, cy: number, scale = 1, flip = false) {
  const bm = SUIT_BITMAP[s];
  const w = bm[0].length * scale;
  const h = bm.length * scale;
  const rows = flip ? [...bm].reverse() : bm;
  bitmap(ctx, rows, Math.round(cx - w / 2), Math.round(cy - h / 2), SUIT_COLOR[s], scale);
}

const L = 24, C = 35, R = 47;
const ROW = [22, 38, 54, 70];
const PIPS: Record<number, [number, number][]> = {
  2: [[C, ROW[0]], [C, ROW[3]]],
  3: [[C, ROW[0]], [C, 46], [C, ROW[3]]],
  4: [[L, ROW[0]], [R, ROW[0]], [L, ROW[3]], [R, ROW[3]]],
  5: [[L, ROW[0]], [R, ROW[0]], [C, 46], [L, ROW[3]], [R, ROW[3]]],
  6: [[L, ROW[0]], [R, ROW[0]], [L, 46], [R, 46], [L, ROW[3]], [R, ROW[3]]],
  7: [[L, ROW[0]], [R, ROW[0]], [C, 34], [L, 46], [R, 46], [L, ROW[3]], [R, ROW[3]]],
  8: [[L, ROW[0]], [R, ROW[0]], [C, 34], [L, 46], [R, 46], [C, 58], [L, ROW[3]], [R, ROW[3]]],
  9: [[L, ROW[0]], [R, ROW[0]], [L, ROW[1] + 2], [R, ROW[1] + 2], [C, 46], [L, ROW[2] - 2], [R, ROW[2] - 2], [L, ROW[3]], [R, ROW[3]]],
  10: [[L, ROW[0]], [R, ROW[0]], [C, 30], [L, ROW[1] + 2], [R, ROW[1] + 2], [L, ROW[2] - 2], [R, ROW[2] - 2], [C, 62], [L, ROW[3]], [R, ROW[3]]],
};

function roundCorners(ctx: Ctx) {
  // Esquinas transparentes estilo pixel-art
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [CARD_W - 1, 0], [CARD_W - 2, 0], [CARD_W - 1, 1],
    [0, CARD_H - 1], [1, CARD_H - 1], [0, CARD_H - 2], [CARD_W - 1, CARD_H - 1], [CARD_W - 2, CARD_H - 1], [CARD_W - 1, CARD_H - 2]])
    ctx.clearRect(x, y, 1, 1);
}

function face(ctx: Ctx, rank: 11 | 12 | 13, s: Suit) {
  const col = SUIT_COLOR[s];
  // marco y fondo
  ctx.fillStyle = SHADE;
  ctx.fillRect(15, 17, 41, 61);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.strokeRect(15.5, 17.5, 40, 60);
  ctx.fillStyle = PAPER;
  ctx.fillRect(16, 18, 39, 59);
  // diagonal que separa las dos mitades (cartas de figura son simétricas)
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) {
      ctx.translate(CARD_W, CARD_H);
      ctx.scale(-1, -1);
    }
    // cuerpo
    ctx.fillStyle = col;
    ctx.fillRect(19, 56, 33, 4);
    ctx.fillRect(21, 52, 29, 4);
    ctx.fillStyle = '#f2c9a0'; // cara
    ctx.fillRect(28, 38, 15, 14);
    ctx.fillStyle = INK; // ojos
    ctx.fillRect(31, 43, 2, 2);
    ctx.fillRect(38, 43, 2, 2);
    ctx.fillRect(33, 48, 5, 1);
    // sombrero / corona
    if (rank === 11) {
      ctx.fillStyle = col;
      ctx.fillRect(27, 34, 17, 5);
      ctx.fillRect(41, 38, 6, 2);
    } else {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(27, 35, 17, 4);
      for (const x of [27, 33, 39, 42]) ctx.fillRect(x, 31, 3, 4);
      ctx.fillStyle = col;
      ctx.fillRect(34, 33, 3, 3);
    }
    if (rank === 12) {
      ctx.fillStyle = '#7a4b22'; // melena
      ctx.fillRect(25, 38, 3, 16);
      ctx.fillRect(43, 38, 3, 16);
    }
    if (rank === 13) {
      ctx.fillStyle = '#7a4b22'; // barba
      ctx.fillRect(28, 49, 15, 5);
      ctx.fillStyle = '#f2c9a0';
      ctx.fillRect(33, 49, 5, 1);
    }
    ctx.restore();
  }
  ctx.fillStyle = PAPER;
  ctx.fillRect(16, 46, 39, 2);
  ctx.fillStyle = INK;
  ctx.fillRect(16, 47, 39, 1);
}

const ENH_PAPER: Partial<Record<NonNullable<Card['enhancement']>, string>> = {
  bonus: '#bcd3f2',
  mult: '#f2bcbc',
  wild: '#e9dcf4',
  glass: '#d4ecf7',
  steel: '#bcc3cf',
  stone: '#8b8b93',
  gold: '#f3d77f',
  lucky: '#c4ebc4',
};

/** Marcas de fondo de cada enhancement (pixel-art simple). */
function enhancementBackdrop(ctx: Ctx, e: NonNullable<Card['enhancement']>) {
  if (e === 'stone') {
    ctx.fillStyle = '#6f6f78';
    for (let i = 0; i < 70; i++) ctx.fillRect(3 + ((i * 37) % 65), 3 + ((i * 53) % 89), 2, 2);
    ctx.fillStyle = '#a4a4ac';
    for (let i = 0; i < 40; i++) ctx.fillRect(4 + ((i * 29) % 63), 4 + ((i * 41) % 87), 1, 1);
  } else if (e === 'wild') {
    const cols = ['#e0413a', '#e8892b', '#f2c230', '#2f7a5b', '#2b3a67'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(2, 2 + i * 3, CARD_W - 4, 2);
      ctx.fillRect(2, CARD_H - 4 - i * 3, CARD_W - 4, 2);
    });
    ctx.globalAlpha = 1;
  } else if (e === 'steel' || e === 'glass') {
    ctx.fillStyle = e === 'steel' ? '#e6eaf2' : '#ffffff';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) ctx.fillRect(6 + i * 11, 2, 3, CARD_H - 4);
    ctx.globalAlpha = 1;
  } else if (e === 'gold') {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(2, 2, CARD_W - 4, 3);
    ctx.fillRect(2, CARD_H - 5, CARD_W - 4, 3);
  } else if (e === 'bonus' || e === 'mult' || e === 'lucky') {
    ctx.fillStyle = e === 'bonus' ? '#3b76d9' : e === 'mult' ? '#d9453f' : '#3aa65a';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(2, 2, CARD_W - 4, 2);
    ctx.fillRect(2, CARD_H - 4, CARD_W - 4, 2);
    ctx.globalAlpha = 1;
  }
}

/** Foil (azul con bandas), Holo (rosa) y Polychrome (arcoíris). */
function editionOverlay(ctx: Ctx, e: NonNullable<Card['edition']>) {
  const w = CARD_W - 2;
  const h = CARD_H - 2;
  if (e === 'foil') {
    ctx.fillStyle = 'rgba(110,170,255,0.28)';
    ctx.fillRect(1, 1, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = -h; i < w; i += 12) for (let k = 0; k < 4; k++) ctx.fillRect(1 + i + k + 0, 1 + ((i + 400) % h), 1, 1);
    for (let y = 0; y < h; y += 2) ctx.fillRect(1 + ((y * 7) % w), 1 + y, 5, 1);
  } else if (e === 'holo') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,90,200,0.35)');
    g.addColorStop(0.5, 'rgba(255,200,240,0.18)');
    g.addColorStop(1, 'rgba(160,90,255,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(1, 1, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let y = 2; y < h; y += 5) ctx.fillRect(1, 1 + y, w, 1);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    ['#ff5a5a', '#ffd25a', '#7aff7a', '#5ac8ff', '#c05aff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.globalAlpha = 0.33;
    ctx.fillStyle = g;
    ctx.fillRect(1, 1, w, h);
    ctx.globalAlpha = 1;
  }
}

const SEAL_COLOR = { gold: '#f2c230', red: '#e0413a', blue: '#3b76d9', purple: '#8e4fd6' } as const;
function sealMark(ctx: Ctx, seal: NonNullable<Card['seal']>) {
  const cx = CARD_W - 12;
  const cy = CARD_H - 14;
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 5, cy - 4, 10, 8);
  ctx.fillRect(cx - 4, cy - 5, 8, 10);
  ctx.fillStyle = SEAL_COLOR[seal];
  ctx.fillRect(cx - 4, cy - 3, 8, 6);
  ctx.fillRect(cx - 3, cy - 4, 6, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(cx - 2, cy - 2, 2, 2);
}

export function cardKey(card: Card): string {
  return `${card.rank}${card.suit}${card.enhancement ?? ''}${card.seal ?? ''}${card.edition ?? ''}`;
}

/** Cara de carta como data URL (para tooltips y packs en el DOM). */
export function cardFaceUrl(card: Card): string {
  return drawCardFace(card).toDataURL();
}

export function drawCardFace(card: Card): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = (card.enhancement && ENH_PAPER[card.enhancement]) || PAPER;
  ctx.fillRect(1, 1, CARD_W - 2, CARD_H - 2);
  if (card.enhancement) enhancementBackdrop(ctx, card.enhancement);

  const col = SUIT_COLOR[card.suit];
  const label = rankLabel(card.rank);
  const lx = label.length === 2 ? 4 : 7;

  if (card.enhancement === 'stone') {
    // Sin rango ni palo: solo la piedra.
  } else {
    if (card.rank >= 11 && card.rank <= 13) face(ctx, card.rank as 11 | 12 | 13, card.suit);
    else if (card.rank === 14) suit(ctx, card.suit, C + 0.5, 47, 3);
    else for (const [x, y] of PIPS[card.rank]) suit(ctx, card.suit, x + 0.5, y, 1, y > 46);

    // índices en esquinas (esquina inferior rotada 180°)
    text(ctx, label, lx, 2, col);
    suit(ctx, card.suit, 9, 16);
    ctx.save();
    ctx.translate(CARD_W, CARD_H);
    ctx.scale(-1, -1);
    text(ctx, label, lx, 2, col);
    suit(ctx, card.suit, 9, 16);
    ctx.restore();
  }

  if (card.edition) editionOverlay(ctx, card.edition);
  if (card.seal) sealMark(ctx, card.seal);
  roundCorners(ctx);
  return cv;
}

export function drawCardBack(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(1, 1, CARD_W - 2, CARD_H - 2);
  ctx.fillStyle = '#b8322f';
  ctx.fillRect(4, 4, CARD_W - 8, CARD_H - 8);
  // retícula de rombos
  ctx.fillStyle = '#8f2422';
  for (let y = 4; y < CARD_H - 4; y++)
    for (let x = 4; x < CARD_W - 4; x++) if (((x + y) % 8 === 0) || ((x - y + 400) % 8 === 0)) ctx.fillRect(x, y, 1, 1);
  // medallón central
  ctx.fillStyle = PAPER;
  ctx.fillRect(25, 35, 21, 25);
  ctx.fillStyle = '#b8322f';
  ctx.fillRect(27, 37, 17, 21);
  suit(ctx, 'S', 35.5, 47.5, 1);
  roundCorners(ctx);
  return cv;
}

const cache = new Map<string, THREE.CanvasTexture>();
function toTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function faceTexture(card: Card): THREE.CanvasTexture {
  const key = cardKey(card);
  let t = cache.get(key);
  if (!t) cache.set(key, (t = toTexture(drawCardFace(card))));
  return t;
}

export function backTexture(): THREE.CanvasTexture {
  let t = cache.get('back');
  if (!t) cache.set('back', (t = toTexture(drawCardBack())));
  return t;
}

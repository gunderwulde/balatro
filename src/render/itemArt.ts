import { hashSeed } from '../core/rng';
import type { Rarity } from '../core/jokers';
import type { ConsumableKind } from '../core/consumables';
import type { PackKind } from '../core/shop';
import { CARD_H, CARD_W } from './cardArt';

/** Arte procedural (pixel-art 71x95) para jokers, planetas, packs y vouchers. */
const INK = '#1a1a22';
const PAPER = '#f4efe3';

const RARITY_BG: Record<Rarity, [string, string]> = {
  common: ['#5b8fd9', '#3b66ad'],
  uncommon: ['#4fae7b', '#2f7a5b'],
  rare: ['#d9605a', '#a23a35'],
  legendary: ['#a56bd9', '#6b3a9e'],
};

const urlCache = new Map<string, string>();

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  return [cv, cv.getContext('2d')!];
}

function frame(ctx: CanvasRenderingContext2D, bg: string, bg2: string) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(1, 1, CARD_W - 2, CARD_H - 2);
  ctx.fillStyle = bg;
  ctx.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  ctx.fillStyle = bg2;
  for (let y = 3; y < CARD_H - 3; y += 4) ctx.fillRect(3, y, CARD_W - 6, 1);
}

function corners(ctx: CanvasRenderingContext2D) {
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [CARD_W - 1, 0], [CARD_W - 2, 0], [CARD_W - 1, 1],
    [0, CARD_H - 1], [1, CARD_H - 1], [0, CARD_H - 2], [CARD_W - 1, CARD_H - 1], [CARD_W - 2, CARD_H - 1], [CARD_W - 1, CARD_H - 2]])
    ctx.clearRect(x, y, 1, 1);
}

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Joker: criatura simétrica generada a partir del id + sombrero de bufón. */
export function jokerArt(id: string, rarity: Rarity): string {
  const key = `j:${id}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas();
  const [bg, bg2] = RARITY_BG[rarity];
  frame(ctx, bg, bg2);

  const rnd = mulberry(hashSeed(id));
  const hue = Math.floor(rnd() * 360);
  const body = `hsl(${hue} 65% 58%)`;
  const dark = `hsl(${hue} 60% 32%)`;
  const hat1 = `hsl(${(hue + 150) % 360} 70% 55%)`;
  const hat2 = `hsl(${(hue + 210) % 360} 70% 50%)`;

  // sprite 9x9 (mitad izquierda aleatoria, espejada)
  const N = 9, S = 5, ox = Math.round((CARD_W - N * S) / 2), oy = 34;
  const grid: boolean[][] = [];
  for (let y = 0; y < N; y++) {
    grid[y] = [];
    for (let x = 0; x < 5; x++) {
      const edge = x === 0 || y === 0 || y === N - 1;
      grid[y][x] = rnd() < (edge ? 0.42 : 0.78) && (y > 0 || x > 1);
    }
    for (let x = 5; x < N; x++) grid[y][x] = grid[y][N - 1 - x];
  }
  // contorno
  ctx.fillStyle = INK;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (grid[y][x]) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillRect(ox + x * S + dx * 2, oy + y * S + dy * 2, S, S);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (grid[y][x]) {
        ctx.fillStyle = y > N / 2 ? dark : body;
        ctx.fillRect(ox + x * S, oy + y * S, S, S);
      }
  // ojos
  ctx.fillStyle = PAPER;
  ctx.fillRect(ox + 2 * S, oy + 3 * S, S, S);
  ctx.fillRect(ox + 6 * S, oy + 3 * S, S, S);
  ctx.fillStyle = INK;
  ctx.fillRect(ox + 2 * S + 2, oy + 3 * S + 2, 3, 3);
  ctx.fillRect(ox + 6 * S + 2, oy + 3 * S + 2, 3, 3);

  // sombrero de bufón con cascabeles
  const cx = CARD_W / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 21, 22, 42, 12);
  ctx.fillRect(cx - 26, 14, 10, 12);
  ctx.fillRect(cx + 16, 14, 10, 12);
  ctx.fillRect(cx - 5, 8, 10, 16);
  ctx.fillStyle = hat1;
  ctx.fillRect(cx - 19, 24, 38, 8);
  ctx.fillRect(cx - 24, 16, 6, 9);
  ctx.fillRect(cx + 18, 16, 6, 9);
  ctx.fillRect(cx - 3, 10, 6, 13);
  ctx.fillStyle = hat2;
  ctx.fillRect(cx - 19, 28, 38, 4);
  ctx.fillStyle = '#ffd45e';
  for (const x of [cx - 25, cx + 21, cx - 2]) ctx.fillRect(x, x === cx - 2 ? 6 : 13, 3, 3);

  // gema de rareza en la esquina inferior
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 6, 84, 12, 6);
  ctx.fillStyle = rarity === 'rare' ? '#ff6b64' : rarity === 'uncommon' ? '#7ee0a8' : '#9cc4ff';
  ctx.fillRect(cx - 4, 85, 8, 4);

  corners(ctx);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Planeta con anillo sobre fondo estrellado. */
export function planetArt(id: string): string {
  const key = `p:${id}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas();
  frame(ctx, '#1d2447', '#232b55');
  const rnd = mulberry(hashSeed('planet' + id));
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 28; i++) ctx.fillRect(5 + Math.floor(rnd() * (CARD_W - 10)), 5 + Math.floor(rnd() * (CARD_H - 10)), 1, 1);

  const hue = Math.floor(rnd() * 360);
  const cx = 35, cy = 46, r = 16 + Math.floor(rnd() * 4);
  const ring = rnd() < 0.6;
  const drawRing = (front: boolean) => {
    if (!ring) return;
    ctx.fillStyle = front ? '#e9d9a6' : '#a9966a';
    for (let a = 0; a < Math.PI; a += 0.02) {
      const ang = front ? a : a + Math.PI;
      const x = Math.round(cx + Math.cos(ang) * (r + 10));
      const y = Math.round(cy + Math.sin(ang) * 6 - Math.cos(ang) * 4);
      ctx.fillRect(x, y, 2, 2);
    }
  };
  drawRing(false);
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r) continue;
      const edge = d > r - 1.5;
      const light = (x * -0.5 + y * -0.5) / r; // luz arriba-izquierda
      const band = Math.sin(y * 0.55 + rnd() * 0.5) > 0.35 ? 8 : 0;
      const l = 38 + light * 18 + band;
      ctx.fillStyle = edge ? INK : `hsl(${hue} 55% ${Math.max(14, Math.min(80, l))}%)`;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  drawRing(true);
  corners(ctx);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Sobre de refuerzo. */
export function packArt(kind: PackKind): string {
  const key = `k:${kind}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas();
  const [a, b] = PACK_COLORS[kind];
  frame(ctx, a, b);
  ctx.fillStyle = INK;
  ctx.fillRect(3, 3, CARD_W - 6, 8);
  ctx.fillRect(3, CARD_H - 11, CARD_W - 6, 8);
  ctx.fillStyle = '#ffd45e';
  for (let x = 6; x < CARD_W - 6; x += 6) {
    ctx.fillRect(x, 5, 3, 4);
    ctx.fillRect(x, CARD_H - 9, 3, 4);
  }
  // emblema
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(35.5, 47, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(35.5, 47, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = a;
  if (kind === 'celestial') {
    for (const [x, y] of [[35, 38], [34, 39], [36, 39], [33, 40], [37, 40], [35, 56], [34, 55], [36, 55]]) ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(30, 44, 11, 7);
    ctx.fillStyle = '#ffd45e';
    ctx.fillRect(28, 47, 15, 2);
  } else if (kind === 'buffoon') {
    ctx.fillRect(28, 40, 15, 4);
    ctx.fillRect(31, 36, 9, 5);
    ctx.fillStyle = INK;
    ctx.fillRect(31, 47, 3, 3);
    ctx.fillRect(38, 47, 3, 3);
    ctx.fillRect(32, 53, 8, 2);
  } else if (kind === 'arcana') {
    // ojo
    ctx.fillRect(26, 44, 19, 6);
    ctx.fillStyle = PAPER;
    ctx.fillRect(31, 45, 9, 4);
    ctx.fillStyle = INK;
    ctx.fillRect(34, 44, 3, 6);
  } else if (kind === 'spectral') {
    // fantasma
    ctx.fillRect(29, 38, 13, 16);
    ctx.fillRect(27, 42, 17, 12);
    ctx.fillStyle = PAPER;
    ctx.fillRect(32, 43, 2, 3);
    ctx.fillRect(38, 43, 2, 3);
    ctx.fillRect(29, 52, 3, 2);
    ctx.fillRect(34, 52, 3, 2);
    ctx.fillRect(39, 52, 3, 2);
  } else {
    // carta estándar con pica
    ctx.fillRect(28, 38, 15, 19);
    ctx.fillStyle = PAPER;
    ctx.fillRect(34, 42, 3, 3);
    ctx.fillRect(32, 45, 7, 4);
    ctx.fillRect(34, 49, 3, 4);
  }
  corners(ctx);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Voucher: ticket dorado. */
export function voucherArt(id: string): string {
  const key = `v:${id}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas();
  frame(ctx, '#e5b73b', '#c9982a');
  ctx.fillStyle = INK;
  ctx.fillRect(10, 20, CARD_W - 20, CARD_H - 40);
  ctx.fillStyle = PAPER;
  ctx.fillRect(12, 22, CARD_W - 24, CARD_H - 44);
  const rnd = mulberry(hashSeed(id));
  ctx.fillStyle = INK;
  ctx.fillRect(18, 30, CARD_W - 36, 3);
  ctx.fillRect(18, 37, CARD_W - 50, 3);
  ctx.fillStyle = `hsl(${Math.floor(rnd() * 360)} 65% 50%)`;
  ctx.fillRect(24, 46, 23, 20);
  ctx.fillStyle = INK;
  ctx.fillRect(18, 71, CARD_W - 36, 2);
  corners(ctx);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

const PACK_COLORS: Record<PackKind, [string, string]> = {
  arcana: ['#7a4cb5', '#573680'],
  celestial: ['#3a4a9b', '#2a3470'],
  spectral: ['#2f9c97', '#1f6e6a'],
  standard: ['#b8322f', '#8f2422'],
  buffoon: ['#c9553b', '#8f3724'],
};

/** Tarot (púrpura con símbolo) o Spectral (turquesa con espectro); los Planetas reutilizan `planetArt`. */
export function consumableArt(id: string, kind: ConsumableKind): string {
  if (kind === 'planet') return planetArt(id);
  const key = `c:${id}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas();
  const spectral = kind === 'spectral';
  frame(ctx, spectral ? '#3aa6a0' : '#8a5ac8', spectral ? '#2a817c' : '#6a3fa0');
  const rnd = mulberry(hashSeed('cons' + id));
  // marco interior
  ctx.fillStyle = INK;
  ctx.fillRect(8, 8, CARD_W - 16, CARD_H - 16);
  ctx.fillStyle = spectral ? '#16393a' : '#2a1647';
  ctx.fillRect(9, 9, CARD_W - 18, CARD_H - 18);
  // símbolo generado: simétrico en horizontal
  const hue = Math.floor(rnd() * 360);
  const half = 11;
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < half; x++) {
      const d = Math.hypot(x, y - 12) / 12;
      if (rnd() < 0.62 - d * 0.5) {
        ctx.fillStyle = `hsl(${hue} 70% ${45 + Math.floor(rnd() * 25)}%)`;
        ctx.fillRect(35 + x, 34 + y, 1, 1);
        ctx.fillRect(34 - x, 34 + y, 1, 1);
      }
    }
  }
  ctx.fillStyle = spectral ? '#bff4ef' : '#f2c230';
  ctx.fillRect(13, 13, CARD_W - 26, 2);
  ctx.fillRect(13, CARD_H - 15, CARD_W - 26, 2);
  corners(ctx);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** Ficha circular 34x34 para Tags y Boss Blinds. */
export function chipArt(id: string, kind: 'tag' | 'boss'): string {
  const key = `t:${kind}:${id}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 34;
  cv.height = 34;
  const ctx = cv.getContext('2d')!;
  const rnd = mulberry(hashSeed(kind + id));
  const hue = Math.floor(rnd() * 360);
  const r = 16;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r) continue;
      ctx.fillStyle = d > r - 1.5 ? INK : d > r - 4 ? PAPER : `hsl(${hue} ${kind === 'boss' ? 45 : 65}% ${kind === 'boss' ? 38 : 55}%)`;
      ctx.fillRect(17 + x, 17 + y, 1, 1);
    }
  ctx.fillStyle = INK;
  for (let i = 0; i < 9; i++) {
    const x = 11 + Math.floor(rnd() * 6);
    const y = 11 + Math.floor(rnd() * 12);
    ctx.fillRect(x, y, 2, 2);
    ctx.fillRect(33 - x - 1, y, 2, 2);
  }
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

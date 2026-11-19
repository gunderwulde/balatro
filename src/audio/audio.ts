/** Audio procedural con WebAudio (sin assets): SFX y música de fondo generativa. */

export type Sfx = 'click' | 'select' | 'deselect' | 'play' | 'discard' | 'chips' | 'mult' | 'xmult' | 'money' | 'buy' | 'win' | 'lose' | 'error';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let vol = { music: 0.7, sfx: 0.8 };
let musicTimer = 0;
let step = 0;
let wanted = false;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.connect(master);
  musicGain = ctx.createGain();
  musicGain.connect(master);
  applyVolumes();
  return ctx;
}

function applyVolumes() {
  if (sfxGain) sfxGain.gain.value = vol.sfx;
  if (musicGain) musicGain.gain.value = vol.music * 0.35;
}

export function setVolumes(music: number, sfxVol: number): void {
  vol = { music, sfx: sfxVol };
  applyVolumes();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number, out?: GainNode | null) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out ?? sfxGain!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, when = 0, out?: GainNode | null) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  const g = c.createGain();
  g.gain.value = gain;
  s.connect(f).connect(g).connect(out ?? sfxGain!);
  s.start(t);
}

/** Reproduce un efecto. `n` (0..) sube el tono en secuencias (chips/mult en cadena). */
export function sfx(name: Sfx, n = 0): void {
  if (vol.sfx <= 0 || !ensure()) return;
  if (ctx!.state === 'suspended') void ctx!.resume();
  const up = 1 + Math.min(n, 12) * 0.06;
  switch (name) {
    case 'click': tone(520, 0.05, 'square', 0.12); break;
    case 'select': tone(440, 0.07, 'square', 0.14); tone(660, 0.07, 'square', 0.1, 0.04); break;
    case 'deselect': tone(330, 0.07, 'square', 0.12); break;
    case 'play': noise(0.18, 0.4); tone(200, 0.18, 'triangle', 0.25, 0, 90); break;
    case 'discard': noise(0.12, 0.3); break;
    case 'chips': tone(660 * up, 0.09, 'square', 0.14); break;
    case 'mult': tone(330 * up, 0.12, 'sawtooth', 0.13); break;
    case 'xmult': tone(220, 0.35, 'sawtooth', 0.2, 0, 440); tone(330, 0.35, 'square', 0.1, 0.03, 660); break;
    case 'money': tone(988, 0.07, 'square', 0.13); tone(1319, 0.14, 'square', 0.13, 0.07); break;
    case 'buy': tone(784, 0.08, 'square', 0.14); tone(1047, 0.08, 'square', 0.14, 0.07); tone(1568, 0.18, 'square', 0.14, 0.14); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.15, i * 0.1)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.16)); break;
    case 'error': tone(160, 0.18, 'sawtooth', 0.16); break;
  }
}

// ---- música generativa: pentatónica menor con bajo y arpegio
const SCALE = [0, 3, 5, 7, 10];
const ROOTS = [110, 110, 131, 98];

function musicStep() {
  if (!ensure() || !musicGain) return;
  const bar = Math.floor(step / 16) % ROOTS.length;
  const root = ROOTS[bar];
  const i = step % 16;
  if (i % 4 === 0) tone(root, 0.45, 'triangle', 0.5, 0, undefined, musicGain);
  if (i % 2 === 0) {
    const deg = SCALE[(i * 3 + bar * 2) % SCALE.length];
    tone(root * 4 * 2 ** (deg / 12), 0.22, 'square', 0.12, 0, undefined, musicGain);
  }
  if (i === 8 || i === 14) noise(0.04, 0.05, 0, musicGain);
  step++;
}

export function startMusic(): void {
  wanted = true;
  if (musicTimer) return;
  // El navegador bloquea el audio hasta un gesto: se arranca en la primera interacción.
  if (!ctx || ctx.state === 'suspended') return;
  musicTimer = window.setInterval(musicStep, 230);
}

/** Crea el contexto y arranca la música en la primera interacción del usuario. */
export function unlockOnGesture(): void {
  const go = () => {
    removeEventListener('pointerdown', go);
    removeEventListener('keydown', go);
    if (!ensure()) return;
    void ctx!.resume().then(() => {
      if (wanted && !musicTimer) musicTimer = window.setInterval(musicStep, 230);
    });
  };
  addEventListener('pointerdown', go);
  addEventListener('keydown', go);
}

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  scanlines: boolean;
  reduceMotion: boolean;
}

const KEY = 'balatro-web:settings';
const DEFAULTS: Settings = { music: 0.7, sfx: 0.8, scanlines: true, reduceMotion: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* sin almacenamiento disponible */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignorar */
  }
}

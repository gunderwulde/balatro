import { emptyProfile, type Profile } from '../core/profile';
import type { RunSave } from '../core/run';

const PROFILE_KEY = 'balatro.profile.v1';
const SAVE_KEY = 'balatro.run.v1';

/** localStorage puede faltar o fallar (modo privado, cuota…): todo va con try/catch. */
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin persistencia */
  }
}

export function loadProfile(): Profile {
  const p = read<Profile>(PROFILE_KEY);
  return p && p.v === 1 ? { ...emptyProfile(), ...p } : emptyProfile();
}

export function saveProfile(p: Profile): void {
  write(PROFILE_KEY, p);
}

export function loadRunSave(): RunSave | null {
  const s = read<RunSave>(SAVE_KEY);
  return s && s.v === 1 ? s : null;
}

export function saveRun(s: RunSave): void {
  write(SAVE_KEY, s);
}

export function clearRunSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nada */
  }
}

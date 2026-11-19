import * as c1 from './content.es';
import * as c2 from './content2.es';
import * as base from './es';
import { EN as EN1 } from './content.en';
import { EN as EN2 } from './content2.en';
import { UI_EN } from './ui.en';

export type Lang = 'es' | 'en';

/** Objetos de texto que se intercambian al cambiar de idioma (nombre de export → objeto). */
const REGISTRY: Record<string, Record<string, unknown>> = {
  ...(c1 as unknown as Record<string, Record<string, unknown>>),
  ...(c2 as unknown as Record<string, Record<string, unknown>>),
  ...(base as unknown as Record<string, Record<string, unknown>>),
};

let lang: Lang = 'es';
const originals: Record<string, Record<string, unknown>> = {};
const enLoaded: Record<string, Record<string, unknown>> = { ...EN1, ...EN2 };

export function getLang(): Lang {
  return lang;
}

/** Idioma por defecto según el navegador. */
export function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Cambia el idioma: sustituye in situ el contenido de los objetos de texto y fija el de `t()`. */
export function setLang(next: Lang): void {
  lang = next;
  for (const [name, obj] of Object.entries(REGISTRY)) {
    if (typeof obj !== 'object' || obj === null) continue;
    originals[name] ??= JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
    const src = next === 'en' ? enLoaded[name] : originals[name];
    if (src) Object.assign(obj, src);
    else if (next === 'es') Object.assign(obj, originals[name]);
  }
}

/** Traduce un literal de la UI (la clave es el texto en español; `{0}`, `{1}`… se sustituyen por `vars`). */
export function t(es: string, ...vars: (string | number)[]): string {
  const base = lang === 'en' ? (UI_EN[es] ?? es) : es;
  return vars.length ? base.replace(/\{(\d+)\}/g, (_m: string, i: string) => String(vars[Number(i)] ?? '')) : base;
}

/** Formato numérico según el idioma. */
export function fmtNum(n: number): string {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES');
}

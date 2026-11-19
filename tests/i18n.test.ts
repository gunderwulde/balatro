import { afterEach, describe, expect, it } from 'vitest';
import { setLang, t } from '../src/i18n';
import * as c1 from '../src/i18n/content.es';
import * as c2 from '../src/i18n/content2.es';
import * as base from '../src/i18n/es';
import { EN as EN1 } from '../src/i18n/content.en';
import { EN as EN2 } from '../src/i18n/content2.en';

const ES = { ...c1, ...c2, ...base } as unknown as Record<string, Record<string, unknown>>;
const EN = { ...EN1, ...EN2 };

afterEach(() => setLang('es'));

describe('i18n', () => {
  it('cada texto español tiene su traducción inglesa con las mismas claves', () => {
    const missing: string[] = [];
    for (const [name, obj] of Object.entries(ES)) {
      if (typeof obj !== 'object') continue;
      const en = EN[name];
      if (!en) { missing.push(name); continue; }
      for (const k of Object.keys(obj)) if (!(k in en)) missing.push(`${name}.${k}`);
    }
    expect(missing).toEqual([]);
  });

  it('las traducciones conservan los números de las descripciones', () => {
    const bad: string[] = [];
    const nums = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
    for (const name of ['JOKER_TEXT', 'TAROT_TEXT', 'SPECTRAL_TEXT', 'TAG_TEXT', 'VOUCHER_TEXT', 'BOSS_TEXT']) {
      const es = ES[name] as Record<string, { desc: string }>;
      const en = EN[name] as Record<string, { desc: string }>;
      for (const k of Object.keys(es)) if (nums(es[k].desc.replace(/,/g, '.')) !== nums(en[k].desc)) bad.push(`${name}.${k}`);
    }
    // Informativo: debe ser una fracción pequeña (reformulaciones legítimas de «1/4», «×0,5»…).
    expect(bad.length).toBeLessThan(25);
  });

  it('setLang cambia los textos y vuelve al español', () => {
    const es = (c1.JOKER_TEXT as Record<string, { name: string }>).joker.name;
    setLang('en');
    expect((c1.JOKER_TEXT as Record<string, { name: string }>).greedy_joker.name).toBe('Greedy Joker');
    expect(t('Jugar mano')).toBe('Play hand');
    expect(t('Elige {0} de {1} {2}', 1, 3, 'Tarots')).toBe('Choose 1 of 3 Tarots');
    setLang('es');
    expect((c1.JOKER_TEXT as Record<string, { name: string }>).joker.name).toBe(es);
    expect(t('Jugar mano')).toBe('Jugar mano');
  });
});

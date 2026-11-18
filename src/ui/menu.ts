import { loadSettings, saveSettings, type Settings } from './settings';

type Screen = 'main' | 'play' | 'options' | 'collection';

export interface MenuCallbacks {
  onStart(seed: string): void;
  onSettings(s: Settings): void;
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeed(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}

/** Menú principal en DOM (se superpone al canvas). */
export class MainMenu {
  readonly root = document.createElement('div');
  private settings = loadSettings();
  private screen: Screen = 'main';

  constructor(private cb: MenuCallbacks) {
    this.root.className = 'menu';
    document.body.appendChild(this.root);
    this.cb.onSettings(this.settings);
    this.render();
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.go('main');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get reduceMotion(): boolean {
    return this.settings.reduceMotion;
  }

  private go(s: Screen) {
    this.screen = s;
    this.render();
  }

  private render() {
    const title = [...'BALATRO']
      .map((ch, i) => `<span style="animation-delay:${i * 0.12}s">${ch}</span>`)
      .join('');
    let body = '';
    if (this.screen === 'main') {
      body = `
        <button class="btn btn-blue" data-act="play">Jugar</button>
        <button class="btn btn-orange" data-act="collection">Colección</button>
        <button class="btn btn-red" data-act="options">Opciones</button>`;
    } else if (this.screen === 'play') {
      body = `
        <div class="panel">
          <label class="field">Semilla <small>(vacío = aleatoria)</small>
            <input id="seed" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ABCD1234" />
          </label>
          <div class="row">
            <button class="btn btn-red" data-act="back">Atrás</button>
            <button class="btn btn-blue" data-act="start">Empezar</button>
          </div>
        </div>`;
    } else if (this.screen === 'options') {
      const s = this.settings;
      body = `
        <div class="panel">
          <label class="field">Música <input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" data-set="music" /></label>
          <label class="field">Efectos <input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" data-set="sfx" /></label>
          <label class="check"><input type="checkbox" data-set="scanlines" ${s.scanlines ? 'checked' : ''} /> Filtro CRT (curvatura y scanlines)</label>
          <label class="check"><input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''} /> Reducir movimiento</label>
          <div class="row"><button class="btn btn-red" data-act="back">Atrás</button></div>
        </div>`;
    } else {
      body = `
        <div class="panel">
          <p class="muted">La colección de jokers y cartas llegará en una fase posterior.</p>
          <div class="row"><button class="btn btn-red" data-act="back">Atrás</button></div>
        </div>`;
    }
    this.root.innerHTML = `
      <h1 class="logo">${title}</h1>
      <div class="menu-body">${body}</div>
      <div class="version">v0.0.1 · fan port</div>`;
    this.bind();
  }

  private bind() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.onclick = () => {
        switch (b.dataset.act) {
          case 'play': return this.go('play');
          case 'collection': return this.go('collection');
          case 'options': return this.go('options');
          case 'back': return this.go('main');
          case 'start': {
            const v = (this.root.querySelector<HTMLInputElement>('#seed')!.value || '').toUpperCase().trim();
            return this.cb.onStart(v || randomSeed());
          }
        }
      };
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-set]').forEach((el) => {
      el.oninput = () => {
        const key = el.dataset.set as keyof Settings;
        if (el.type === 'checkbox') (this.settings[key] as boolean) = el.checked;
        else (this.settings[key] as number) = Number(el.value) / 100;
        saveSettings(this.settings);
        this.cb.onSettings(this.settings);
      };
    });
    const seed = this.root.querySelector<HTMLInputElement>('#seed');
    if (seed) {
      seed.focus();
      seed.onkeydown = (e) => {
        if (e.key === 'Enter') this.root.querySelector<HTMLButtonElement>('[data-act="start"]')!.click();
      };
    }
  }
}

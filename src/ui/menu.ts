import { CONSUMABLE_LIST } from '../core/consumables';
import { DECK_IDS, DEFAULT_DECK } from '../core/decks';
import { JOKER_LIST } from '../core/jokers';
import { unlockedStake } from '../core/profile';
import { MAX_STAKE, STAKE_IDS } from '../core/stakes';
import { JOKER_TEXT, PLANET_TEXT } from '../i18n/content.es';
import { DECK_TEXT, SPECTRAL_TEXT, STAKE_TEXT, TAROT_TEXT } from '../i18n/content2.es';
import { consumableArt, jokerArt } from '../render/itemArt';
import { loadSettings, saveSettings, type Settings } from './settings';
import { loadProfile, loadRunSave } from './storage';

type Screen = 'main' | 'play' | 'options' | 'collection';

export interface MenuCallbacks {
  onStart(seed: string, deck: string, stake: number): void;
  onContinue(): void;
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
  private profile = loadProfile();
  private hasSave = loadRunSave() !== null;
  private deck: string = DEFAULT_DECK;
  private stake = 1;
  private seedText = '';

  constructor(private cb: MenuCallbacks) {
    this.root.className = 'menu';
    document.body.appendChild(this.root);
    this.cb.onSettings(this.settings);
    this.render();
  }

  show(): void {
    this.profile = loadProfile();
    this.hasSave = loadRunSave() !== null;
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

  private playHtml(): string {
    const max = unlockedStake(this.profile, this.deck);
    const decks = DECK_IDS.map(
      (d) =>
        `<button class="deck-btn ${d === this.deck ? 'on' : ''}" data-deck="${d}" title="${DECK_TEXT[d].name}">${DECK_TEXT[d].name.replace('Mazo ', '')}</button>`,
    ).join('');
    const stakes = STAKE_IDS.map(
      (id, i) =>
        `<button class="deck-btn ${i + 1 === this.stake ? 'on' : ''}" data-stake="${i + 1}" ${i + 1 > max ? 'disabled' : ''} title="${STAKE_TEXT[id].name}">${i + 1}</button>`,
    ).join('');
    const st = STAKE_TEXT[STAKE_IDS[this.stake - 1]];
    return `
        <div class="panel play-panel">
          <div class="deck-grid">${decks}</div>
          <p class="muted"><b>${DECK_TEXT[this.deck].name}</b> · ${DECK_TEXT[this.deck].desc}</p>
          <div class="stake-row">${stakes}</div>
          <p class="muted"><b>Stake ${st.name}</b> · ${st.desc}${this.stake > 1 ? ' (incluye los anteriores)' : ''}</p>
          <label class="field">Semilla <small>(vacío = aleatoria)</small>
            <input id="seed" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ABCD1234" value="${this.seedText}" />
          </label>
          <div class="row">
            <button class="btn btn-red" data-act="back">Atrás</button>
            <button class="btn btn-blue" data-act="start">Empezar</button>
          </div>
        </div>`;
  }

  private collectionHtml(): string {
    const p = this.profile;
    const have = new Set(p.discovered);
    const cell = (id: string, name: string, img: string) =>
      have.has(id)
        ? `<span class="coll-item" title="${name}"><img src="${img}" alt="${name}"/></span>`
        : '<span class="coll-item unk" title="???">?</span>';
    const jokers = JOKER_LIST.map((d) => cell(d.id, JOKER_TEXT[d.id]?.name ?? d.id, jokerArt(d.id, d.rarity))).join('');
    const cons = CONSUMABLE_LIST.map((c) => {
      const name =
        c.kind === 'tarot' ? TAROT_TEXT[c.id]?.name : c.kind === 'spectral' ? SPECTRAL_TEXT[c.id]?.name : PLANET_TEXT[c.id];
      return cell(c.id, name ?? c.id, consumableArt(c.id, c.kind));
    }).join('');
    const found = (ids: string[]) => ids.filter((i) => have.has(i)).length;
    const wins = Object.entries(p.stakeWins)
      .map(([d, s]) => `${DECK_TEXT[d]?.name ?? d}: Stake ${Math.min(s, MAX_STAKE)}`)
      .join(' · ');
    return `
          <div class="stats">
            <div>Partidas: <b>${p.runs}</b> · Victorias: <b>${p.wins}</b></div>
            <div>Mejor Ante: <b>${p.bestAnte}</b> · Mejor mano: <b>${p.bestHand.toLocaleString('es-ES')}</b></div>
            ${wins ? `<p class="muted">Stakes ganados: ${wins}</p>` : ''}
          </div>
          <h3 class="coll-title">Jokers ${found(JOKER_LIST.map((d) => d.id))}/${JOKER_LIST.length}</h3>
          <div class="coll-grid">${jokers}</div>
          <h3 class="coll-title">Consumibles ${found(CONSUMABLE_LIST.map((c) => c.id))}/${CONSUMABLE_LIST.length}</h3>
          <div class="coll-grid">${cons}</div>`;
  }

  private render() {
    const title = [...'BALATRO']
      .map((ch, i) => `<span style="animation-delay:${i * 0.12}s">${ch}</span>`)
      .join('');
    let body = '';
    if (this.screen === 'main') {
      body = `
        ${this.hasSave ? '<button class="btn btn-orange" data-act="continue">Continuar</button>' : ''}
        <button class="btn btn-blue" data-act="play">${this.hasSave ? 'Nueva run' : 'Jugar'}</button>
        <button class="btn btn-orange" data-act="collection">Colección</button>
        <button class="btn btn-red" data-act="options">Opciones</button>`;
    } else if (this.screen === 'play') {
      body = this.playHtml();
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
        <div class="panel play-panel">
          ${this.collectionHtml()}
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
          case 'continue': return this.cb.onContinue();
          case 'collection': return this.go('collection');
          case 'options': return this.go('options');
          case 'back': return this.go('main');
          case 'start': {
            const v = (this.root.querySelector<HTMLInputElement>('#seed')!.value || '').toUpperCase().trim();
            return this.cb.onStart(v || randomSeed(), this.deck, this.stake);
          }
        }
      };
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-deck]').forEach((b) => {
      b.onclick = () => {
        this.keepSeed();
        this.deck = b.dataset.deck!;
        this.stake = Math.min(this.stake, unlockedStake(this.profile, this.deck));
        this.render();
      };
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-stake]').forEach((b) => {
      b.onclick = () => {
        this.keepSeed();
        this.stake = Number(b.dataset.stake);
        this.render();
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
      seed.onkeydown = (e) => {
        if (e.key === 'Enter') this.root.querySelector<HTMLButtonElement>('[data-act="start"]')!.click();
      };
    }
  }

  private keepSeed() {
    const el = this.root.querySelector<HTMLInputElement>('#seed');
    if (el) this.seedText = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
}

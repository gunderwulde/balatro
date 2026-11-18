import type { HandType } from '../core/hands';
import { JOKERS, sellValue, type JokerInstance, type Rarity } from '../core/jokers';
import { PLANET_BY_ID } from '../core/planets';
import { BLIND_REWARD, BLINDS, blindTarget, MAX_ANTE, type Run } from '../core/run';
import { handStats, type ScoreEvent, type ScoreResult } from '../core/scoring';
import { VOUCHER_COST, type ShopItem } from '../core/shop';
import { EDITION_TEXT, JOKER_TEXT, PACK_TEXT, PLANET_TEXT, VOUCHER_TEXT } from '../i18n/content.es';
import { BLIND_NAME, HAND_NAME } from '../i18n/es';
import { jokerArt, packArt, planetArt, voucherArt } from '../render/itemArt';
import type { Table } from '../render/table';

const RARITY_NAME: Record<Rarity, string> = { common: 'Común', uncommon: 'Poco común', rare: 'Rara' };
const HAND_ORDER: HandType[] = [
  'flush_five', 'flush_house', 'five_kind', 'straight_flush', 'four_kind', 'full_house',
  'flush', 'straight', 'three_kind', 'two_pair', 'pair', 'high_card',
];
const SECRET: HandType[] = ['five_kind', 'flush_house', 'flush_five'];

const fmt = (n: number) => n.toLocaleString('es-ES');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** HUD y pantallas de la run (selección de ciega, jokers, tienda, cashout, fin) en DOM. */
export class GameUI {
  private root = document.createElement('div');
  private busy = false;
  private disposed = false;
  private shownScore = 0;
  private scoreAnim = 0;
  private selJoker: number | null = null;
  private showHands = false;

  constructor(
    private run: Run,
    private table: Table,
    private cb: { onExit(): void; onRestart(): void },
  ) {
    this.root.className = 'game-ui';
    document.body.appendChild(this.root);
    this.table.onSelectionChange = () => this.updatePreview();
    this.refresh();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.scoreAnim);
    this.root.remove();
  }

  // ---------------------------------------------------------------- render

  /** Reconstruye la UI según la fase de la run. */
  refresh(): void {
    const r = this.run;
    this.shownScore = r.score;
    if (this.selJoker !== null && !r.jokers.some((j) => j.uid === this.selJoker)) this.selJoker = null;
    this.table.enabled = r.phase === 'playing' && !this.busy && !this.showHands;
    this.table.setVisible(r.phase === 'playing');

    let overlay = '';
    if (r.phase === 'blind_select') overlay = this.blindSelectHtml();
    else if (r.phase === 'cashout') overlay = this.cashoutHtml();
    else if (r.phase === 'shop') overlay = r.openPack ? this.packHtml() : this.shopHtml();
    else if (r.phase === 'won' || r.phase === 'lost') overlay = this.endHtml();
    const ended = r.phase === 'won' || r.phase === 'lost';

    this.root.innerHTML = `
      ${this.sideHtml()}
      ${ended ? '' : this.jokersHtml()}
      ${r.phase === 'playing' ? this.actionsHtml() : ''}
      ${overlay}
      ${this.showHands ? this.handsHtml() : ''}`;
    this.bind();
    this.updatePreview();
  }

  private sideHtml(): string {
    const r = this.run;
    const inBlind = r.phase === 'playing';
    return `
    <aside class="side">
      <div class="side-top">
        <button class="table-back" data-act="exit">☰ Menú</button>
        <button class="table-back info" data-act="hands">Manos</button>
      </div>
      <div class="blind-card blind-${r.blind}">
        <div class="blind-name">${BLIND_NAME[r.blind]}</div>
        <div class="stat-line">Objetivo <b>${fmt(r.target)}</b></div>
      </div>
      <div class="stat-box">Puntos de la ronda<b id="round-score">${fmt(inBlind ? r.score : 0)}</b></div>
      <div class="stat-box preview"><span id="pv-name">&nbsp;</span>
        <div class="pv-nums"><span class="chips" id="pv-chips">0</span><i>×</i><span class="mult" id="pv-mult">0</span></div>
      </div>
      <div class="stat-row">
        <div class="stat-box blue">Manos<b id="hands-left">${r.handsLeft}</b></div>
        <div class="stat-box red">Descartes<b id="discards-left">${r.discardsLeft}</b></div>
      </div>
      <div class="stat-box gold">Dinero<b id="money">$${r.money}</b></div>
      <div class="stat-row">
        <div class="stat-box">Ante<b>${r.ante}/${MAX_ANTE}</b></div>
        <div class="stat-box">Mazo<b id="deck-left">${r.drawPile.length}/${r.fullDeck.length}</b></div>
      </div>
    </aside>`;
  }

  private jokersHtml(): string {
    const r = this.run;
    const cards = r.jokers.map((j, i) => this.jokerCard(j, i)).join('');
    const sel = r.jokers.find((j) => j.uid === this.selJoker);
    return `
    <div class="jokers-bar">
      <div class="jokers-head"><span>Jokers ${r.jokers.length}/${r.jokerSlots}</span>
        ${sel ? `<button class="mini-btn" data-act="sell" data-uid="${sel.uid}">Vender +$${sellValue(sel)}</button>` : '<small>Arrastra para reordenar · el orden importa</small>'}
      </div>
      <div class="jokers-row">${cards || '<div class="empty-slot">Sin jokers</div>'}</div>
    </div>`;
  }

  private jokerCard(j: JokerInstance, index: number): string {
    const def = JOKERS[j.id];
    const text = JOKER_TEXT[j.id];
    const extra = j.state.mult !== undefined ? `<p class="cur">Actual: +${j.state.mult} Mult</p>` : '';
    const ed = j.edition ? `<p class="ed">${EDITION_TEXT[j.edition].name}: ${EDITION_TEXT[j.edition].desc}</p>` : '';
    const tip = `<b>${text.name}</b><span class="rar r-${def.rarity}">${RARITY_NAME[def.rarity]}</span><p>${text.desc}</p>${extra}${ed}<p class="sell">Venta: $${sellValue(j)}</p>`;
    return `<div class="icard joker ${j.edition ? 'ed-' + j.edition : ''} ${this.selJoker === j.uid ? 'sel' : ''}"
        draggable="true" data-uid="${j.uid}" data-index="${index}" data-act="joker">
        <img src="${jokerArt(j.id, def.rarity)}" alt="${text.name}" draggable="false"/><i class="fx"></i>
        <div class="tip">${tip}</div></div>`;
  }

  private itemCard(item: ShopItem): { html: string; ok: boolean } {
    if (item.kind === 'joker') {
      const def = JOKERS[item.id];
      const text = JOKER_TEXT[item.id];
      const ed = item.edition
        ? `<p class="ed">${EDITION_TEXT[item.edition].name}: ${EDITION_TEXT[item.edition].desc}</p>`
        : '';
      const tip = `<b>${text.name}</b><span class="rar r-${def.rarity}">${RARITY_NAME[def.rarity]}</span><p>${text.desc}</p>${ed}`;
      return {
        ok: true,
        html: `<div class="icard ${item.edition ? 'ed-' + item.edition : ''}"><img src="${jokerArt(item.id, def.rarity)}" draggable="false"/><i class="fx"></i><div class="tip">${tip}</div></div>`,
      };
    }
    const hand = PLANET_BY_ID[item.id].hand;
    const lvl = this.run.levels[hand] ?? 1;
    const a = handStats(hand, lvl);
    const b = handStats(hand, lvl + 1);
    const tip = `<b>${PLANET_TEXT[item.id]}</b><span class="rar r-planet">Planeta</span><p>${HAND_NAME[hand]}: Nv.${lvl} → Nv.${lvl + 1}</p><p>+${b.chips - a.chips} Fichas, +${b.mult - a.mult} Mult</p>`;
    return { ok: true, html: `<div class="icard"><img src="${planetArt(item.id)}" draggable="false"/><div class="tip">${tip}</div></div>` };
  }

  private actionsHtml(): string {
    return `<div class="actions">
      <button class="btn btn-blue" data-act="play" id="btn-play">Jugar mano</button>
      <button class="btn btn-red" data-act="discard" id="btn-discard">Descartar</button>
      <div class="sort-btns"><button class="mini-btn" data-act="sort-rank">Rango</button><button class="mini-btn" data-act="sort-suit">Palo</button></div>
    </div>`;
  }

  private blindSelectHtml(): string {
    const r = this.run;
    const cards = BLINDS.map((kind, i) => {
      const state = i < r.blindIndex ? 'done' : i === r.blindIndex ? 'current' : 'next';
      const buttons =
        state === 'current'
          ? `<button class="btn btn-blue" data-act="select">Jugar</button>${
              kind !== 'boss' ? '<button class="btn btn-orange" data-act="skip">Saltar</button>' : ''
            }`
          : `<div class="blind-state">${state === 'done' ? '✔ Superada' : 'Pendiente'}</div>`;
      return `<div class="blind-option ${state} blind-${kind}">
        <div class="blind-name">${BLIND_NAME[kind]}</div>
        <div class="stat-line">Objetivo<b>${fmt(blindTarget(r.ante, kind))}</b></div>
        <div class="stat-line">Recompensa<b>${'$'.repeat(BLIND_REWARD[kind])}</b></div>
        ${buttons}
      </div>`;
    }).join('');
    return `<div class="overlay"><h2>Ante ${r.ante} / ${MAX_ANTE}</h2><div class="blind-options">${cards}</div></div>`;
  }

  private cashoutHtml(): string {
    const c = this.run.cashout!;
    return `<div class="overlay"><div class="panel cashout">
      <h2>¡Ciega superada!</h2>
      <div class="stat-line">${BLIND_NAME[this.run.blind]}<b>$${c.blindReward}</b></div>
      <div class="stat-line">Manos sobrantes (${this.run.handsLeft})<b>$${c.handsBonus}</b></div>
      <div class="stat-line">Interés<b>$${c.interest}</b></div>
      ${c.jokerBonus ? `<div class="stat-line">Jokers<b>$${c.jokerBonus}</b></div>` : ''}
      <div class="stat-line total">Total<b>$${c.total}</b></div>
      <button class="btn btn-orange" data-act="collect">Cobrar $${c.total}</button>
    </div></div>`;
  }

  private shopHtml(): string {
    const r = this.run;
    const s = r.shop!;
    const full = r.jokers.length >= r.jokerSlots;
    const items = s.items
      .map((it, i) => {
        if (!it) return '<div class="shop-slot sold"><div class="empty-slot">Vendido</div></div>';
        const c = this.itemCard(it);
        const noRoom = it.kind === 'joker' && full;
        const dis = r.money < it.cost || noRoom;
        return `<div class="shop-slot">${c.html}<button class="btn btn-orange price" data-act="buy" data-i="${i}" ${dis ? 'disabled' : ''}>${noRoom ? 'Sin espacio' : '$' + it.cost}</button></div>`;
      })
      .join('');
    const packs = s.packs
      .map((p, i) => {
        if (!p) return '<div class="shop-slot sold"><div class="empty-slot">Vendido</div></div>';
        const t = PACK_TEXT[p.kind];
        return `<div class="shop-slot"><div class="icard"><img src="${packArt(p.kind)}" draggable="false"/><div class="tip"><b>${t.name}</b><p>${t.desc}</p></div></div>
          <button class="btn btn-orange price" data-act="pack" data-i="${i}" ${r.money < p.cost ? 'disabled' : ''}>$${p.cost}</button></div>`;
      })
      .join('');
    const v = s.voucher
      ? `<div class="shop-slot"><div class="icard"><img src="${voucherArt(s.voucher)}" draggable="false"/><div class="tip"><b>${VOUCHER_TEXT[s.voucher].name}</b><span class="rar r-planet">Voucher</span><p>${VOUCHER_TEXT[s.voucher].desc}</p></div></div>
         <button class="btn btn-orange price" data-act="voucher" ${r.money < VOUCHER_COST ? 'disabled' : ''}>$${VOUCHER_COST}</button></div>`
      : '<div class="shop-slot sold"><div class="empty-slot">Sin voucher</div></div>';
    return `<div class="overlay shop">
      <h2>Tienda <span class="gold">$${r.money}</span></h2>
      <div class="shop-rows">
        <div class="shop-group"><h3>Cartas</h3><div class="shop-row">${items}</div></div>
        <div class="shop-group"><h3>Packs</h3><div class="shop-row">${packs}</div></div>
        <div class="shop-group"><h3>Voucher</h3><div class="shop-row">${v}</div></div>
      </div>
      <div class="row shop-actions">
        <button class="btn btn-red" data-act="reroll" ${r.money < s.rerollCost ? 'disabled' : ''}>Relanzar $${s.rerollCost}</button>
        <button class="btn btn-blue" data-act="leave">Siguiente ronda</button>
      </div>
    </div>`;
  }

  private packHtml(): string {
    const r = this.run;
    const pack = r.openPack!;
    const t = PACK_TEXT[pack.kind];
    const full = r.jokers.length >= r.jokerSlots;
    const cards = pack.choices
      .map((it, i) => {
        const c = this.itemCard(it);
        const noRoom = it.kind === 'joker' && full;
        return `<div class="shop-slot">${c.html}<button class="btn btn-blue price" data-act="pick" data-i="${i}" ${noRoom ? 'disabled' : ''}>${noRoom ? 'Sin espacio' : 'Elegir'}</button></div>`;
      })
      .join('');
    return `<div class="overlay shop"><h2>${t.name}</h2><div class="shop-row">${cards}</div>
      <button class="btn btn-red skip-pack" data-act="skippack">Saltar</button></div>`;
  }

  private handsHtml(): string {
    const r = this.run;
    const rows = HAND_ORDER.map((h) => {
      const plays = r.handPlays[h] ?? 0;
      const hidden = SECRET.includes(h) && plays === 0;
      const lvl = r.levels[h] ?? 1;
      const st = handStats(h, lvl);
      return `<tr class="${hidden ? 'hidden-row' : ''}"><td>${hidden ? '???' : HAND_NAME[h]}</td><td>Nv.${lvl}</td>
        <td class="c-chips">${hidden ? '?' : st.chips}</td><td>×</td><td class="c-mult">${hidden ? '?' : st.mult}</td><td>${plays}</td></tr>`;
    }).join('');
    return `<div class="overlay info-overlay"><div class="panel hands-panel"><h2>Manos de póker</h2>
      <table><thead><tr><th>Mano</th><th>Nivel</th><th colspan="3">Fichas × Mult</th><th>Jugadas</th></tr></thead><tbody>${rows}</tbody></table>
      <button class="btn btn-red" data-act="hands">Cerrar</button></div></div>`;
  }

  private endHtml(): string {
    const won = this.run.phase === 'won';
    return `<div class="overlay"><div class="panel cashout">
      <h2>${won ? '¡Has ganado la run!' : 'Has perdido'}</h2>
      <div class="stat-line">Ante alcanzado<b>${this.run.ante}</b></div>
      <div class="stat-line">Semilla<b>${this.run.seed}</b></div>
      <div class="row">
        <button class="btn btn-red" data-act="exit">Menú</button>
        <button class="btn btn-blue" data-act="restart">Otra run</button>
      </div>
    </div></div>`;
  }

  // ---------------------------------------------------------------- eventos

  private bind() {
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        this.act(el);
      };
    });
    // Reordenar jokers arrastrando
    const cards = [...this.root.querySelectorAll<HTMLElement>('.icard.joker')];
    cards.forEach((el) => {
      el.ondragstart = (e) => {
        if (this.busy) return e.preventDefault();
        e.dataTransfer?.setData('text/plain', el.dataset.index!);
        el.classList.add('dragging');
      };
      el.ondragend = () => el.classList.remove('dragging');
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer?.getData('text/plain'));
        const to = Number(el.dataset.index);
        if (Number.isNaN(from) || from === to || this.busy) return;
        this.run.moveJoker(from, to);
        this.refresh();
      };
    });
  }

  private act(el: HTMLElement) {
    const a = el.dataset.act!;
    const r = this.run;
    const i = Number(el.dataset.i);
    if (a === 'hands') {
      this.showHands = !this.showHands;
      return this.refresh();
    }
    if (this.busy) return;
    try {
      switch (a) {
        case 'exit': return this.cb.onExit();
        case 'restart': return this.cb.onRestart();
        case 'select': r.selectBlind(); this.table.sync(); break;
        case 'skip': r.skipBlind(); break;
        case 'collect': r.collectCashout(); break;
        case 'buy': r.buy(i); break;
        case 'pack': r.buyPack(i); break;
        case 'pick': r.pickFromPack(i); break;
        case 'skippack': r.skipPack(); break;
        case 'voucher': r.buyVoucher(); break;
        case 'reroll': r.reroll(); break;
        case 'leave': r.leaveShop(); break;
        case 'joker': this.selJoker = this.selJoker === Number(el.dataset.uid) ? null : Number(el.dataset.uid); break;
        case 'sell': r.sellJoker(Number(el.dataset.uid)); this.selJoker = null; break;
        case 'sort-rank': r.sortHand('rank'); this.table.sync(); return;
        case 'sort-suit': r.sortHand('suit'); this.table.sync(); return;
        case 'play': return void this.play();
        case 'discard': return this.discard();
      }
    } catch (err) {
      console.warn(err);
    }
    this.refresh();
  }

  // ---------------------------------------------------------------- jugar

  private async play() {
    const cards = this.table.selectedCards();
    if (!cards.length) return;
    this.busy = true;
    this.table.enabled = false;
    this.disableActions(true);
    const prevScore = this.run.score;
    this.table.sendAway(cards, 'play', performance.now());
    const res = this.run.play(cards.map((c) => c.id));
    this.table.sync();
    this.setText('hands-left', String(this.run.handsLeft));
    this.setText('deck-left', `${this.run.drawPile.length}/${this.run.fullDeck.length}`);

    await this.animateScore(res.score);
    if (this.disposed) return;
    this.shownScore = prevScore;
    await this.countUp(this.run.score);
    await sleep(500);
    if (this.disposed) return;
    this.busy = false;
    this.refresh();
  }

  private async animateScore(score: ScoreResult) {
    const events = score.events;
    const speed = events.length > 24 ? 0.5 : 1;
    const name = HAND_NAME[score.hand];
    for (const e of events) {
      if (this.disposed) return;
      this.setPreview(name, e.chips, e.mult);
      if (e.type === 'hand') {
        await sleep(450 * speed);
        continue;
      }
      this.bump(e.type === 'chips' ? 'pv-chips' : 'pv-mult');
      if (e.source.kind !== 'card') this.popJoker(e);
      await sleep((e.source.kind === 'card' ? 130 : 420) * speed);
    }
    await sleep(250);
  }

  private popJoker(e: Extract<ScoreEvent, { value: number }>) {
    const el = this.root.querySelector<HTMLElement>(`.icard.joker[data-uid="${e.source.id}"]`);
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    const label = document.createElement('div');
    const v = Number.isInteger(e.value) ? e.value : e.value.toFixed(1).replace('.', ',');
    label.className = `float ${e.type}`;
    label.textContent = e.type === 'chips' ? `+${v} Fichas` : e.type === 'mult' ? `+${v} Mult` : `×${v} Mult`;
    const rect = el.getBoundingClientRect();
    label.style.left = `${rect.left + rect.width / 2}px`;
    label.style.top = `${rect.bottom - 8}px`;
    this.root.appendChild(label);
    setTimeout(() => label.remove(), 1000);
  }

  private discard() {
    const cards = this.table.selectedCards();
    if (!cards.length || this.run.discardsLeft <= 0) return;
    this.busy = true;
    this.table.sendAway(cards, 'discard', performance.now());
    this.run.discard(cards.map((c) => c.id));
    this.table.sync();
    setTimeout(() => {
      if (this.disposed) return;
      this.busy = false;
      this.refresh();
    }, 450);
  }

  private countUp(to: number): Promise<void> {
    return new Promise((resolve) => {
      const from = this.shownScore;
      const start = performance.now();
      const step = (t: number) => {
        if (this.disposed) return resolve();
        const k = Math.min(1, (t - start) / 700);
        this.shownScore = Math.round(from + (to - from) * k);
        this.setText('round-score', fmt(this.shownScore));
        if (k < 1) this.scoreAnim = requestAnimationFrame(step);
        else resolve();
      };
      this.scoreAnim = requestAnimationFrame(step);
    });
  }

  // ---------------------------------------------------------------- helpers

  private updatePreview() {
    if (this.busy) return;
    const sel = this.table.selectedCards();
    if (sel.length) {
      // La vista previa es la puntuación base (sin jokers), como en el juego original.
      const res = this.run.preview(sel);
      const first = res.events[0];
      let chips = first.chips;
      for (const e of res.events) if (e.type === 'chips' && e.source.kind === 'card') chips += e.value;
      this.setPreview(HAND_NAME[res.hand], chips, first.mult);
    } else this.setPreview('', 0, 0);
    this.disableActions(false);
  }

  private disableActions(forceOff: boolean) {
    const n = this.table.selectedCards().length;
    const play = this.root.querySelector<HTMLButtonElement>('#btn-play');
    const disc = this.root.querySelector<HTMLButtonElement>('#btn-discard');
    if (play) play.disabled = forceOff || n === 0 || this.run.handsLeft <= 0;
    if (disc) disc.disabled = forceOff || n === 0 || this.run.discardsLeft <= 0;
  }

  private setPreview(name: string, chips: number, mult: number) {
    this.setText('pv-name', name || ' ');
    this.setText('pv-chips', String(Math.round(chips)));
    this.setText('pv-mult', Number.isInteger(mult) ? String(mult) : mult.toFixed(1).replace('.', ','));
  }

  private bump(id: string) {
    const el = this.root.querySelector(`#${id}`);
    if (!el) return;
    el.classList.remove('bump');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('bump');
  }

  private setText(id: string, v: string) {
    const el = this.root.querySelector('#' + id);
    if (el) el.textContent = v;
  }
}


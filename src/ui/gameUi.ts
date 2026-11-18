import { BLIND_REWARD, BLINDS, blindTarget, MAX_ANTE, type Run } from '../core/run';
import { scoreHand } from '../core/scoring';
import { BLIND_NAME, HAND_NAME } from '../i18n/es';
import type { Table } from '../render/table';

/** HUD y pantallas de la run (selección de ciega, cashout, fin) en DOM. */
export class GameUI {
  private root = document.createElement('div');
  private busy = false;
  private shownScore = 0;
  private scoreAnim = 0;

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
    cancelAnimationFrame(this.scoreAnim);
    this.root.remove();
  }

  /** Reconstruye la UI según la fase de la run. */
  refresh(): void {
    const r = this.run;
    this.shownScore = r.score;
    this.table.enabled = r.phase === 'playing' && !this.busy;
    this.table.setVisible(r.phase === 'playing');
    let overlay = '';
    if (r.phase === 'blind_select') overlay = this.blindSelectHtml();
    else if (r.phase === 'cashout') overlay = this.cashoutHtml();
    else if (r.phase === 'won' || r.phase === 'lost') overlay = this.endHtml();

    this.root.innerHTML = `
      ${this.sideHtml()}
      ${r.phase === 'playing' ? this.actionsHtml() : ''}
      ${overlay}`;
    this.bind();
    this.updatePreview();
  }

  private sideHtml(): string {
    const r = this.run;
    const inBlind = r.phase === 'playing';
    return `
    <aside class="side">
      <button class="table-back" data-act="exit">☰ Menú</button>
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
      <div class="stat-box gold">Dinero<b>$${r.money}</b></div>
      <div class="stat-row">
        <div class="stat-box">Ante<b>${r.ante}/${MAX_ANTE}</b></div>
        <div class="stat-box">Mazo<b id="deck-left">${r.drawPile.length}/${r.fullDeck.length}</b></div>
      </div>
    </aside>`;
  }

  private actionsHtml(): string {
    return `<div class="actions">
      <button class="btn btn-blue" data-act="play" id="btn-play">Jugar mano</button>
      <button class="btn btn-red" data-act="discard" id="btn-discard">Descartar</button>
    </div>`;
  }

  private blindSelectHtml(): string {
    const r = this.run;
    const cards = BLINDS.map((kind, i) => {
      const state = i < r.blindIndex ? 'done' : i === r.blindIndex ? 'current' : 'next';
      const target = blindTarget(r.ante, kind);
      const buttons =
        state === 'current'
          ? `<button class="btn btn-blue" data-act="select">Jugar</button>${
              kind !== 'boss' ? '<button class="btn btn-orange" data-act="skip">Saltar</button>' : ''
            }`
          : `<div class="blind-state">${state === 'done' ? '✔ Superada' : 'Pendiente'}</div>`;
      return `<div class="blind-option ${state} blind-${kind}">
        <div class="blind-name">${BLIND_NAME[kind]}</div>
        <div class="stat-line">Objetivo<b>${fmt(target)}</b></div>
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
      <div class="stat-line total">Total<b>$${c.total}</b></div>
      <button class="btn btn-orange" data-act="collect">Cobrar $${c.total}</button>
    </div></div>`;
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

  private bind() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.onclick = () => this.act(b.dataset.act!);
    });
  }

  private act(a: string) {
    const r = this.run;
    if (this.busy) return;
    switch (a) {
      case 'exit': return this.cb.onExit();
      case 'restart': return this.cb.onRestart();
      case 'select': r.selectBlind(); this.table.sync(); return this.refresh();
      case 'skip': r.skipBlind(); return this.refresh();
      case 'collect': r.collectCashout(); return this.refresh();
      case 'play': return this.play();
      case 'discard': return this.discard();
    }
  }

  private play() {
    const cards = this.table.selectedCards();
    if (!cards.length) return;
    this.busy = true;
    this.table.enabled = false;
    const now = performance.now();
    this.table.sendAway(cards, 'play', now);
    const res = this.run.play(cards.map((c) => c.id));
    this.table.sync();
    this.setPreview(HAND_NAME[res.score.hand], res.score.chips, res.score.mult);
    this.setText('hands-left', String(this.run.handsLeft));
    this.setText('deck-left', `${this.run.drawPile.length}/${this.run.fullDeck.length}`);
    this.disableActions(true);
    // contador de puntos animado tras mostrar la mano
    setTimeout(() => this.countUp(this.run.score), 450);
    setTimeout(() => {
      this.busy = false;
      this.refresh();
    }, 1400);
  }

  private discard() {
    const cards = this.table.selectedCards();
    if (!cards.length || this.run.discardsLeft <= 0) return;
    this.busy = true;
    this.table.sendAway(cards, 'discard', performance.now());
    this.run.discard(cards.map((c) => c.id));
    this.table.sync();
    setTimeout(() => {
      this.busy = false;
      this.refresh();
    }, 450);
  }

  private countUp(to: number) {
    const from = this.shownScore;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      this.shownScore = Math.round(from + (to - from) * k);
      this.setText('round-score', fmt(this.shownScore));
      if (k < 1) this.scoreAnim = requestAnimationFrame(step);
    };
    this.scoreAnim = requestAnimationFrame(step);
  }

  private updatePreview() {
    if (this.busy) return;
    const sel = this.table.selectedCards();
    if (sel.length) {
      const s = scoreHand(sel, this.run.levels);
      this.setPreview(HAND_NAME[s.hand], s.chips, s.mult);
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
    this.setText('pv-chips', String(chips));
    this.setText('pv-mult', String(mult));
  }

  private setText(id: string, v: string) {
    const el = this.root.querySelector('#' + id);
    if (el) el.textContent = v;
  }
}

const fmt = (n: number) => n.toLocaleString('es-ES');

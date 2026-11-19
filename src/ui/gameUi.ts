import { CONSUMABLES, type ConsumableInstance } from '../core/consumables';
import type { HandType } from '../core/hands';
import { JOKERS, sellValue, type Edition, type JokerInstance, type Rarity } from '../core/jokers';
import { PLANET_BY_ID } from '../core/planets';
import { BLIND_REWARD, BLINDS, blindTarget, MAX_ANTE, type Run } from '../core/run';
import { handStats, type ScoreEvent, type ScoreResult } from '../core/scoring';
import { PACK_SHAPE, type CardTemplate, type OpenPack, type PackKind, type PackSize, type ShopItem, type ShopKind } from '../core/shop';
import { VOUCHER_COST } from '../core/vouchers';
import { rankLabel } from '../core/cards';
import { EDITION_TEXT, JOKER_TEXT, PLANET_TEXT } from '../i18n/content.es';
import {
  BOSS_TEXT, ENHANCEMENT_TEXT, MSG_TEXT, PACK_DESC, PACK_KIND_NAME, PACK_SIZE_NAME, SEAL_TEXT,
  SPECTRAL_TEXT, STICKER_TEXT, TAG_TEXT, TAROT_TEXT, VOUCHER_TEXT,
} from '../i18n/content2.es';
import { BLIND_NAME, HAND_NAME } from '../i18n/es';
import { fmtNum, t } from '../i18n';
import { cardFaceUrl } from '../render/cardArt';
import { chipArt, consumableArt, jokerArt, packArt, voucherArt } from '../render/itemArt';
import type { Table } from '../render/table';

const rarityName = (r: Rarity) => t({ common: 'Común', uncommon: 'Poco común', rare: 'Rara', legendary: 'Legendaria' }[r]);
const suitName = (s: 'S' | 'H' | 'D' | 'C') => t({ S: 'Picas', H: 'Corazones', D: 'Diamantes', C: 'Tréboles' }[s]);
const HAND_ORDER: HandType[] = [
  'flush_five', 'flush_house', 'five_kind', 'straight_flush', 'four_kind', 'full_house',
  'flush', 'straight', 'three_kind', 'two_pair', 'pair', 'high_card',
];
const SECRET: HandType[] = ['five_kind', 'flush_house', 'flush_five'];

const fmt = (n: number) => fmtNum(n);
import { sfx } from '../audio/audio';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Described {
  img: string;
  tip: string;
  edClass: string;
}

/** HUD y pantallas de la run (selección de ciega, jokers, consumibles, tienda, cashout, fin) en DOM. */
export class GameUI {
  private root = document.createElement('div');
  private busy = false;
  private disposed = false;
  private shownScore = 0;
  private scoreAnim = 0;
  private selJoker: number | null = null;
  private selCons: number | null = null;
  private showHands = false;
  private playErr: string | null = null;
  private toastTimer = 0;

  constructor(
    private run: Run,
    private table: Table,
    private cb: { onExit(): void; onRestart(): void; onSync?(run: Run): void },
  ) {
    this.root.className = 'game-ui';
    document.body.appendChild(this.root);
    this.table.onSelectionChange = () => {
      const n = this.table.selectedCards().length;
      if (n !== this.lastSel) sfx(n > this.lastSel ? 'select' : 'deselect');
      this.lastSel = n;
      this.updatePreview();
    };
    addEventListener('keydown', this.onKey, { signal: this.abort.signal });
    this.refresh();
  }

  private lastSel = 0;
  private abort = new AbortController();

  /** Atajos: Enter/Espacio jugar, D/Retroceso descartar, Esc limpiar selección, 1-9 selecciona carta. */
  private onKey = (e: KeyboardEvent) => {
    if (this.disposed || this.busy || this.run.phase !== 'playing' || this.showHands) return;
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void this.play();
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'Backspace') {
      this.discard();
    } else if (e.key === 'Escape') {
      this.table.clearSelection();
    } else if (/^[1-9]$/.test(e.key)) {
      this.table.toggleAt(Number(e.key) - 1);
    } else if (e.key === '0') {
      this.table.toggleAt(9);
    }
  };

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    cancelAnimationFrame(this.scoreAnim);
    clearTimeout(this.toastTimer);
    this.root.remove();
  }

  // ---------------------------------------------------------------- render

  /** Reconstruye la UI según la fase de la run. */
  refresh(): void {
    const r = this.run;
    this.cb.onSync?.(r);
    this.shownScore = r.score;
    if (this.selJoker !== null && !r.jokers.some((j) => j.uid === this.selJoker)) this.selJoker = null;
    if (this.selCons !== null && !r.consumables.some((c) => c.uid === this.selCons)) this.selCons = null;
    this.table.enabled = r.phase === 'playing' && !this.busy && !this.showHands;
    this.table.setVisible(r.phase === 'playing');

    let overlay = '';
    if (r.phase === 'blind_select') overlay = this.blindSelectHtml();
    else if (r.phase === 'cashout') overlay = this.cashoutHtml();
    else if (r.phase === 'shop') overlay = r.openPack ? this.packHtml(r.openPack) : this.shopHtml();
    else if (r.phase === 'won' || r.phase === 'lost') overlay = this.endHtml();
    const ended = r.phase === 'won' || r.phase === 'lost';

    this.root.innerHTML = `
      ${this.sideHtml()}
      ${ended ? '' : this.jokersHtml()}
      ${ended ? '' : this.consumablesHtml()}
      ${r.phase === 'playing' ? this.actionsHtml() : ''}
      ${overlay}
      ${this.showHands ? this.handsHtml() : ''}
      <div class="toast" id="toast"></div>`;
    this.bind();
    this.updatePreview();
  }

  private chip(id: string, kind: 'tag' | 'boss', name: string, desc: string): string {
    return `<span class="chip"><img src="${chipArt(id, kind)}" alt="${name}" draggable="false"/><div class="tip"><b>${name}</b><p>${desc}</p></div></span>`;
  }

  private sideHtml(): string {
    const r = this.run;
    const inBlind = r.phase === 'playing';
    const boss = r.blind === 'boss' ? BOSS_TEXT[r.boss.id] : null;
    const bossOff = inBlind && r.blind === 'boss' && !r.activeBoss;
    const tags = r.tags.map((t) => this.chip(t, 'tag', TAG_TEXT[t].name, TAG_TEXT[t].desc)).join('');
    return `
    <aside class="side">
      <div class="side-top">
        <button class="table-back" data-act="exit">☰ ${t('Menú')}</button>
        <button class="table-back info" data-act="hands">${t('Manos')}</button>
      </div>
      <div class="blind-card blind-${r.blind}">
        <div class="blind-name">${boss ? boss.name : BLIND_NAME[r.blind]}</div>
        ${boss ? `<div class="boss-desc ${bossOff ? 'off' : ''}">${boss.desc}${bossOff ? t(' (anulado)') : ''}</div>` : ''}
        <div class="stat-line">${t('Objetivo')} <b>${fmt(r.target)}</b></div>
      </div>
      ${tags ? `<div class="tag-row">${tags}</div>` : ''}
      <div class="stat-box">${t('Puntos de la ronda')}<b id="round-score">${fmt(inBlind ? r.score : 0)}</b></div>
      <div class="stat-box preview"><span id="pv-name">&nbsp;</span>
        <div class="pv-nums"><span class="chips" id="pv-chips">0</span><i>×</i><span class="mult" id="pv-mult">0</span></div>
      </div>
      <div class="stat-row">
        <div class="stat-box blue">${t('Manos')}<b id="hands-left">${r.handsLeft}</b></div>
        <div class="stat-box red">${t('Descartes')}<b id="discards-left">${r.discardsLeft}</b></div>
      </div>
      <div class="stat-box gold">${t('Dinero')}<b id="money">$${r.money}</b></div>
      <div class="stat-row">
        <div class="stat-box">${t('Ante')}<b>${r.endless ? r.ante : `${r.ante}/${MAX_ANTE}`}</b></div>
        <div class="stat-box">${t('Mazo')}<b id="deck-left">${r.drawPile.length}/${r.fullDeck.length}</b></div>
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
        ${sel ? `<button class="mini-btn" data-act="sell" data-uid="${sel.uid}">${t('Vender')} +$${sellValue(sel)}</button>` : `<small>${t('Arrastra para reordenar · el orden importa')}</small>`}
      </div>
      <div class="jokers-row">${cards || `<div class="empty-slot">${t('Sin jokers')}</div>`}</div>
    </div>`;
  }

  private consumablesHtml(): string {
    const r = this.run;
    const cards = r.consumables.map((c) => this.consumableCard(c)).join('');
    const sel = r.consumables.find((c) => c.uid === this.selCons);
    let actions = `<small>${t('Consumibles')}</small>`;
    if (sel) {
      const def = CONSUMABLES[sel.id];
      const canUse = !(def.needsHand && r.phase !== 'playing');
      actions = `${canUse ? `<button class="mini-btn" data-act="use" data-uid="${sel.uid}">${t('Usar')}</button>` : ''}
        <button class="mini-btn alt" data-act="sellcons" data-uid="${sel.uid}">${t('Vender')} +$${Math.max(1, Math.floor(sel.cost / 2))}</button>`;
    }
    return `
    <div class="cons-bar">
      <div class="jokers-head"><span>${r.consumables.length}/${r.consumableSlots}</span>${actions}</div>
      <div class="jokers-row">${cards || `<div class="empty-slot">${t('Vacío')}</div>`}</div>
    </div>`;
  }

  private jokerCard(j: JokerInstance, index: number): string {
    const def = JOKERS[j.id];
    const text = JOKER_TEXT[j.id];
    const extra = j.state.mult !== undefined ? `<p class="cur">${t('Actual')}: +${j.state.mult} Mult</p>` : '';
    const ed = j.edition ? `<p class="ed">${EDITION_TEXT[j.edition].name}: ${EDITION_TEXT[j.edition].desc}</p>` : '';
    const tip = `<b>${text.name}</b><span class="rar r-${def.rarity}">${rarityName(def.rarity)}</span><p>${text.desc}</p>${extra}${ed}<p class="sell">${t('Venta')}: ${sellValue(j)}</p>${this.stickerTip(j.sticker)}`;
    const dis = this.run.disabledJoker === j.uid ? 'disabled-joker' : '';
    return `<div class="icard joker ${j.edition ? 'ed-' + j.edition : ''} ${dis} ${this.selJoker === j.uid ? 'sel' : ''}"
        draggable="true" data-uid="${j.uid}" data-index="${index}" data-act="joker">
        <img src="${jokerArt(j.id, def.rarity)}" alt="${text.name}" draggable="false"/><i class="fx"></i>${this.stickerBadge(j.sticker)}
        <div class="tip">${tip}</div></div>`;
  }

  private stickerBadge(st?: string): string {
    return st ? `<span class="sticker ${st}">${STICKER_TEXT[st].name}</span>` : '';
  }

  private stickerTip(st?: string): string {
    return st ? `<p class="ed">${STICKER_TEXT[st].name}: ${STICKER_TEXT[st].desc}</p>` : '';
  }

  private consumableCard(c: ConsumableInstance): string {
    const d = this.describe(c.kind, c.id, c.edition);
    return `<div class="icard ${d.edClass} ${this.selCons === c.uid ? 'sel' : ''}" data-act="cons" data-uid="${c.uid}">
      <img src="${d.img}" draggable="false"/><i class="fx"></i><div class="tip">${d.tip}<p class="sell">${t('Venta')}: $${Math.max(1, Math.floor(c.cost / 2))}</p></div></div>`;
  }

  /** Imagen, tooltip y clase de edición de cualquier objeto de tienda/pack/inventario. */
  private describe(kind: ShopKind, id: string, edition?: Edition, card?: CardTemplate): Described {
    const edText = edition ? `<p class="ed">${EDITION_TEXT[edition].name}: ${EDITION_TEXT[edition].desc}</p>` : '';
    const edClass = edition ? `ed-${edition}` : '';
    switch (kind) {
      case 'joker': {
        const def = JOKERS[id];
        const tx = JOKER_TEXT[id];
        return { img: jokerArt(id, def.rarity), edClass, tip: `<b>${tx.name}</b><span class="rar r-${def.rarity}">${rarityName(def.rarity)}</span><p>${tx.desc}</p>${edText}` };
      }
      case 'planet': {
        const hand = PLANET_BY_ID[id].hand;
        const lvl = this.run.levels[hand] ?? 1;
        const a = handStats(hand, lvl);
        const b = handStats(hand, lvl + 1);
        return {
          img: consumableArt(id, 'planet'), edClass,
          tip: `<b>${PLANET_TEXT[id]}</b><span class="rar r-planet">${t('Planeta')}</span><p>${HAND_NAME[hand]}: ${t('Nv.')}${lvl} → ${t('Nv.')}${lvl + 1}</p><p>+${b.chips - a.chips} ${t('Fichas')}, +${b.mult - a.mult} Mult</p>${edText}`,
        };
      }
      case 'tarot':
      case 'spectral': {
        const tx = kind === 'tarot' ? TAROT_TEXT[id] : SPECTRAL_TEXT[id];
        const def = CONSUMABLES[id];
        const need = def.min ? `<p class="cur">${t('Selecciona {0} carta(s) de tu mano', def.min === def.max ? def.min : `${def.min}-${def.max}`)}</p>` : '';
        return { img: consumableArt(id, kind), edClass, tip: `<b>${tx.name}</b><span class="rar r-${kind}">${kind === 'tarot' ? 'Tarot' : 'Spectral'}</span><p>${tx.desc}</p>${need}${edText}` };
      }
      default: {
        const c = card!;
        const extras = [
          c.enhancement && `<p class="ed">${ENHANCEMENT_TEXT[c.enhancement].name}: ${ENHANCEMENT_TEXT[c.enhancement].desc}</p>`,
          c.seal && `<p class="ed">${SEAL_TEXT[c.seal].name}: ${SEAL_TEXT[c.seal].desc}</p>`,
          c.edition && `<p class="ed">${EDITION_TEXT[c.edition].name}: ${EDITION_TEXT[c.edition].desc}</p>`,
        ].filter(Boolean).join('');
        return {
          img: cardFaceUrl({ id: -1, ...c }), edClass: '',
          tip: `<b>${t('{0} de {1}', rankLabel(c.rank), suitName(c.suit))}</b><span class="rar r-planet">${t('Carta')}</span><p>${t('Se añade a tu mazo')}</p>${extras}`,
        };
      }
    }
  }

  private itemCard(item: ShopItem): string {
    const d = this.describe(item.kind, item.id, item.edition, item.card);
    return `<div class="icard ${d.edClass}"><img src="${d.img}" draggable="false"/><i class="fx"></i>${this.stickerBadge(item.sticker)}<div class="tip">${d.tip}${this.stickerTip(item.sticker)}</div></div>`;
  }

  private noRoom(item: ShopItem): boolean {
    const r = this.run;
    if (item.kind === 'joker') return r.jokers.length >= r.jokerSlots && item.edition !== 'negative';
    if (item.kind === 'card') return false;
    return r.consumableSpace() <= 0;
  }

  private packName(kind: PackKind, size: PackSize): string {
    return t('Pack {0}{1}', PACK_SIZE_NAME[size], PACK_KIND_NAME[kind]);
  }

  private actionsHtml(): string {
    return `<div class="actions">
      <button class="btn btn-blue" data-act="play" id="btn-play">${t('Jugar mano')}</button>
      <button class="btn btn-red" data-act="discard" id="btn-discard">${t('Descartar')}</button>
      <div class="sort-btns"><button class="mini-btn" data-act="sort-rank">${t('Rango')}</button><button class="mini-btn" data-act="sort-suit">${t('Palo')}</button></div>
    </div>`;
  }

  private blindSelectHtml(): string {
    const r = this.run;
    const boss = BOSS_TEXT[r.boss.id];
    const canReroll = r.vouchers.has('directors_cut') || r.vouchers.has('retcon');
    const cards = BLINDS.map((kind, i) => {
      const state = i < r.blindIndex ? 'done' : i === r.blindIndex ? 'current' : 'next';
      const buttons =
        state === 'current'
          ? `<button class="btn btn-blue" data-act="select">${t('Jugar')}</button>${
              kind !== 'boss' ? `<button class="btn btn-orange" data-act="skip">${t('Saltar')}</button>` : ''
            }${kind === 'boss' && canReroll ? `<button class="mini-btn" data-act="rerollboss">${t('Relanzar Boss $10')}</button>` : ''}`
          : `<div class="blind-state">${state === 'done' ? t('✔ Superada') : t('Pendiente')}</div>`;
      const tag = kind !== 'boss' && state !== 'done' ? this.offeredTagLine(i) : '';
      return `<div class="blind-option ${state} blind-${kind}">
        <div class="blind-name">${kind === 'boss' ? boss.name : BLIND_NAME[kind]}</div>
        ${kind === 'boss' ? `<div class="boss-desc">${boss.desc}</div>` : ''}
        <div class="stat-line">${t('Objetivo')}<b>${fmt(blindTarget(r.ante, kind, r.boss.mult))}</b></div>
        <div class="stat-line">${t('Recompensa')}<b>${'$'.repeat(BLIND_REWARD[kind])}</b></div>
        ${tag}
        ${buttons}
      </div>`;
    }).join('');
    return `<div class="overlay"><h2>${t('Ante')} ${r.endless ? r.ante : `${r.ante} / ${MAX_ANTE}`}</h2><div class="blind-options">${cards}</div></div>`;
  }

  /** Línea con el Tag que daría saltar esa ciega (solo se conoce el de la ciega actual). */
  private offeredTagLine(index: number): string {
    const r = this.run;
    if (index !== r.blindIndex || !r.offeredTag) return '';
    const tx = TAG_TEXT[r.offeredTag];
    return `<div class="skip-tag">${t('Saltar da')}: ${this.chip(r.offeredTag, 'tag', tx.name, tx.desc)}<span>${tx.name}</span></div>`;
  }

  private cashoutHtml(): string {
    const c = this.run.cashout!;
    return `<div class="overlay"><div class="panel cashout">
      <h2>${t('¡Ciega superada!')}</h2>
      <div class="stat-line">${BLIND_NAME[this.run.blind]}<b>$${c.blindReward}</b></div>
      <div class="stat-line">${t('Manos sobrantes')} (${this.run.handsLeft})<b>$${c.handsBonus}</b></div>
      <div class="stat-line">${t('Interés')}<b>$${c.interest}</b></div>
      ${c.jokerBonus ? `<div class="stat-line">Jokers<b>$${c.jokerBonus}</b></div>` : ''}
      ${c.heldBonus ? `<div class="stat-line">${t('Cartas de oro')}<b>$${c.heldBonus}</b></div>` : ''}
      ${c.tagBonus ? `<div class="stat-line">${t('Tag Inversión')}<b>$${c.tagBonus}</b></div>` : ''}
      ${c.rental ? `<div class="stat-line">${t('Alquileres')}<b>-${c.rental}</b></div>` : ''}
      <div class="stat-line total">${t('Total')}<b>${c.total}</b></div>
      <button class="btn btn-orange" data-act="collect">${t('Cobrar')} $${c.total}</button>
    </div></div>`;
  }

  private priceLabel(cost: number): string {
    return cost === 0 ? t('Gratis') : `$${cost}`;
  }

  private shopHtml(): string {
    const r = this.run;
    const s = r.shop!;
    const items = s.items
      .map((it, i) => {
        if (!it) return `<div class="shop-slot sold"><div class="empty-slot">${t('Vendido')}</div></div>`;
        const noRoom = this.noRoom(it);
        const dis = r.money + r.debtLimit < it.cost || noRoom;
        return `<div class="shop-slot">${this.itemCard(it)}<button class="btn btn-orange price" data-act="buy" data-i="${i}" ${dis ? 'disabled' : ''}>${noRoom ? t('Sin espacio') : this.priceLabel(it.cost)}</button></div>`;
      })
      .join('');
    const packs = s.packs
      .map((p, i) => {
        if (!p) return `<div class="shop-slot sold"><div class="empty-slot">${t('Vendido')}</div></div>`;
        const [n, picks] = PACK_SHAPE[p.kind][p.size];
        return `<div class="shop-slot"><div class="icard"><img src="${packArt(p.kind)}" draggable="false"/><div class="tip"><b>${this.packName(p.kind, p.size)}</b><p>${t('Elige {0} de {1} {2}', picks, n, PACK_DESC[p.kind])}</p></div></div>
          <button class="btn btn-orange price" data-act="pack" data-i="${i}" ${r.money + r.debtLimit < p.cost ? 'disabled' : ''}>${this.priceLabel(p.cost)}</button></div>`;
      })
      .join('');
    const vouchers = s.vouchers
      .map((v, i) =>
        v
          ? `<div class="shop-slot"><div class="icard"><img src="${voucherArt(v)}" draggable="false"/><div class="tip"><b>${VOUCHER_TEXT[v].name}</b><span class="rar r-planet">${t('Voucher')}</span><p>${VOUCHER_TEXT[v].desc}</p></div></div>
         <button class="btn btn-orange price" data-act="voucher" data-i="${i}" ${r.money + r.debtLimit < VOUCHER_COST ? 'disabled' : ''}>$${VOUCHER_COST}</button></div>`
          : `<div class="shop-slot sold"><div class="empty-slot">${t('Vendido')}</div></div>`,
      )
      .join('');
    return `<div class="overlay shop">
      <h2>${t('Tienda')} <span class="gold">$${r.money}</span></h2>
      <div class="shop-rows">
        <div class="shop-group"><h3>${t('Cartas')}</h3><div class="shop-row">${items}</div></div>
        <div class="shop-group"><h3>${t('Packs')}</h3><div class="shop-row">${packs}</div></div>
        <div class="shop-group"><h3>${t('Voucher')}</h3><div class="shop-row">${vouchers}</div></div>
      </div>
      <div class="row shop-actions">
        <button class="btn btn-red" data-act="reroll" ${(s.free ?? 0) === 0 && r.money + r.debtLimit < s.rerollCost ? 'disabled' : ''}>${t('Relanzar')} ${(s.free ?? 0) > 0 ? t('gratis') : '$' + s.rerollCost}</button>
        <button class="btn btn-blue" data-act="leave">${t('Siguiente ronda')}</button>
      </div>
    </div>`;
  }

  private packHtml(pack: OpenPack): string {
    const cards = pack.choices
      .map((it, i) => {
        const noRoom = this.noRoom(it);
        return `<div class="shop-slot">${this.itemCard(it)}<button class="btn btn-blue price" data-act="pick" data-i="${i}" ${noRoom ? 'disabled' : ''}>${noRoom ? t('Sin espacio') : t('Elegir')}</button></div>`;
      })
      .join('');
    return `<div class="overlay shop"><h2>${this.packName(pack.kind, pack.size)}</h2>
      <p class="pack-hint">${t('Elige {0} · los Tarots y Spectrals van a tus consumibles', pack.picksLeft)}</p>
      <div class="shop-row">${cards}</div>
      <button class="btn btn-red skip-pack" data-act="skippack">${t('Saltar')}</button></div>`;
  }

  private handsHtml(): string {
    const r = this.run;
    const rows = HAND_ORDER.map((h) => {
      const plays = r.handPlays[h] ?? 0;
      const hidden = SECRET.includes(h) && plays === 0;
      const lvl = r.levels[h] ?? 1;
      const st = handStats(h, lvl);
      return `<tr class="${hidden ? 'hidden-row' : ''}"><td>${hidden ? '???' : HAND_NAME[h]}</td><td>${t('Nv.')}${lvl}</td>
        <td class="c-chips">${hidden ? '?' : st.chips}</td><td>×</td><td class="c-mult">${hidden ? '?' : st.mult}</td><td>${plays}</td></tr>`;
    }).join('');
    return `<div class="overlay info-overlay"><div class="panel hands-panel"><h2>${t('Manos de póker')}</h2>
      <table><thead><tr><th>${t('Mano')}</th><th>${t('Nivel')}</th><th colspan="3">${t('Fichas')} × Mult</th><th>${t('Jugadas')}</th></tr></thead><tbody>${rows}</tbody></table>
      <button class="btn btn-red" data-act="hands">${t('Cerrar')}</button></div></div>`;
  }

  private endHtml(): string {
    const won = this.run.phase === 'won';
    return `<div class="overlay"><div class="panel cashout">
      <h2>${won ? t('¡Has ganado la run!') : t('Has perdido')}</h2>
      <div class="stat-line">${t('Ante alcanzado')}<b>${this.run.ante}</b></div>
      <div class="stat-line">${t('Semilla')}<b>${this.run.seed}</b></div>
      <div class="stat-line">${t('Mejor mano')}<b>${fmt(this.run.bestHand)}</b></div>
      <div class="row">
        <button class="btn btn-red" data-act="exit">${t('Menú')}</button>
        ${won ? `<button class="btn btn-orange" data-act="endless">${t('Seguir (Endless)')}</button>` : ''}
        <button class="btn btn-blue" data-act="restart">${t('Otra run')}</button>
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

  private toast(msg: string) {
    const el = this.root.querySelector<HTMLElement>('#toast');
    if (!el) return;
    el.textContent = MSG_TEXT[msg] ?? t(msg);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 2200);
  }

  private act(el: HTMLElement) {
    const a = el.dataset.act!;
    const r = this.run;
    const i = Number(el.dataset.i);
    const uid = Number(el.dataset.uid);
    if (a === 'hands') {
      this.showHands = !this.showHands;
      return this.refresh();
    }
    if (this.busy) return;
    sfx(['buy', 'pack', 'voucher', 'pick'].includes(a) ? 'buy' : 'click');
    let note: string | null = null;
    try {
      switch (a) {
        case 'exit': return this.cb.onExit();
        case 'restart': return this.cb.onRestart();
        case 'endless': r.continueEndless(); break;
        case 'select': r.selectBlind(); this.table.sync(); break;
        case 'skip': r.skipBlind(); break;
        case 'rerollboss': r.rerollBoss(); break;
        case 'collect': r.collectCashout(); break;
        case 'buy': r.buy(i); break;
        case 'pack': r.buyPack(i); break;
        case 'pick': r.pickFromPack(i); break;
        case 'skippack': r.skipPack(); break;
        case 'voucher': r.buyVoucher(i); break;
        case 'reroll': r.reroll(); break;
        case 'leave': r.leaveShop(); break;
        case 'joker': this.selJoker = this.selJoker === uid ? null : uid; break;
        case 'sell': r.sellJoker(uid); this.selJoker = null; break;
        case 'cons': this.selCons = this.selCons === uid ? null : uid; break;
        case 'sellcons': r.sellConsumable(uid); this.selCons = null; break;
        case 'use': {
          const inst = r.consumables.find((c) => c.uid === uid)!;
          const needsCards = CONSUMABLES[inst.id].min > 0;
          r.useConsumable(uid, needsCards ? this.table.selectedCards().map((c) => c.id) : []);
          this.selCons = null;
          this.table.clearSelection();
          this.table.sync();
          note = r.message;
          break;
        }
        case 'sort-rank': r.sortHand('rank'); this.table.sync(); return;
        case 'sort-suit': r.sortHand('suit'); this.table.sync(); return;
        case 'play': return void this.play();
        case 'discard': return this.discard();
      }
    } catch (err) {
      this.refresh();
      this.toast(err instanceof Error ? err.message : String(err));
      return;
    }
    this.refresh();
    if (note) this.toast(note);
  }

  // ---------------------------------------------------------------- jugar

  private async play() {
    const cards = this.table.selectedCards();
    if (!cards.length) return;
    const err = this.run.playError(cards);
    if (err) return this.toast(err);
    this.busy = true;
    this.table.enabled = false;
    this.disableActions(true);
    const prevScore = this.run.score;
    sfx('play');
    let res: ReturnType<Run['play']>;
    try {
      res = this.run.play(cards.map((c) => c.id));
    } catch (err) {
      this.busy = false;
      this.refresh();
      this.toast(err instanceof Error ? err.message : String(err));
      return;
    }
    this.table.sendAway(cards, 'play', performance.now());
    this.table.sync();
    this.setText('hands-left', String(this.run.handsLeft));
    this.setText('deck-left', `${this.run.drawPile.length}/${this.run.fullDeck.length}`);

    try {
      await this.animateScore(res.score);
      if (this.disposed) return;
      this.shownScore = prevScore;
      await this.countUp(this.run.score);
      this.setText('money', `$${this.run.money}`);
      if (res.score.destroyed.length) this.toast(t('¡Se ha roto una carta de cristal!'));
      await sleep(500);
    } catch (err) {
      console.error(err);
    } finally {
      if (!this.disposed) {
        this.busy = false;
        if (this.run.phase === 'cashout') sfx('win');
        else if (this.run.phase === 'lost') sfx('lose');
        this.refresh();
      }
    }
  }

  private async animateScore(score: ScoreResult) {
    const events = score.events;
    const speed = events.length > 24 ? 0.5 : 1;
    const name = HAND_NAME[score.hand];
    let n = 0;
    for (const e of events) {
      if (this.disposed) return;
      this.setPreview(name, e.chips, e.mult);
      this.root.querySelector('#pv-mult')?.classList.toggle('fire', e.mult >= 25);
      if (e.type === 'hand') {
        await sleep(450 * speed);
        continue;
      }
      if (e.type === 'money') {
        sfx('money');
        this.floatAt('#money', `+$${e.value}`, 'money');
        await sleep(300 * speed);
        continue;
      }
      sfx(e.type === 'xmult' ? 'xmult' : e.type === 'chips' ? 'chips' : 'mult', n++);
      if (e.type === 'xmult') this.shake(6);
      this.bump(e.type === 'chips' ? 'pv-chips' : 'pv-mult');
      if (e.source.kind === 'joker' || e.source.kind === 'edition' || e.source.kind === 'held') this.popJoker(e);
      await sleep((e.source.kind === 'card' || e.source.kind === 'planet' ? 130 : 420) * speed);
    }
    await sleep(250);
  }

  private popJoker(e: Extract<ScoreEvent, { value: number }>) {
    const el = this.root.querySelector<HTMLElement>(`.icard.joker[data-uid="${e.source.id}"]`);
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    const v = Number.isInteger(e.value) ? e.value : e.value.toFixed(1).replace('.', ',');
    const text = e.type === 'chips' ? `+${v} Fichas` : e.type === 'mult' ? `+${v} Mult` : `×${v} Mult`;
    const rect = el.getBoundingClientRect();
    this.floatLabel(text, e.type, rect.left + rect.width / 2, rect.bottom - 8);
  }

  private floatAt(selector: string, text: string, cls: string) {
    const el = this.root.querySelector<HTMLElement>(selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.floatLabel(text, cls, rect.left + rect.width / 2, rect.top);
  }

  private floatLabel(text: string, cls: string, x: number, y: number) {
    const label = document.createElement('div');
    label.className = `float ${cls}`;
    label.textContent = text;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    this.root.appendChild(label);
    setTimeout(() => label.remove(), 1000);
  }

  private discard() {
    const cards = this.table.selectedCards();
    if (!cards.length || this.run.discardsLeft <= 0) return;
    this.busy = true;
    sfx('discard');
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
    this.playErr = sel.length ? this.run.playError(sel) : null;
    if (this.playErr) {
      this.setPreview(MSG_TEXT[this.playErr] ?? t(this.playErr), 0, 0);
    } else if (sel.some((c) => this.run.faceDown.has(c.id))) {
      this.setPreview('???', 0, 0);
    } else if (sel.length) {
      // La vista previa es la puntuación base + cartas (sin jokers), como en el juego original.
      const res = this.run.preview(sel);
      const first = res.events[0];
      let chips = first.chips;
      let mult = first.mult;
      for (const e of res.events) {
        if (e.type === 'hand' || e.source.kind !== 'card') continue;
        if (e.type === 'chips') chips += e.value;
        else if (e.type === 'mult') mult += e.value;
      }
      this.setPreview(HAND_NAME[res.hand], chips, mult);
    } else this.setPreview('', 0, 0);
    this.disableActions(false);
  }

  private disableActions(forceOff: boolean) {
    this.root.querySelector('.actions')?.classList.toggle('away', forceOff);
    const n = this.table.selectedCards().length;
    const play = this.root.querySelector<HTMLButtonElement>('#btn-play');
    const disc = this.root.querySelector<HTMLButtonElement>('#btn-discard');
    if (play) play.disabled = forceOff || n === 0 || this.run.handsLeft <= 0 || !!this.playErr;
    if (disc) disc.disabled = forceOff || n === 0 || this.run.discardsLeft <= 0;
  }

  private setPreview(name: string, chips: number, mult: number) {
    this.setText('pv-name', name || ' ');
    this.setText('pv-chips', String(Math.round(chips)));
    this.setText('pv-mult', Number.isInteger(mult) ? String(mult) : mult.toFixed(1).replace('.', ','));
  }

  /** Sacudida de pantalla (se desactiva con «Reducir movimiento»). */
  private shake(px: number) {
    if (document.documentElement.dataset.rm === '1') return;
    const cv = document.querySelector('canvas');
    if (!cv) return;
    cv.animate(
      [{ transform: 'translate(0,0)' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: 'translate(0,0)' }],
      { duration: 220 },
    );
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

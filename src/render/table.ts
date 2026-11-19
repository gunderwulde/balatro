import * as THREE from 'three';
import type { Card } from '../core/cards';
import type { Run } from '../core/run';
import { backTexture, CARD_H, CARD_W, cardKey, faceTexture } from './cardArt';

export const CW = CARD_W / 32;
export const CH = CARD_H / 32;
/** Escala de las cartas en la mesa de juego. */
export const TABLE_SCALE = 0.75;
/** Las pilas de mazo y descartes, relativas a las cartas de la mesa. */
export const PILE_SCALE = 0.75;

export function makeCardMesh(card: Card): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CW, CH);
  const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: faceTexture(card), transparent: true, alphaTest: 0.5 }));
  const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: backTexture(), transparent: true, alphaTest: 0.5 }));
  back.rotation.y = Math.PI;
  g.add(front, back);
  return g;
}

/** Muelle amortiguado (subamortiguado → pequeño rebote al llegar). */
class Spring {
  v = 0;
  step(x: number, target: number, dt: number, k = 260, c = 22): number {
    this.v += ((target - x) * k - this.v * c) * dt;
    return x + this.v * dt;
  }
}

interface CardObj {
  card: Card;
  key: string;
  group: THREE.Group;
  selected: boolean;
  hover: number;
  base: THREE.Vector3;
  baseRot: number;
  sp: { x: Spring; y: Spring; z: Spring; rx: Spring; ry: Spring; rz: Spring };
}

interface Leaving {
  group: THREE.Group;
  target: THREE.Vector3;
  until: number;
  /** Segunda etapa: tras `until`, vuela a este punto (pila de descarte). */
  after?: THREE.Vector3;
}

const DRAG_THRESHOLD = 8; // px

/** Vista 3D de la mano de la run: sincroniza con `run.hand`, anima con muelles y permite arrastrar/reordenar. */
export class Table {
  onSelectionChange: () => void = () => {};
  enabled = true;
  private root = new THREE.Group();
  private objs: CardObj[] = [];
  private leaving: Leaving[] = [];
  private drawPileMesh: THREE.Group;
  private discardPileMesh: THREE.Group;
  private hovered: CardObj | null = null;
  private pointer = new THREE.Vector2(10, 10);
  private ray = new THREE.Raycaster();
  private abort = new AbortController();
  private pilePos = new THREE.Vector3();
  private discardPos = new THREE.Vector3();
  private lastT = 0;
  private press: { obj: CardObj; x: number; y: number; moved: boolean; grab: THREE.Vector2 } | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private run: Run,
  ) {
    this.drawPileMesh = this.makePile();
    this.discardPileMesh = this.makePile();
    this.root.add(this.drawPileMesh, this.discardPileMesh);
    scene.add(this.root);

    const { signal } = this.abort;
    addEventListener('pointermove', (e) => this.onMove(e), { signal });
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), { signal });
    addEventListener('pointerup', () => this.onUp(), { signal });
    addEventListener('pointercancel', () => (this.press = null), { signal });
    this.layout();
    this.sync();
  }

  private makePile(): THREE.Group {
    const p = makeCardMesh({ id: -1, rank: 14, suit: 'S' });
    p.children[0].visible = false;
    p.scale.setScalar(TABLE_SCALE * PILE_SCALE);
    p.rotation.y = Math.PI;
    return p;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  selectedCards(): Card[] {
    return this.objs.filter((o) => o.selected).map((o) => o.card);
  }

  clearSelection(): void {
    this.objs.forEach((o) => (o.selected = false));
    this.onSelectionChange();
  }

  // ---------------------------------------------------------------- entrada

  private onMove(e: PointerEvent) {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const p = this.press;
    if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD) {
      p.moved = true;
      const wp = this.worldPoint();
      p.grab.set(p.obj.group.position.x - wp.x, p.obj.group.position.y - wp.y);
    }
  }

  private onDown(e: PointerEvent) {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.updateHover();
    if (!this.enabled || !this.hovered) return;
    this.press = { obj: this.hovered, x: e.clientX, y: e.clientY, moved: false, grab: new THREE.Vector2() };
  }

  private onUp() {
    const p = this.press;
    this.press = null;
    if (!p || !this.enabled) return;
    if (p.moved) {
      // Confirma el nuevo orden en el estado de la run.
      this.run.reorderHand(this.objs.map((o) => o.card.id));
      this.layout();
      return;
    }
    const o = p.obj;
    if (o.card.id === this.run.forcedCard) return;
    if (!o.selected && this.selectedCards().length >= 5) return;
    o.selected = !o.selected;
    this.onSelectionChange();
  }

  // ---------------------------------------------------------------- estado

  /** Alinea los objetos 3D con `run.hand` (las cartas nuevas llegan boca abajo desde el mazo). */
  sync(): void {
    const ids = new Set(this.run.hand.map((c) => c.id));
    this.objs = this.objs.filter((o) => {
      const keep = ids.has(o.card.id);
      if (!keep && !this.leaving.some((l) => l.group === o.group)) this.root.remove(o.group);
      return keep;
    });
    const known = new Map(this.objs.map((o) => [o.card.id, o]));
    this.objs = this.run.hand.map((card) => {
      const existing = known.get(card.id);
      if (existing) {
        const key = cardKey(card);
        if (existing.key !== key) {
          // La carta cambió (enhancement, sello, edición, rango…): refresca su cara.
          const mat = (existing.group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.map = faceTexture(card);
          mat.needsUpdate = true;
          existing.key = key;
        }
        return existing;
      }
      const group = makeCardMesh(card);
      group.scale.setScalar(TABLE_SCALE);
      group.position.copy(this.pilePos);
      group.rotation.y = Math.PI;
      this.root.add(group);
      return {
        card, key: cardKey(card), group, selected: false, hover: 0, base: new THREE.Vector3(), baseRot: 0,
        sp: { x: new Spring(), y: new Spring(), z: new Spring(), rx: new Spring(), ry: new Spring(), rz: new Spring() },
      };
    });
    for (const o of this.objs) if (o.card.id === this.run.forcedCard) o.selected = true;
    this.layout();
    this.onSelectionChange();
  }

  /** Saca las cartas de la mano: 'play' al centro (luego a la pila), 'discard' directo a la pila. */
  sendAway(cards: Card[], mode: 'play' | 'discard', now: number): void {
    const set = new Set(cards.map((c) => c.id));
    const out = this.objs.filter((o) => set.has(o.card.id));
    out.forEach((o, i) => {
      const k = i - (out.length - 1) / 2;
      o.selected = false;
      if (mode === 'play') {
        this.leaving.push({
          group: o.group,
          target: new THREE.Vector3(k * (CW * TABLE_SCALE * 0.85), 0.9, 1 + i * 0.01),
          until: now + 1100,
          after: this.discardPos.clone(),
        });
      } else {
        this.leaving.push({ group: o.group, target: this.discardPos.clone(), until: now + 450 });
      }
    });
  }

  layout(): void {
    const n = this.objs.length;
    const edge = this.camera.aspect * 7.56 * 0.5 * 0.86;
    const cardW = CW * TABLE_SCALE;
    // Las cartas de los extremos no deben tocar las pilas: queda un pequeño hueco.
    const pileW = cardW * PILE_SCALE;
    const halfSpan = Math.max(0, edge - (cardW + pileW) / 2 - cardW * 0.15);
    const spacing = Math.min(cardW * 0.7, n > 1 ? (2 * halfSpan) / (n - 1) : Infinity);
    this.objs.forEach((o, i) => {
      const k = i - (n - 1) / 2;
      o.base.set(k * spacing, -2.7 - k * k * 0.03, i * 0.01);
      o.baseRot = -k * 0.04;
    });
    this.pilePos.set(edge, -2.7, 0);
    this.discardPos.set(-edge, -2.7, 0);
    this.drawPileMesh.position.copy(this.pilePos);
    this.discardPileMesh.position.copy(this.discardPos);
    this.updatePiles();
  }

  private updatePiles() {
    this.drawPileMesh.visible = this.run.drawPile.length > 0;
    this.discardPileMesh.visible = this.run.discardPile.length > 0 && this.leaving.length === 0;
  }

  private worldPoint(): THREE.Vector3 {
    const v = new THREE.Vector3(this.pointer.x, this.pointer.y, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const d = -this.camera.position.z / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(d));
  }

  private updateHover() {
    this.ray.setFromCamera(this.pointer, this.camera);
    this.hovered = null;
    if (!this.enabled) return;
    const hits = this.ray.intersectObjects(this.objs.map((o) => o.group), true);
    let best = -1;
    for (const h of hits) {
      const i = this.objs.findIndex((x) => x.group === h.object.parent);
      if (i > best) {
        best = i;
        this.hovered = this.objs[i];
      }
    }
  }

  // ---------------------------------------------------------------- bucle

  update(t: number): void {
    const dt = this.lastT ? Math.min(0.033, (t - this.lastT) / 1000) : 1 / 60;
    this.lastT = t;

    // Cartas que salen de la mano.
    this.leaving = this.leaving.filter((l) => {
      l.group.position.lerp(l.target, 0.18);
      l.group.rotation.x *= 0.85;
      l.group.rotation.y *= 0.85;
      if (t >= l.until) {
        if (l.after) {
          l.target = l.after;
          l.until = t + 380;
          l.after = undefined;
        } else {
          this.root.remove(l.group);
          return false;
        }
      }
      return true;
    });
    this.updatePiles();

    const dragging = this.press?.moved ? this.press.obj : null;
    if (dragging) this.reorderWhileDragging(dragging);

    this.updateHover();
    if (dragging) this.hovered = dragging;
    this.canvas.style.cursor = dragging ? 'grabbing' : this.hovered ? 'pointer' : 'default';

    const wp = this.worldPoint();
    for (const o of this.objs) {
      const isDrag = o === dragging;
      const isHover = o === this.hovered;
      o.hover += ((isHover ? 1 : 0) - o.hover) * 0.2;
      const g = o.group;
      // Cartas debilitadas por un Boss: oscurecidas.
      const front = (g.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const dim = this.run.isDebuffed(o.card) ? 0.35 : 1;
      if (front.color.r !== dim) front.color.setScalar(dim);

      let tx = o.base.x;
      let ty = o.base.y + (o.selected ? 0.9 : 0) + o.hover * 0.35;
      let tz = o.base.z + o.hover * 0.5;
      let trz = o.baseRot;
      let trx = 0;
      let try_ = 0;

      if (isDrag) {
        const grab = this.press!.grab;
        tx = wp.x + grab.x;
        ty = wp.y + grab.y;
        tz = 1.6;
        trz = Math.max(-0.45, Math.min(0.45, (tx - g.position.x) * 0.9));
      } else if (isHover && !this.run.faceDown.has(o.card.id)) {
        const local = g.worldToLocal(wp.clone());
        try_ = local.x * 0.25;
        trx = -local.y * 0.25;
      }

      if (this.run.faceDown.has(o.card.id)) try_ = Math.PI;
      g.position.x = o.sp.x.step(g.position.x, tx, dt);
      g.position.y = o.sp.y.step(g.position.y, ty, dt) + Math.sin(t / 700 + o.card.id) * 0.0015;
      g.position.z = o.sp.z.step(g.position.z, tz, dt);
      g.rotation.x = o.sp.rx.step(g.rotation.x, trx, dt, 220, 20);
      g.rotation.y = o.sp.ry.step(g.rotation.y, try_, dt, 160, 17);
      g.rotation.z = o.sp.rz.step(g.rotation.z, trz, dt, 220, 20);
    }
  }

  /** Mientras se arrastra, recoloca la carta en la posición del abanico más cercana a su x. */
  private reorderWhileDragging(d: CardObj) {
    const x = d.group.position.x;
    const others = this.objs.filter((o) => o !== d);
    const idx = others.filter((o) => o.base.x < x).length;
    const cur = this.objs.indexOf(d);
    if (idx !== cur) {
      this.objs.splice(cur, 1);
      this.objs.splice(idx, 0, d);
      this.layout();
    }
  }

  dispose(): void {
    this.abort.abort();
    this.scene.remove(this.root);
    this.canvas.style.cursor = 'default';
  }
}

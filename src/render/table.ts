import * as THREE from 'three';
import type { Card } from '../core/cards';
import type { Run } from '../core/run';
import { backTexture, CARD_H, CARD_W, faceTexture } from './cardArt';

export const CW = CARD_W / 32;
export const CH = CARD_H / 32;

export function makeCardMesh(card: Card): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CW, CH);
  const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: faceTexture(card), transparent: true, alphaTest: 0.5 }));
  const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: backTexture(), transparent: true, alphaTest: 0.5 }));
  back.rotation.y = Math.PI;
  g.add(front, back);
  return g;
}

interface CardObj {
  card: Card;
  group: THREE.Group;
  selected: boolean;
  hover: number;
  base: THREE.Vector3;
  baseRot: number;
}

interface Leaving {
  group: THREE.Group;
  target: THREE.Vector3;
  until: number;
}

/** Vista 3D de la mano de la run: sincroniza con `run.hand` y anima. */
export class Table {
  onSelectionChange: () => void = () => {};
  private root = new THREE.Group();
  private objs: CardObj[] = [];
  private leaving: Leaving[] = [];
  private pile: THREE.Group;
  private hovered: CardObj | null = null;
  private pointer = new THREE.Vector2(10, 10);
  private ray = new THREE.Raycaster();
  private abort = new AbortController();
  private pilePos = new THREE.Vector3();
  enabled = true;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private run: Run,
  ) {
    this.pile = makeCardMesh({ id: -1, rank: 14, suit: 'S' });
    this.pile.children[0].visible = false;
    this.pile.rotation.y = Math.PI;
    this.root.add(this.pile);
    scene.add(this.root);

    const { signal } = this.abort;
    addEventListener(
      'pointermove',
      (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
      { signal },
    );
    canvas.addEventListener('pointerdown', () => this.click(), { signal });
    this.layout();
    this.sync();
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

  private click() {
    const h = this.hovered;
    if (!h || !this.enabled) return;
    if (!h.selected && this.selectedCards().length >= 5) return;
    h.selected = !h.selected;
    this.onSelectionChange();
  }

  /** Alinea los objetos 3D con `run.hand` (reparto de cartas nuevas desde el mazo). */
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
      if (existing) return existing;
      const group = makeCardMesh(card);
      group.position.copy(this.pilePos);
      group.rotation.y = Math.PI; // llega boca abajo y se voltea
      this.root.add(group);
      return { card, group, selected: false, hover: 0, base: new THREE.Vector3(), baseRot: 0 };
    });
    this.layout();
    this.onSelectionChange();
  }

  /** Saca las cartas de la mano: 'play' al centro, 'discard' fuera por la izquierda. */
  sendAway(cards: Card[], mode: 'play' | 'discard', now: number): void {
    const set = new Set(cards.map((c) => c.id));
    const out = this.objs.filter((o) => set.has(o.card.id));
    out.forEach((o, i) => {
      const k = i - (out.length - 1) / 2;
      const target =
        mode === 'play'
          ? new THREE.Vector3(k * (CW * 0.85), 0.9, 1 + i * 0.01)
          : new THREE.Vector3(-this.camera.aspect * 7.56 * 0.7, -2.5, 0);
      this.leaving.push({ group: o.group, target, until: now + (mode === 'play' ? 1100 : 450) });
      o.selected = false;
    });
  }

  layout(): void {
    const n = this.objs.length;
    const spacing = Math.min(CW * 0.7, (this.camera.aspect * 7.2 * 0.9) / Math.max(n, 1));
    this.objs.forEach((o, i) => {
      const k = i - (n - 1) / 2;
      o.base.set(k * spacing, -2.5 - k * k * 0.04, i * 0.01);
      o.baseRot = -k * 0.04;
    });
    this.pilePos.set(this.camera.aspect * 7.56 * 0.5 * 0.86, -2.5, 0);
    this.pile.position.copy(this.pilePos);
    this.pile.visible = this.run.drawPile.length > 0;
  }

  private worldPoint(): THREE.Vector3 {
    const v = new THREE.Vector3(this.pointer.x, this.pointer.y, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const d = -this.camera.position.z / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(d));
  }

  update(t: number): void {
    // cartas que salen
    this.leaving = this.leaving.filter((l) => {
      l.group.position.lerp(l.target, 0.18);
      l.group.rotation.set(0, 0, l.group.rotation.z * 0.9);
      if (t >= l.until) {
        this.root.remove(l.group);
        return false;
      }
      return true;
    });
    this.pile.visible = this.run.drawPile.length > 0;

    this.ray.setFromCamera(this.pointer, this.camera);
    this.hovered = null;
    if (this.enabled) {
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
    this.canvas.style.cursor = this.hovered ? 'pointer' : 'default';

    for (const o of this.objs) {
      const isHover = o === this.hovered;
      o.hover += ((isHover ? 1 : 0) - o.hover) * 0.2;
      const g = o.group;
      const lift = (o.selected ? 0.9 : 0) + o.hover * 0.35;
      g.position.x += (o.base.x - g.position.x) * 0.2;
      g.position.y += (o.base.y + lift - g.position.y) * 0.2;
      g.position.z = o.base.z + o.hover * 0.5;
      g.rotation.z += (o.baseRot - g.rotation.z) * 0.2;
      let rx = 0;
      let ry = 0;
      if (isHover) {
        const local = g.worldToLocal(this.worldPoint());
        ry = local.x * 0.25;
        rx = -local.y * 0.25;
      }
      g.rotation.x += (rx - g.rotation.x) * 0.2;
      g.rotation.y += (ry - g.rotation.y) * 0.15;
      g.position.y += Math.sin(t / 700 + o.card.id) * 0.0015;
    }
  }

  dispose(): void {
    this.abort.abort();
    this.scene.remove(this.root);
    this.canvas.style.cursor = 'default';
  }
}

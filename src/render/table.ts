import * as THREE from 'three';
import { createDeck, shuffle, type Card } from '../core/cards';
import { Rng } from '../core/rng';
import { scoreHand } from '../core/scoring';
import { HAND_NAME } from '../i18n/es';
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

/** Mesa de juego (demo de mano interactiva; el bucle de ciegas llega en la siguiente fase). */
export class Table {
  private root = new THREE.Group();
  private objs: CardObj[];
  private hovered: CardObj | null = null;
  private pointer = new THREE.Vector2(10, 10);
  private ray = new THREE.Raycaster();
  private hud: HTMLDivElement;
  private abort = new AbortController();

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    seed: string,
    private onExit: () => void,
  ) {
    const deck = shuffle(createDeck(), new Rng(seed));
    this.objs = deck.slice(0, 8).map((card) => {
      const group = makeCardMesh(card);
      this.root.add(group);
      return { card, group, selected: false, hover: 0, base: new THREE.Vector3(), baseRot: 0 };
    });
    scene.add(this.root);

    this.hud = document.createElement('div');
    this.hud.className = 'table-hud';
    this.hud.innerHTML = `<button class="table-back">☰ Menú</button><div class="table-seed">Semilla: ${seed}</div><div class="table-score"></div>`;
    document.body.appendChild(this.hud);
    this.hud.querySelector<HTMLButtonElement>('.table-back')!.onclick = () => this.onExit();

    const { signal } = this.abort;
    addEventListener(
      'pointermove',
      (e) => this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
      { signal },
    );
    canvas.addEventListener('pointerdown', () => this.click(), { signal });
    this.layout();
    this.updateHud();
  }

  private click() {
    const h = this.hovered;
    if (!h) return;
    if (!h.selected && this.objs.filter((o) => o.selected).length >= 5) return;
    h.selected = !h.selected;
    this.updateHud();
  }

  private updateHud() {
    const el = this.hud.querySelector('.table-score')!;
    const sel = this.objs.filter((o) => o.selected).map((o) => o.card);
    if (!sel.length) {
      el.textContent = 'Selecciona hasta 5 cartas';
      return;
    }
    const r = scoreHand(sel);
    el.textContent = `${HAND_NAME[r.hand]}  ${r.chips} chips × ${r.mult} mult = ${r.total}`;
  }

  layout(): void {
    const n = this.objs.length;
    const spacing = Math.min(CW * 0.7, (this.camera.aspect * 7.2 * 0.9) / n);
    this.objs.forEach((o, i) => {
      const k = i - (n - 1) / 2;
      o.base.set(k * spacing, -2.3 - k * k * 0.04, i * 0.01);
      o.baseRot = -k * 0.04;
    });
  }

  private worldPoint(): THREE.Vector3 {
    const v = new THREE.Vector3(this.pointer.x, this.pointer.y, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const d = -this.camera.position.z / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(d));
  }

  update(t: number): void {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.objs.map((o) => o.group), true);
    this.hovered = null;
    let best = -1;
    for (const h of hits) {
      const i = this.objs.findIndex((x) => x.group === h.object.parent);
      if (i > best) {
        best = i;
        this.hovered = this.objs[i];
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
      g.rotation.y += (ry - g.rotation.y) * 0.2;
      g.position.y += Math.sin(t / 700 + o.card.id) * 0.0015;
    }
  }

  dispose(): void {
    this.abort.abort();
    this.scene.remove(this.root);
    this.hud.remove();
    this.canvas.style.cursor = 'default';
  }
}

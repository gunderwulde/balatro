import * as THREE from 'three';
import { createDeck, shuffle, type Card } from './core/cards';
import { Rng } from './core/rng';
import { scoreHand } from './core/scoring';
import { HAND_NAME } from './i18n/es';
import { backTexture, CARD_H, CARD_W, faceTexture } from './render/cardArt';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2b2a);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.z = 12;

const CW = CARD_W / 32;
const CH = CARD_H / 32;

// --- HUD (DOM) ---
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:16px;left:0;right:0;text-align:center;color:#f4efe3;font:700 22px monospace;pointer-events:none;text-shadow:2px 2px #000';
document.body.appendChild(hud);

// --- Cartas ---
interface CardObj {
  card: Card;
  group: THREE.Group;
  selected: boolean;
  hover: number;
  base: THREE.Vector3;
  baseRot: number;
}

function makeCardMesh(card: Card): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(CW, CH);
  const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: faceTexture(card), transparent: true, alphaTest: 0.5 }));
  const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: backTexture(), transparent: true, alphaTest: 0.5 }));
  back.rotation.y = Math.PI;
  g.add(front, back);
  return g;
}

const seed = new URLSearchParams(location.search).get('seed') ?? 'DEMO';
const deck = shuffle(createDeck(), new Rng(seed));
const hand = deck.slice(0, 8);

const objs: CardObj[] = hand.map((card) => {
  const group = makeCardMesh(card);
  scene.add(group);
  return { card, group, selected: false, hover: 0, base: new THREE.Vector3(), baseRot: 0 };
});

function layout() {
  const n = objs.length;
  const spacing = Math.min(CW * 0.7, (camera.aspect * 7.2 * 0.9) / n);
  objs.forEach((o, i) => {
    const k = i - (n - 1) / 2;
    o.base.set(k * spacing, -2.3 - k * k * 0.04, i * 0.01);
    o.baseRot = -k * 0.04;
  });
}

// Mazo (reverso) a la derecha
const pile = makeCardMesh(deck[0]);
pile.children[0].visible = false;
pile.rotation.y = Math.PI;
scene.add(pile);

// --- Interacción ---
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const mouse = new THREE.Vector2();
let hovered: CardObj | null = null;

addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mouse.copy(pointer);
});
addEventListener('pointerdown', () => {
  if (!hovered) return;
  if (!hovered.selected && objs.filter((o) => o.selected).length >= 5) return;
  hovered.selected = !hovered.selected;
  updateHud();
});

function updateHud() {
  const sel = objs.filter((o) => o.selected).map((o) => o.card);
  if (sel.length === 0) {
    hud.textContent = 'Selecciona hasta 5 cartas';
    return;
  }
  const r = scoreHand(sel);
  hud.textContent = `${HAND_NAME[r.hand]}  ${r.chips} chips × ${r.mult} mult = ${r.total}`;
}
updateHud();

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  layout();
  pile.position.set(camera.aspect * 7.56 * 0.5 * 0.85, -2.3, 0);
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(objs.map((o) => o.group), true);
  hovered = null;
  if (hits.length) {
    // la carta más adelantada bajo el cursor
    let best = -1;
    for (const h of hits) {
      const o = objs.find((x) => x.group === h.object.parent);
      if (o && objs.indexOf(o) > best) {
        best = objs.indexOf(o);
        hovered = o;
      }
    }
  }
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';

  for (const o of objs) {
    const isHover = o === hovered;
    o.hover += ((isHover ? 1 : 0) - o.hover) * 0.2;
    const lift = (o.selected ? 0.9 : 0) + o.hover * 0.35;
    const g = o.group;
    g.position.x += (o.base.x - g.position.x) * 0.2;
    g.position.y += (o.base.y + lift - g.position.y) * 0.2;
    g.position.z = o.base.z + o.hover * 0.5;
    g.rotation.z += (o.baseRot - g.rotation.z) * 0.2;
    // inclinación 3D según el cursor sobre la carta
    let rx = 0;
    let ry = 0;
    if (isHover) {
      const local = g.worldToLocal(new THREE.Vector3(...worldPoint()));
      ry = local.x * 0.25;
      rx = -local.y * 0.25;
    }
    g.rotation.x += (rx - g.rotation.x) * 0.2;
    g.rotation.y += (ry - g.rotation.y) * 0.2;
    // balanceo suave de reposo
    g.position.y += Math.sin(t / 700 + o.card.id) * 0.0015;
  }
  renderer.render(scene, camera);
});

/** Punto del plano z=0 bajo el cursor, en mundo. */
function worldPoint(): [number, number, number] {
  const v = new THREE.Vector3(pointer.x, pointer.y, 0.5).unproject(camera);
  const dir = v.sub(camera.position).normalize();
  const d = -camera.position.z / dir.z;
  const p = camera.position.clone().add(dir.multiplyScalar(d));
  return [p.x, p.y, p.z];
}

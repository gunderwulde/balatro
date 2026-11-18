import * as THREE from 'three';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import './ui/menu.css';
import type { Card } from './core/cards';
import { Background, PALETTES } from './render/background';
import { PostFx } from './render/crt';
import { Table, makeCardMesh } from './render/table';
import { Run } from './core/run';
import { GameUI } from './ui/gameUi';
import { MainMenu, randomSeed } from './ui/menu';
import type { Settings } from './ui/settings';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.style.cssText = 'margin:0;height:100%;background:#16302d;overflow:hidden';
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.z = 12;

const post = new PostFx(renderer, scene, camera);
const bg = new Background(PALETTES.menu);
scene.add(bg.mesh);

// --- Cartas flotantes del menú ---
const menuCards = new THREE.Group();
const showcase: Card[] = [
  { id: 0, rank: 14, suit: 'S' },
  { id: 1, rank: 13, suit: 'H' },
  { id: 2, rank: 12, suit: 'D' },
  { id: 3, rank: 11, suit: 'C' },
  { id: 4, rank: 14, suit: 'H' },
];
showcase.forEach((c, i) => {
  const m = makeCardMesh(c);
  const k = i - 2;
  m.position.set(k * 1.25, -Math.abs(k) * 0.15, -Math.abs(k) * 0.01 + i * 0.01);
  m.rotation.z = -k * 0.14;
  m.userData.k = k;
  menuCards.add(m);
});
menuCards.position.y = 1.0;
scene.add(menuCards);

// --- Estado ---
let mode: 'menu' | 'game' = 'menu';
let table: Table | null = null;
let ui: GameUI | null = null;
let reduceMotion = false;
const pointer = new THREE.Vector2();
addEventListener('pointermove', (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));

function startGame(seed: string) {
  table?.dispose();
  ui?.dispose();
  menu.hide();
  mode = 'game';
  menuCards.visible = false;
  bg.setPalette(PALETTES.table);
  const run = new Run(seed);
  table = new Table(scene, camera, renderer.domElement, run);
  ui = new GameUI(run, table, { onExit: exitToMenu, onRestart: () => startGame(randomSeed()) });
}

const menu = new MainMenu({
  onStart: startGame,
  onSettings(s: Settings) {
    post.setCrt(s.scanlines);
    reduceMotion = s.reduceMotion;
    bg.speed = s.reduceMotion ? 0.15 : 1;
  },
});

function exitToMenu() {
  table?.dispose();
  ui?.dispose();
  table = null;
  ui = null;
  mode = 'menu';
  menuCards.visible = true;
  bg.setPalette(PALETTES.menu);
  menu.show();
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  // escala las cartas del menú para que quepan en pantallas estrechas
  const s = Math.min(0.8, camera.aspect * 0.5);
  menuCards.scale.setScalar(s);
  post.resize(innerWidth, innerHeight);
  table?.layout();
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  bg.update(t, camera.aspect);
  if (mode === 'menu') {
    menuCards.children.forEach((m, i) => {
      const k = m.userData.k as number;
      const wob = reduceMotion ? 0 : 1;
      m.position.y = -Math.abs(k) * 0.15 + Math.sin(t / 900 + i) * 0.12 * wob;
      m.rotation.y += (pointer.x * 0.5 - m.rotation.y) * 0.08;
      m.rotation.x += (-pointer.y * 0.3 - m.rotation.x) * 0.08;
    });
  } else {
    table?.update(performance.now());
  }
  post.render();
});

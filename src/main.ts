import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2b2a);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.z = 12;

// Carta placeholder (71x95 proporción Balatro)
const card = new THREE.Mesh(
  new THREE.PlaneGeometry(71 / 40, 95 / 40),
  new THREE.MeshBasicMaterial({ color: 0xf2efe6, side: THREE.DoubleSide }),
);
scene.add(card);

// Inclinación 3D según cursor
const target = new THREE.Vector2();
addEventListener('pointermove', (e) => {
  target.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  card.rotation.y += (target.x * 0.5 - card.rotation.y) * 0.1;
  card.rotation.x += (target.y * 0.5 - card.rotation.x) * 0.1;
  card.position.y = Math.sin(t / 800) * 0.1;
  renderer.render(scene, camera);
});

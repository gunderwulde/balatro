import * as THREE from 'three';

/** Fondo swirl pixelado estilo Balatro (shader a pantalla completa). */
const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uSpeed;

void main() {
  // pixelado: ~150 filas
  vec2 res = vec2(150.0 * uAspect, 150.0);
  vec2 uv = floor(vUv * res) / res;
  uv = (uv - 0.5) * vec2(uAspect, 1.0) * 2.0;

  float r = length(uv);
  float ang = atan(uv.y, uv.x) + r * 2.2 + uTime * 0.15 * uSpeed;
  vec2 p = vec2(cos(ang), sin(ang)) * r * 2.4;
  float t = uTime * uSpeed;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    p += 0.55 * vec2(sin(p.y * 1.7 + t * 0.5 + fi), cos(p.x * 1.5 + t * 0.4 + fi * 1.3));
  }
  float v = 0.5 + 0.5 * sin(p.x + p.y + t * 0.3);
  float band = floor(v * 4.0) / 4.0;
  vec3 col = mix(uC1, uC2, band);
  col = mix(col, uC3, smoothstep(0.55, 1.0, v) * 0.6);
  col *= 1.0 - 0.35 * smoothstep(0.7, 1.7, r); // viñeta
  gl_FragColor = vec4(col, 1.0);
}`;

export interface BackgroundPalette {
  c1: number;
  c2: number;
  c3: number;
}

export const PALETTES = {
  menu: { c1: 0x16302d, c2: 0x2f6b5f, c3: 0xc9553b },
  table: { c1: 0x16302d, c2: 0x1f4a42, c3: 0x2d6a5c },
} satisfies Record<string, BackgroundPalette>;

export class Background {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  speed = 1;

  constructor(palette: BackgroundPalette = PALETTES.menu) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uSpeed: { value: 1 },
        uC1: { value: new THREE.Color(palette.c1) },
        uC2: { value: new THREE.Color(palette.c2) },
        uC3: { value: new THREE.Color(palette.c3) },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  setPalette(p: BackgroundPalette): void {
    this.mat.uniforms.uC1.value.set(p.c1);
    this.mat.uniforms.uC2.value.set(p.c2);
    this.mat.uniforms.uC3.value.set(p.c3);
  }

  update(timeMs: number, aspect: number): void {
    this.mat.uniforms.uTime.value = timeMs / 1000;
    this.mat.uniforms.uAspect.value = aspect;
    this.mat.uniforms.uSpeed.value = this.speed;
  }
}

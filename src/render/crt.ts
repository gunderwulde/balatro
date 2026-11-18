import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Filtro CRT: curvatura de barril, aberración cromática, scanlines y viñeta. */
const CrtShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform vec2 uRes;
    varying vec2 vUv;

    vec2 curve(vec2 uv) {
      uv = uv * 2.0 - 1.0;
      vec2 off = abs(uv.yx) / vec2(7.0, 5.0);
      uv += uv * off * off;
      return uv * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = mix(vUv, curve(vUv), uAmount);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec2 ca = (uv - 0.5) * 0.0025 * uAmount;
      vec3 col = vec3(
        texture2D(tDiffuse, uv + ca).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - ca).b
      );
      float scan = 0.5 + 0.5 * sin(uv.y * uRes.y * 1.5707963 * 2.0);
      col *= mix(1.0, 0.86 + 0.14 * scan, uAmount);
      float vig = smoothstep(0.95, 0.35, length((uv - 0.5) * vec2(1.0, 0.85)));
      col *= mix(1.0, 0.65 + 0.35 * vig, uAmount);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** Cadena de post-proceso: escena → CRT (opcional) → salida sRGB. */
export class PostFx {
  private composer: EffectComposer;
  private crt: ShaderPass;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.crt = new ShaderPass(CrtShader);
    this.composer.addPass(this.crt);
    this.composer.addPass(new OutputPass());
  }

  setCrt(on: boolean): void {
    this.crt.uniforms.uAmount.value = on ? 1 : 0;
  }

  resize(w: number, h: number): void {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.crt.uniforms.uRes.value.set(w * pr, h * pr);
  }

  render(): void {
    this.composer.render();
  }
}

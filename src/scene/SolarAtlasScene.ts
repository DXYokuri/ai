import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getPlanet, planets } from '../domain/planetData';
import type { AtlasMode, PlanetKey, PlanetRecord } from '../domain/types';
import { createRenderPlan } from './renderPlan';
import { renderTone } from './renderTone';

interface SceneSyncState {
  authorityMode: boolean;
  mode: AtlasMode;
  selectedPlanet: PlanetKey | null;
}

interface PlanetNode {
  key: PlanetKey;
  group: THREE.Group;
  surface: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  outlineLight?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  cloudLayer?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  nightLayer?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  finalRadius: number;
  basePosition: THREE.Vector3;
  baseScale: number;
  floatPhase: number;
  rotationSpeed: number;
}

interface AuthorityPlanetProfile {
  lightCenter: [number, number];
  lightScale: [number, number];
  shadowBias: number;
  brightness: number;
  guideSeed: number;
}

const authorityPlanetProfiles: Record<PlanetKey, AuthorityPlanetProfile> = {
  sun: {
    lightCenter: [0.62, 0.42],
    lightScale: [0.42, 0.64],
    shadowBias: -0.08,
    brightness: 0.52,
    guideSeed: 119
  },
  mercury: {
    lightCenter: [0.56, 0.46],
    lightScale: [0.46, 0.72],
    shadowBias: 0.02,
    brightness: 0.62,
    guideSeed: 211
  },
  venus: {
    lightCenter: [0.6, 0.48],
    lightScale: [0.5, 0.68],
    shadowBias: 0.04,
    brightness: 0.58,
    guideSeed: 307
  },
  earth: {
    lightCenter: [0.64, 0.43],
    lightScale: [0.55, 0.72],
    shadowBias: 0.08,
    brightness: 0.66,
    guideSeed: 401
  },
  mars: {
    lightCenter: [0.58, 0.54],
    lightScale: [0.5, 0.64],
    shadowBias: 0.01,
    brightness: 0.6,
    guideSeed: 503
  },
  jupiter: {
    lightCenter: [0.66, 0.42],
    lightScale: [0.62, 0.52],
    shadowBias: 0.1,
    brightness: 0.54,
    guideSeed: 617
  },
  saturn: {
    lightCenter: [0.6, 0.38],
    lightScale: [0.58, 0.56],
    shadowBias: 0.06,
    brightness: 0.56,
    guideSeed: 719
  },
  uranus: {
    lightCenter: [0.52, 0.48],
    lightScale: [0.44, 0.76],
    shadowBias: -0.02,
    brightness: 0.55,
    guideSeed: 823
  },
  neptune: {
    lightCenter: [0.57, 0.44],
    lightScale: [0.5, 0.68],
    shadowBias: 0.02,
    brightness: 0.57,
    guideSeed: 929
  }
};

const atmosphereVertex = `
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const atmosphereFragment = `
uniform vec3 glowColor;
uniform float intensity;
uniform vec3 lightDirection;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
  float sunlight = smoothstep(-0.1, 0.95, dot(normal, normalize(lightDirection)));
  float alpha = pow(rim, 3.2) * intensity * mix(0.08, 0.82, sunlight);
  gl_FragColor = vec4(glowColor, alpha);
}
`;

const authorityFragmentVertex = `
attribute vec3 instancePosition;
attribute vec3 instanceScatter;
attribute vec2 instanceScale;
attribute vec2 instanceUvCenter;
attribute vec2 instanceUvSize;
attribute float instanceRotation;
attribute float instanceAlpha;
attribute float instanceDepth;
attribute float instanceTint;
attribute float instanceFloatPhase;
attribute float instanceMotion;

uniform float uProgress;
uniform float uTime;

varying vec2 vFragmentUv;
varying float vFragmentAlpha;
varying float vFragmentDepth;
varying float vFragmentTint;
varying float vCircularClip;

void main() {
  float motionWeight = uProgress * instanceMotion;
  float driftPhase = uTime * (0.18 + instanceMotion * 0.12) + instanceFloatPhase;
  float counterPhase = uTime * (0.14 + instanceMotion * 0.08) + instanceFloatPhase * 1.37;
  float rotation = instanceRotation + sin(driftPhase * 0.52) * 0.018 * uProgress;
  float c = cos(rotation);
  float s = sin(rotation);
  vec2 local = vec2(
    position.x * c - position.y * s,
    position.x * s + position.y * c
  ) * instanceScale;
  vec2 planarScatter = instanceScatter.xy * uProgress;
  vec2 planarDrift = vec2(
    sin(driftPhase) * 0.012,
    cos(counterPhase) * 0.01
  ) * motionWeight;
  vec3 flatAuthorityPlane = vec3(instancePosition.xy + planarScatter + planarDrift + local, 0.0);
  float circularClip = length(flatAuthorityPlane.xy / vec2(1.18, 1.08));

  vFragmentUv = instanceUvCenter + (uv - 0.5) * instanceUvSize;
  vFragmentAlpha = instanceAlpha;
  vFragmentDepth = abs(instanceDepth);
  vFragmentTint = instanceTint;
  vCircularClip = circularClip;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(flatAuthorityPlane, 1.0);
}
`;

const authorityFragmentShader = `
uniform sampler2D planetTexture;
uniform float uOpacity;
uniform float uProgress;
uniform vec2 uAuthorityLightCenter;
uniform vec2 uAuthorityLightScale;
uniform float uAuthorityShadowBias;
uniform float uAuthorityBrightness;

varying vec2 vFragmentUv;
varying float vFragmentAlpha;
varying float vFragmentDepth;
varying float vFragmentTint;
varying float vCircularClip;

vec4 sampleFragment(vec2 uv, float blur) {
  vec4 center = texture2D(planetTexture, uv);
  vec4 xSample = texture2D(planetTexture, uv + vec2(blur, 0.0));
  vec4 ySample = texture2D(planetTexture, uv + vec2(0.0, blur));
  return mix(center, (center + xSample + ySample) / 3.0, smoothstep(0.05, 0.55, blur * 240.0));
}

void main() {
  float blur = clamp(vFragmentDepth * 0.0018 * uProgress, 0.0, 0.0045);
  vec4 sampleColor = sampleFragment(vFragmentUv, blur);
  float luma = dot(sampleColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec2 authorityUv = (vFragmentUv - uAuthorityLightCenter) / max(uAuthorityLightScale, vec2(0.001));
  float authorityLightMask = 1.0 - smoothstep(0.26, 1.0, length(authorityUv));
  float diagonalTerminator = smoothstep(
    -0.18,
    0.7,
    (vFragmentUv.x - uAuthorityLightCenter.x) * 1.18 - (vFragmentUv.y - uAuthorityLightCenter.y) * 0.42 + uAuthorityShadowBias
  );
  float localTextureSignal = smoothstep(0.06, 0.84, luma);
  float authorityTone = mix(0.08, 1.08, authorityLightMask * 0.76 + diagonalTerminator * 0.24);
  authorityTone *= uAuthorityBrightness * mix(0.52, 1.18, localTextureSignal);
  vec3 monochromeTexture = vec3(pow(luma, 1.12));
  vec3 recoveredWhite = monochromeTexture * authorityTone;
  recoveredWhite += vec3(0.035) * authorityLightMask * localTextureSignal;
  vec3 restrictedRed = mix(recoveredWhite, vec3(1.0, 0.05, 0.025), vFragmentTint * 0.62);
  float alpha = uOpacity * vFragmentAlpha * smoothstep(0.0, 0.16, luma + 0.09);
  alpha *= 1.0 - smoothstep(0.96, 1.025, vCircularClip);
  alpha *= mix(0.72, 1.0, 1.0 - smoothstep(0.45, 1.25, vFragmentDepth));
  gl_FragColor = vec4(restrictedRed, alpha);
}
`;

const lightDirection = new THREE.Vector3(-1.35, 0.58, 0.92).normalize();

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createAuthorityFallbackTexture(): THREE.DataTexture {
  const width = 16;
  const height = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = 42 + Math.round((x / width) * 128 + Math.sin(y * 1.8) * 22);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class SolarAtlasScene {
  private readonly container: HTMLElement;
  private readonly onSelectPlanet: (planetKey: PlanetKey) => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bokehPass: BokehPass;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly planetNodes = new Map<PlanetKey, PlanetNode>();
  private readonly pickables: THREE.Object3D[] = [];
  private readonly planetColorTextures = new Map<PlanetKey, THREE.Texture>();
  private readonly ambientGroup = new THREE.Group();
  private readonly detailGroup = new THREE.Group();
  private readonly authorityGroup = new THREE.Group();
  private readonly authorityGuideGroup = new THREE.Group();
  private readonly authorityMaterials: THREE.Material[] = [];
  private readonly authorityGuideMaterials: THREE.LineBasicMaterial[] = [];
  private readonly authorityFallbackTexture = createAuthorityFallbackTexture();
  private readonly authorityFragmentOpacity = { value: 0 };
  private readonly authorityFragmentProgress = { value: 0 };
  private readonly authorityFragmentTime = { value: 0 };
  private readonly authorityGuideFlip = { value: 0 };
  private authorityFragmentMaterial: THREE.ShaderMaterial | null = null;
  private authorityFragmentMesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> | null = null;
  private authorityDustMaterial: THREE.PointsMaterial | null = null;
  private backgroundMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private currentMode: AtlasMode = 'overview';
  private currentAuthorityMode = false;
  private authorityActive = false;
  private authorityTextureKey: PlanetKey | null = null;
  private selectedPlanet: PlanetKey | null = null;
  private overviewCameraZ = 15.5;
  private overviewCameraY = 1.4;
  private transitionTimeline: gsap.core.Timeline | null = null;
  private authorityTimeline: gsap.core.Timeline | null = null;

  constructor(container: HTMLElement, onSelectPlanet: (planetKey: PlanetKey) => void) {
    this.container = container;
    this.onSelectPlanet = onSelectPlanet;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050506, 0.018);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, this.overviewCameraY, this.overviewCameraZ);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = renderTone.exposure;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.85));
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 8.0,
      aperture: 0.00016,
      maxblur: 0.004
    });
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);
    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        renderTone.bloom.strength,
        renderTone.bloom.radius,
        renderTone.bloom.threshold
      )
    );
    this.composer.addPass(new OutputPass());

    this.addLighting();
    this.addAmbientSystem();
    this.addPlanets();
    this.addDetailSystem();
    this.addAuthoritySystem();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.animate();
  }

  sync(state: SceneSyncState): void {
    const nextAuthorityMode = state.authorityMode && state.mode !== 'overview' && Boolean(state.selectedPlanet);
    const previousSelectedPlanet = this.selectedPlanet;

    if (
      state.mode === this.currentMode &&
      state.selectedPlanet === this.selectedPlanet &&
      nextAuthorityMode === this.currentAuthorityMode
    ) {
      return;
    }

    this.currentMode = state.mode;

    if (state.selectedPlanet) {
      this.selectedPlanet = state.selectedPlanet;
    }

    if (state.mode === 'transition-in' && state.selectedPlanet && !this.authorityActive) {
      this.focusPlanet(state.selectedPlanet);
    }

    if (state.mode === 'transition-out' && !nextAuthorityMode) {
      if (this.authorityActive || this.currentAuthorityMode || this.authorityGroup.visible) {
        this.exitAuthorityModeToOverview();
      } else {
        this.setAuthorityMode(false);
      }
      this.returnToOverview();
    }

    if (state.mode === 'overview') {
      this.selectedPlanet = null;
      this.applyOverviewPose();
      this.currentAuthorityMode = false;
      return;
    }

    if (nextAuthorityMode !== this.currentAuthorityMode || previousSelectedPlanet !== this.selectedPlanet) {
      this.setAuthorityMode(nextAuthorityMode, previousSelectedPlanet !== this.selectedPlanet, previousSelectedPlanet);
    }

    this.currentAuthorityMode = nextAuthorityMode;
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    this.transitionTimeline?.kill();
    this.authorityTimeline?.kill();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.dispose();
    this.composer.dispose();
    this.scene.traverse((object) => {
      if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
        object.geometry.dispose();
      }

      if ('material' in object) {
        const material = object.material;

        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else if (material instanceof THREE.Material) {
          material.dispose();
        }
      }
    });
    this.renderer.domElement.remove();
  }

  private addLighting(): void {
    const sunLight = new THREE.DirectionalLight(0xffffff, renderTone.lights.sunIntensity);
    sunLight.position.copy(lightDirection.clone().multiplyScalar(9.5));
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x9fd7ff, renderTone.lights.rimIntensity);
    rimLight.position.set(5.5, 2.6, -7.5);
    this.scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0x8da1b7, renderTone.lights.ambientIntensity);
    this.scene.add(ambient);
  }

  private addAmbientSystem(): void {
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 8;
    const gradientContext = gradientCanvas.getContext('2d');

    if (gradientContext) {
      const gradient = gradientContext.createLinearGradient(0, 0, gradientCanvas.width, 0);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.48, '#020202');
      gradient.addColorStop(0.68, '#242424');
      gradient.addColorStop(0.88, '#686868');
      gradient.addColorStop(1, '#aaaaaa');
      gradientContext.fillStyle = gradient;
      gradientContext.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

      const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
      gradientTexture.colorSpace = THREE.SRGBColorSpace;
      this.backgroundMaterial = new THREE.MeshBasicMaterial({
        map: gradientTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false
      });
      const backgroundPlane = new THREE.Mesh(new THREE.PlaneGeometry(64, 34), this.backgroundMaterial);
      backgroundPlane.position.set(0, 0, -26);
      backgroundPlane.renderOrder = -1000;
      this.scene.add(backgroundPlane);
    }

    this.scene.add(this.ambientGroup);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let index = 0; index < starCount; index += 1) {
      const offset = index * 3;
      positions[offset] = (Math.random() - 0.5) * 28;
      positions[offset + 1] = (Math.random() - 0.5) * 13;
      positions[offset + 2] = -4 - Math.random() * 18;

      const color = index % 4 === 0 ? 0.42 : 0.72;
      colors[offset] = color;
      colors[offset + 1] = color;
      colors[offset + 2] = color + 0.08;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 0.017,
        vertexColors: true,
        transparent: true,
      opacity: 0.62,
        depthWrite: false
      })
    );
    this.ambientGroup.add(stars);

    for (let radius = 2.4; radius <= 8.4; radius += 1.2) {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.36, 0, Math.PI * 2);
      const points = curve.getPoints(192).map((point) => new THREE.Vector3(point.x, -0.08, point.y));
      const orbit = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.026
        })
      );
      orbit.rotation.x = -0.22;
      this.ambientGroup.add(orbit);
    }
  }

  private addPlanets(): void {
    const renderPlan = createRenderPlan(planets);

    for (const plan of renderPlan) {
      const planet = getPlanet(plan.key);
      const group = new THREE.Group();
      group.position.set(plan.x, plan.y, plan.z);
      group.userData.planetKey = plan.key;

      const surface = new THREE.Mesh(
        new THREE.SphereGeometry(plan.radius, 96, 64),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(planet.color),
          roughness: planet.key === 'earth' ? 0.48 : 0.82,
          metalness: planet.key === 'earth' ? 0.08 : 0.02,
          emissive: new THREE.Color(planet.key === 'sun' ? planet.accent : '#000000'),
          emissiveIntensity: planet.key === 'sun' ? renderTone.materials.sunEmissiveIntensity : 0
        })
      );
      surface.renderOrder = 10;
      this.applyCinematicSurfaceShader(surface.material, planet);
      this.loadPlanetTextures(planet, surface.material);
      group.add(surface);

      const pickVolume = new THREE.Mesh(
        new THREE.SphereGeometry(plan.pickRadius, 24, 16),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      pickVolume.userData.planetKey = plan.key;
      group.add(pickVolume);
      this.pickables.push(pickVolume);

      const atmosphere = this.createAtmosphere(plan.radius, planet);
      group.add(atmosphere);

      const outlineLight = planet.key === 'sun' ? this.createSunOutline(plan.radius, planet) : undefined;
      if (outlineLight) {
        group.add(outlineLight);
      }

      const cloudLayer = planet.textures.clouds ? this.createCloudLayer(plan.radius, planet) : undefined;
      if (cloudLayer) {
        group.add(cloudLayer);
      }

      const nightLayer = planet.textures.night ? this.createNightLayer(plan.radius, planet) : undefined;
      if (nightLayer) {
        group.add(nightLayer);
      }

      if (planet.textures.ring) {
        group.add(this.createSaturnRing(plan.radius, planet));
      }

      this.scene.add(group);
      this.planetNodes.set(plan.key, {
        key: plan.key,
        group,
        surface,
        atmosphere,
        outlineLight,
        cloudLayer,
        nightLayer,
        finalRadius: plan.radius,
        basePosition: group.position.clone(),
        baseScale: 1,
        floatPhase: plan.floatPhase,
        rotationSpeed: plan.rotationSpeed
      });
    }
  }

  private addDetailSystem(): void {
    this.detailGroup.visible = false;
    this.detailGroup.position.set(0, 0, 0);
    this.scene.add(this.detailGroup);

    for (let index = 0; index < 5; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.72 + index * 0.28, 0.002, 8, 220),
        new THREE.MeshBasicMaterial({
          color: 0xf4fbff,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      ring.name = 'scan-ring';
      ring.rotation.x = Math.PI / 2 + index * 0.12;
      ring.rotation.y = index * 0.29;
      this.detailGroup.add(ring);
    }

    for (let index = 0; index < 7; index += 1) {
      const points = [
        new THREE.Vector3(-2.15 + index * 0.08, -0.88 + index * 0.18, 0),
        new THREE.Vector3(-1.15 + index * 0.06, -0.42 + index * 0.11, 0),
        new THREE.Vector3(1.12 - index * 0.04, 0.34 - index * 0.1, 0),
        new THREE.Vector3(2.18 - index * 0.05, 0.78 - index * 0.16, 0)
      ];
      const dataLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: 0xeaf8ff,
          transparent: true,
          opacity: 0,
          depthWrite: false
        })
      );
      dataLine.name = 'data-line';
      dataLine.rotation.z = -0.08 + index * 0.025;
      this.detailGroup.add(dataLine);
    }
  }

  private addAuthoritySystem(): void {
    this.authorityGroup.name = 'authority-flat-spherical-pixel-map';
    this.authorityGroup.visible = false;
    this.authorityGroup.position.set(0, 0, 0.08);
    this.scene.add(this.authorityGroup);
    this.authorityGuideGroup.name = 'authority-flat-geometric-guides';
    this.authorityGuideGroup.position.set(0, 0, 0.04);
    this.authorityGroup.add(this.authorityGuideGroup);

    const random = seededRandom(90210);
    const gridSize = 72;
    const maxFragments = gridSize * gridSize;
    const fragmentPositions = new Float32Array(maxFragments * 3);
    const fragmentScatter = new Float32Array(maxFragments * 3);
    const fragmentScales = new Float32Array(maxFragments * 2);
    const fragmentUvCenters = new Float32Array(maxFragments * 2);
    const fragmentUvSizes = new Float32Array(maxFragments * 2);
    const fragmentRotations = new Float32Array(maxFragments);
    const fragmentAlpha = new Float32Array(maxFragments);
    const fragmentDepth = new Float32Array(maxFragments);
    const fragmentTint = new Float32Array(maxFragments);
    const fragmentFloatPhase = new Float32Array(maxFragments);
    const fragmentMotion = new Float32Array(maxFragments);
    let fragmentCount = 0;

    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const normalizedX = column / (gridSize - 1) - 0.5;
        const normalizedY = row / (gridSize - 1) - 0.5;
        const localX = normalizedX * 2.12 + (random() - 0.5) * 0.012;
        const localY = -normalizedY * 2.12 + (random() - 0.5) * 0.012;
        const sphereSilhouette = Math.sqrt((localX * localX) / 1.16 + (localY * localY) / 1.16);
        const clippedX = Math.max(-0.98, Math.min(0.98, localX / 1.12));
        const clippedY = Math.max(-0.98, Math.min(0.98, localY / 1.12));
        const erosion = sphereSilhouette > 0.94 ? 0.18 : sphereSilhouette < 0.32 ? 0.05 : 0.075;
        const verticalDataTear = localX < -0.78 && localY > -0.55 && localY < 0.72 && random() > 0.78;
        const signalGap = localX > 0.46 && localY > -0.08 && localY < 0.48 && random() > 0.82;

        if (sphereSilhouette > 1.015 || random() < erosion || verticalDataTear || signalGap) {
          continue;
        }

        const index = row * gridSize + column;
        const edgeWeight = Math.max(0, sphereSilhouette - 0.58) / 0.44;
        const deconstructed = random() > (sphereSilhouette > 0.76 ? 0.74 : 0.9);
        const dataBlock = random() > 0.86;
        const planarPixelBlock = 0.009 + random() * 0.024;
        const write3 = fragmentCount * 3;
        const write2 = fragmentCount * 2;

        fragmentPositions[write3] = localX;
        fragmentPositions[write3 + 1] = localY;
        fragmentPositions[write3 + 2] = 0;
        fragmentScatter[write3] = deconstructed
          ? localX * (0.025 + edgeWeight * 0.085) + (random() - 0.5) * 0.12
          : (random() - 0.5) * 0.014;
        fragmentScatter[write3 + 1] = deconstructed
          ? localY * (0.02 + edgeWeight * 0.065) + (random() - 0.5) * 0.1
          : (random() - 0.5) * 0.012;
        fragmentScatter[write3 + 2] = 0;

        const baseWidth = dataBlock ? 0.03 + random() * 0.052 : planarPixelBlock;
        fragmentScales[write2] = baseWidth * (dataBlock ? 0.86 + random() * 0.42 : 0.82 + random() * 0.26);
        fragmentScales[write2 + 1] = baseWidth * (dataBlock ? 0.76 + random() * 0.38 : 0.82 + random() * 0.24);

        fragmentUvCenters[write2] = 0.5 + Math.asin(clippedX) / Math.PI;
        fragmentUvCenters[write2 + 1] = 0.5 - Math.asin(clippedY) / Math.PI;
        fragmentUvSizes[write2] = 0.012 + random() * 0.052;
        fragmentUvSizes[write2 + 1] = fragmentUvSizes[write2] * (0.52 + random() * 0.9);
        fragmentRotations[fragmentCount] = (random() - 0.5) * 0.075;
        fragmentAlpha[fragmentCount] = 0.52 + random() * 0.48;
        fragmentDepth[fragmentCount] = sphereSilhouette;
        fragmentTint[fragmentCount] =
          index % 137 === 0 || (localX < -0.18 && localX > -0.56 && Math.abs(localY) < 0.42 && random() > 0.94) ? 1 : 0;
        fragmentFloatPhase[fragmentCount] = random() * Math.PI * 2;
        fragmentMotion[fragmentCount] = deconstructed ? 0.68 + random() * 0.54 : 0.22 + random() * 0.36;
        fragmentCount += 1;
      }
    }

    const sourcePlane = new THREE.PlaneGeometry(1, 1, 1, 1);
    const fragmentGeometry = new THREE.InstancedBufferGeometry();
    fragmentGeometry.setIndex(sourcePlane.index);
    fragmentGeometry.setAttribute('position', sourcePlane.attributes.position);
    fragmentGeometry.setAttribute('uv', sourcePlane.attributes.uv);
    fragmentGeometry.setAttribute(
      'instancePosition',
      new THREE.InstancedBufferAttribute(fragmentPositions.slice(0, fragmentCount * 3), 3)
    );
    fragmentGeometry.setAttribute(
      'instanceScatter',
      new THREE.InstancedBufferAttribute(fragmentScatter.slice(0, fragmentCount * 3), 3)
    );
    fragmentGeometry.setAttribute(
      'instanceScale',
      new THREE.InstancedBufferAttribute(fragmentScales.slice(0, fragmentCount * 2), 2)
    );
    fragmentGeometry.setAttribute(
      'instanceUvCenter',
      new THREE.InstancedBufferAttribute(fragmentUvCenters.slice(0, fragmentCount * 2), 2)
    );
    fragmentGeometry.setAttribute(
      'instanceUvSize',
      new THREE.InstancedBufferAttribute(fragmentUvSizes.slice(0, fragmentCount * 2), 2)
    );
    fragmentGeometry.setAttribute(
      'instanceRotation',
      new THREE.InstancedBufferAttribute(fragmentRotations.slice(0, fragmentCount), 1)
    );
    fragmentGeometry.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(fragmentAlpha.slice(0, fragmentCount), 1));
    fragmentGeometry.setAttribute('instanceDepth', new THREE.InstancedBufferAttribute(fragmentDepth.slice(0, fragmentCount), 1));
    fragmentGeometry.setAttribute('instanceTint', new THREE.InstancedBufferAttribute(fragmentTint.slice(0, fragmentCount), 1));
    fragmentGeometry.setAttribute(
      'instanceFloatPhase',
      new THREE.InstancedBufferAttribute(fragmentFloatPhase.slice(0, fragmentCount), 1)
    );
    fragmentGeometry.setAttribute('instanceMotion', new THREE.InstancedBufferAttribute(fragmentMotion.slice(0, fragmentCount), 1));
    fragmentGeometry.instanceCount = fragmentCount;
    sourcePlane.dispose();

    this.authorityFragmentMaterial = new THREE.ShaderMaterial({
      vertexShader: authorityFragmentVertex,
      fragmentShader: authorityFragmentShader,
      uniforms: {
        planetTexture: { value: this.authorityFallbackTexture },
        uOpacity: this.authorityFragmentOpacity,
        uProgress: this.authorityFragmentProgress,
        uTime: this.authorityFragmentTime,
        uAuthorityLightCenter: { value: new THREE.Vector2(0.64, 0.43) },
        uAuthorityLightScale: { value: new THREE.Vector2(0.55, 0.72) },
        uAuthorityShadowBias: { value: 0.08 },
        uAuthorityBrightness: { value: 0.66 }
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.FrontSide
    });
    this.authorityFragmentMaterial.depthTest = false;
    const textureFragments: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> = new THREE.Mesh(
      fragmentGeometry,
      this.authorityFragmentMaterial
    );
    textureFragments.name = 'authority-texture-fragment-field';
    textureFragments.userData.basePosition = new THREE.Vector3(0, 0, 0);
    textureFragments.userData.floatPhase = 0.4;
    this.authorityFragmentMesh = textureFragments;
    this.authorityGroup.add(textureFragments);

    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 980;
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);

    for (let index = 0; index < dustCount; index += 1) {
      const offset = index * 3;
      const theta = random() * Math.PI * 2;
      const radius = 0.18 + random() * 1.42;
      const flattened = random() > 0.72;
      positions[offset] = Math.cos(theta) * radius * (flattened ? 1.38 : 1);
      positions[offset + 1] = Math.sin(theta) * radius * (flattened ? 0.52 : 1);
      positions[offset + 2] = 0;

      const red = index % 89 === 0;
      colors[offset] = red ? 1 : 0.76 + random() * 0.24;
      colors[offset + 1] = red ? 0.1 : colors[offset];
      colors[offset + 2] = red ? 0.08 : colors[offset];
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const dustMaterial = new THREE.PointsMaterial({
      size: 0.012,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.authorityDustMaterial = dustMaterial;
    this.authorityMaterials.push(dustMaterial);
    const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
    dustPoints.name = 'authority-data-dust-field';
    dustPoints.userData.basePosition = new THREE.Vector3(0, 0, 0);
    dustPoints.userData.floatPhase = 2.8;
    this.authorityGroup.add(dustPoints);
  }

  private createAtmosphere(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
    const baseIntensity = planet.key === 'sun' ? renderTone.atmosphere.sunIntensity : renderTone.atmosphere.planetIntensity;
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * (planet.key === 'sun' ? 1.06 : 1.045), 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          glowColor: { value: new THREE.Color(planet.accent) },
          lightDirection: { value: lightDirection },
          intensity: { value: baseIntensity }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    atmosphere.renderOrder = 14;
    atmosphere.userData.baseIntensity = baseIntensity;
    return atmosphere;
  }

  private createSunOutline(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
    const sunOutline = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.065, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          glowColor: { value: new THREE.Color(planet.accent) },
          lightDirection: { value: lightDirection },
          intensity: { value: renderTone.atmosphere.sunOutlineIntensity }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    sunOutline.name = 'sun-silhouette-outline-light';
    sunOutline.renderOrder = 13;
    sunOutline.userData.baseIntensity = renderTone.atmosphere.sunOutlineIntensity;
    return sunOutline;
  }

  private applyCinematicSurfaceShader(material: THREE.MeshStandardMaterial, planet: PlanetRecord): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.atlasLightDirection = { value: lightDirection };
      shader.uniforms.atlasShadowFloor = {
        value: planet.key === 'sun' ? 0.72 : renderTone.surface.shadowFloor
      };
      shader.uniforms.atlasTerminatorSoftness = { value: renderTone.surface.terminatorSoftness };
      shader.uniforms.atlasEdgeDarkening = {
        value: planet.key === 'sun' ? 0.04 : renderTone.surface.edgeDarkening
      };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vAtlasWorldNormal;
varying vec3 vAtlasWorldPosition;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
vAtlasWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
vec4 atlasWorldPosition = modelMatrix * vec4(transformed, 1.0);
vAtlasWorldPosition = atlasWorldPosition.xyz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 atlasLightDirection;
uniform float atlasShadowFloor;
uniform float atlasTerminatorSoftness;
uniform float atlasEdgeDarkening;
varying vec3 vAtlasWorldNormal;
varying vec3 vAtlasWorldPosition;`
        )
        .replace(
          '#include <dithering_fragment>',
          `vec3 atlasNormal = normalize(vAtlasWorldNormal);
vec3 atlasView = normalize(cameraPosition - vAtlasWorldPosition);
float atlasLight = dot(atlasNormal, normalize(atlasLightDirection));
float atlasTerminator = smoothstep(-0.42, atlasTerminatorSoftness, atlasLight);
float atlasRim = pow(1.0 - max(dot(atlasNormal, atlasView), 0.0), 1.35);
float atlasShade = mix(atlasShadowFloor, 1.0, atlasTerminator);
atlasShade *= mix(1.0, 1.0 - atlasEdgeDarkening, atlasRim);
gl_FragColor.rgb *= atlasShade;
#include <dithering_fragment>`
        );
    };
    material.needsUpdate = true;
  }

  private createCloudLayer(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: renderTone.materials.cloudOpacity,
      roughness: 0.96,
      depthWrite: false
    });
    this.loadTexture(planet.textures.clouds, (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    });

    const cloudLayer = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.034, 96, 64), material);
    cloudLayer.renderOrder = 13;
    return cloudLayer;
  }

  private createNightLayer(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
    const material = new THREE.MeshBasicMaterial({
      color: 0xdff6ff,
      transparent: true,
      opacity: renderTone.materials.nightOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.loadTexture(planet.textures.night, (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    });

    const nightLayer = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.018, 96, 64), material);
    nightLayer.renderOrder = 12;
    return nightLayer;
  }

  private createSaturnRing(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial> {
    const material = new THREE.MeshStandardMaterial({
      color: 0xf3e7cc,
      transparent: true,
      opacity: renderTone.materials.saturnRingOpacity,
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.loadTexture(planet.textures.ring, (texture) => {
      material.map = texture;
      material.alphaMap = texture;
      material.needsUpdate = true;
    });

    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.05, 192), material);
    ring.renderOrder = 12;
    ring.rotation.x = Math.PI / 2.25;
    ring.rotation.y = -0.22;
    return ring;
  }

  private loadPlanetTextures(planet: PlanetRecord, material: THREE.MeshStandardMaterial): void {
    this.loadTexture(planet.textures.color, (texture) => {
      this.planetColorTextures.set(planet.key, texture);
      material.map = texture;
      material.needsUpdate = true;

      if (this.selectedPlanet === planet.key) {
        this.updateAuthorityTexture(planet.key);
      }
    });

    this.loadTexture(planet.textures.normal, (texture) => {
      material.normalMap = texture;
      material.normalScale = new THREE.Vector2(0.42, 0.42);
      material.needsUpdate = true;
    });

    this.loadTexture(planet.textures.roughness, (texture) => {
      if (planet.key === 'earth') {
        material.roughnessMap = texture;
        material.metalnessMap = texture;
      } else {
        material.roughnessMap = texture;
      }

      material.needsUpdate = true;
    });
  }

  private loadTexture(url: string | undefined, onLoad: (texture: THREE.Texture) => void): void {
    if (!url) {
      return;
    }

    void fetch(url, { cache: 'force-cache', mode: 'cors' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Texture request failed: ${response.status}`);
        }

        return response.blob();
      })
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        const texture = new THREE.Texture(bitmap);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
        texture.needsUpdate = true;
        onLoad(texture);
      })
      .catch(() => undefined);
  }

  private updateAuthorityTexture(key: PlanetKey | null): void {
    if (!this.authorityFragmentMaterial || !key) {
      return;
    }

    const nodeTexture = this.planetNodes.get(key)?.surface.material.map ?? null;
    this.authorityFragmentMaterial.uniforms.planetTexture.value =
      this.planetColorTextures.get(key) ?? nodeTexture ?? this.authorityFallbackTexture;
    this.applyAuthorityProfile(key);
    this.buildAuthorityGuidesForPlanet(key);
    this.authorityTextureKey = key;
  }

  private applyAuthorityProfile(key: PlanetKey): void {
    if (!this.authorityFragmentMaterial) {
      return;
    }

    const profile = authorityPlanetProfiles[key];
    this.authorityFragmentMaterial.uniforms.uAuthorityLightCenter.value.set(
      profile.lightCenter[0],
      profile.lightCenter[1]
    );
    this.authorityFragmentMaterial.uniforms.uAuthorityLightScale.value.set(profile.lightScale[0], profile.lightScale[1]);
    this.authorityFragmentMaterial.uniforms.uAuthorityShadowBias.value = profile.shadowBias;
    this.authorityFragmentMaterial.uniforms.uAuthorityBrightness.value = profile.brightness;
  }

  private buildAuthorityGuidesForPlanet(key: PlanetKey): void {
    this.authorityGuideGroup.clear();
    for (const material of this.authorityGuideMaterials) {
      material.dispose();
    }
    this.authorityGuideMaterials.length = 0;

    const profile = authorityPlanetProfiles[key];
    const random = seededRandom(profile.guideSeed);
    const guideCount = 7 + (profile.guideSeed % 4);

    for (let index = 0; index < guideCount; index += 1) {
      const isTriangle = (index + profile.guideSeed) % 3 === 0;
      const size = 0.11 + random() * 0.22;
      const material = new THREE.LineBasicMaterial({
        color: index % 5 === 0 ? 0xff2d2d : 0xffffff,
        transparent: true,
        opacity: this.authorityActive ? (index % 5 === 0 ? 0.34 : 0.42) : 0,
        depthTest: false,
        depthWrite: false
      });
      this.authorityGuideMaterials.push(material);

      let guideGeometry: THREE.BufferGeometry;
      if (isTriangle) {
        const triangleShape = new THREE.Shape([
          new THREE.Vector2(0, size * 0.56),
          new THREE.Vector2(-size * 0.54, -size * 0.42),
          new THREE.Vector2(size * 0.54, -size * 0.42)
        ]);
        const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
        guideGeometry = new THREE.EdgesGeometry(triangleGeometry);
        triangleGeometry.dispose();
      } else {
        const squarePlane = new THREE.PlaneGeometry(size, size);
        guideGeometry = new THREE.EdgesGeometry(squarePlane);
        squarePlane.dispose();
      }

      const guideMesh = new THREE.LineSegments(guideGeometry, material);
      const angle = random() * Math.PI * 2;
      const radius = 0.76 + random() * 0.74;
      guideMesh.name = 'authority-geometric-guide';
      guideMesh.position.set(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.72, 0.06);
      guideMesh.rotation.z = Math.round(random() * 3) * (Math.PI / 2);
      guideMesh.renderOrder = 21;
      this.authorityGuideGroup.add(guideMesh);
    }
  }

  private focusPlanet(key: PlanetKey): void {
    this.transitionTimeline?.kill();
    this.detailGroup.visible = true;

    const target = this.planetNodes.get(key);

    if (!target) {
      return;
    }

    const planet = getPlanet(key);
    const targetRadius = renderTone.layout.detailPlanetRadius;
    const targetScale = targetRadius / target.finalRadius;
    this.transitionTimeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    if (this.backgroundMaterial) {
      this.transitionTimeline.to(this.backgroundMaterial, { opacity: 0.1, duration: 0.9 }, 0);
    }
    this.transitionTimeline.to(this.camera.position, { z: 8.2, y: 0.68, duration: 0.68 }, 0);
    this.transitionTimeline.to(this.ambientGroup.rotation, { y: -0.24, duration: 1.4 }, 0);

    for (const node of this.planetNodes.values()) {
      if (node.key === key) {
        this.transitionTimeline.to(node.group.position, { x: 0, y: 0, z: 0, duration: 1.05 }, 0);
        this.transitionTimeline.to(
          node.group.scale,
          { x: targetScale, y: targetScale, z: targetScale, duration: 1.28 },
          0.16
        );
        this.setNodeVisibility(node, 1, 0.58);
      } else {
        this.transitionTimeline.to(node.group.position, { y: -1.8, z: -1.2, duration: 0.82 }, 0);
        this.transitionTimeline.to(
          node.group.scale,
          {
            x: renderTone.layout.inactivePlanetScale,
            y: renderTone.layout.inactivePlanetScale,
            z: renderTone.layout.inactivePlanetScale,
            duration: 0.82
          },
          0
        );
        this.setNodeVisibility(node, 0.09, 0.78);
      }
    }

    this.detailGroup.scale.setScalar(targetRadius / 1.34);
    this.transitionTimeline.to(this.detailGroup.rotation, { y: this.detailGroup.rotation.y + Math.PI * 0.72, duration: 1.3 }, 0.12);
    this.detailGroup.children.forEach((child, index) => {
      const material = (child as THREE.Mesh).material;

      if (material instanceof THREE.Material) {
        const opacity = child.name === 'data-line' ? renderTone.detailOverlay.dataLineOpacity : renderTone.detailOverlay.scanRingOpacity;
        this.transitionTimeline?.to(
          material,
          {
            opacity: index === 0 ? renderTone.detailOverlay.orbitOpacity : opacity,
            duration: 0.42
          },
          0.48 + index * 0.1
        );
      }
    });
  }

  private returnToOverview(): void {
    this.transitionTimeline?.kill();
    this.transitionTimeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    if (this.backgroundMaterial) {
      this.transitionTimeline.to(this.backgroundMaterial, { opacity: 0.95, duration: 1.1 }, 0);
    }
    this.transitionTimeline.to(
      this.camera.position,
      { z: this.overviewCameraZ, y: this.overviewCameraY, duration: 1.1 },
      0
    );
    this.transitionTimeline.to(this.ambientGroup.rotation, { y: 0, duration: 1.1 }, 0);

    for (const node of this.planetNodes.values()) {
      this.transitionTimeline.to(
        node.group.position,
        { x: node.basePosition.x, y: node.basePosition.y, z: node.basePosition.z, duration: 1.1 },
        0
      );
      this.transitionTimeline.to(node.group.scale, { x: 1, y: 1, z: 1, duration: 1.1 }, 0);
      this.setNodeVisibility(node, 1, 1.1);
    }

    this.detailGroup.children.forEach((child) => {
      const material = (child as THREE.Mesh).material;

      if (material instanceof THREE.Material) {
        this.transitionTimeline?.to(material, { opacity: 0, duration: 0.42 }, 0);
      }
    });
    this.transitionTimeline.call(() => {
      this.detailGroup.visible = false;
    });
  }

  private applyOverviewPose(): void {
    this.resetAuthorityModeForOverview();

    for (const node of this.planetNodes.values()) {
      node.group.position.copy(node.basePosition);
      node.group.scale.setScalar(node.baseScale);
      this.applyNodeVisibility(node, 1);
    }

    this.camera.position.set(0, this.overviewCameraY, this.overviewCameraZ);
    if (this.backgroundMaterial) {
      this.backgroundMaterial.opacity = 0.95;
    }
    this.hideDetailOrbitLayerImmediately();
  }

  private resetAuthorityModeForOverview(): void {
    this.authorityTimeline?.kill();
    this.authorityTimeline = null;
    this.authorityActive = false;
    this.currentAuthorityMode = false;
    this.authorityTextureKey = null;
    this.authorityFragmentOpacity.value = 0;
    this.authorityFragmentProgress.value = 0;
    this.authorityGuideFlip.value = 0;
    this.authorityGroup.visible = false;
    this.authorityGroup.rotation.set(0, 0, 0);
    this.authorityGroup.scale.setScalar(1);
    this.authorityFragmentMesh?.scale.set(1, 1, 1);
    this.hideDetailOrbitLayerImmediately();

    for (const material of this.authorityMaterials) {
      material.opacity = 0;
    }

    for (const material of this.authorityGuideMaterials) {
      material.opacity = 0;
    }
  }

  private setAuthorityMode(active: boolean, force = false, previousPlanet: PlanetKey | null = this.authorityTextureKey): void {
    if (active === this.authorityActive && !force) {
      return;
    }

    const wasAuthorityActive = this.authorityActive;
    this.authorityActive = active;
    this.authorityTimeline?.kill();
    this.authorityGroup.visible = true;
    this.bokehPass.enabled = false;
    this.authorityTimeline = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

    if (
      active &&
      wasAuthorityActive &&
      force &&
      this.selectedPlanet &&
      previousPlanet &&
      previousPlanet !== this.selectedPlanet
    ) {
      this.transitionAuthorityPlanet(previousPlanet, this.selectedPlanet);
      return;
    }

    if (active) {
      this.updateAuthorityTexture(this.selectedPlanet);
      this.authorityGuideFlip.value = 0;
      this.authorityGroup.rotation.set(0, 0, 0);
      this.authorityGroup.scale.setScalar(0.9);
      this.authorityFragmentMesh?.scale.set(1, 1, 1);
      this.authorityTimeline.to(this.authorityGroup.scale, { x: 1.08, y: 1.08, z: 1, duration: 1.05 }, 0);
      this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0.94, duration: 0.96 }, 0.06);
      this.authorityTimeline.to(this.authorityFragmentProgress, { value: 1, duration: 1.08 }, 0);

      for (const material of this.authorityMaterials) {
        this.authorityTimeline.to(material, { opacity: 0.62, duration: 0.95 }, 0.08);
      }

      for (const material of this.authorityGuideMaterials) {
        this.authorityTimeline.to(material, { opacity: material.color.getHex() === 0xff2d2d ? 0.34 : 0.42, duration: 0.95 }, 0.08);
      }

      for (const node of this.planetNodes.values()) {
        if (node.key === this.selectedPlanet) {
          this.tweenSurfaceOpacity(node.surface, 0, 0.78, this.authorityTimeline);
          this.tweenAtmosphereVisibility(node, 0, 0.78, this.authorityTimeline);

          if (node.cloudLayer) {
            this.tweenTransparentLayerOpacity(node.cloudLayer.material, 0, 0.78, this.authorityTimeline);
          }

          if (node.nightLayer) {
            this.tweenTransparentLayerOpacity(node.nightLayer.material, 0, 0.78, this.authorityTimeline);
          }
          continue;
        }

        this.setNodeVisibility(node, 0.012, 0.78, this.authorityTimeline);
      }

      this.hideDetailOrbitLayerForAuthority();

      if (this.backgroundMaterial) {
        this.authorityTimeline.to(this.backgroundMaterial, { opacity: 0.035, duration: 0.82 }, 0);
      }

      return;
    }

    if (!active && this.selectedPlanet) {
      this.focusPlanet(this.selectedPlanet);
    }

    this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0, duration: 0.78 }, 0);
    this.authorityTimeline.to(this.authorityFragmentProgress, { value: 0, duration: 0.9 }, 0);

    for (const material of this.authorityMaterials) {
      this.authorityTimeline.to(material, { opacity: 0, duration: 0.72 }, 0);
    }

    for (const material of this.authorityGuideMaterials) {
      this.authorityTimeline.to(material, { opacity: 0, duration: 0.72 }, 0);
    }

    for (const node of this.planetNodes.values()) {
      const opacity = node.key === this.selectedPlanet ? 1 : 0.09;
      this.setNodeVisibility(node, opacity, 0.9, this.authorityTimeline);
    }

    this.getDetailMaterials().forEach((material, index) => {
      const opacity =
        material.name === 'data-line-material'
          ? renderTone.detailOverlay.dataLineOpacity
          : index === 0
            ? renderTone.detailOverlay.orbitOpacity
            : renderTone.detailOverlay.scanRingOpacity;
      this.authorityTimeline?.to(material, { opacity, duration: 0.78 }, 0.1);
    });

    if (this.backgroundMaterial) {
      this.authorityTimeline.to(this.backgroundMaterial, { opacity: 0.1, duration: 0.82 }, 0);
    }

    this.authorityTimeline.call(() => {
      if (!this.authorityActive) {
        this.authorityGroup.visible = false;
        this.authorityTextureKey = null;
      }
    });
  }

  private hideDetailOrbitLayerForAuthority(): void {
    const timeline = this.authorityTimeline;

    if (!timeline) {
      this.detailGroup.visible = false;
      return;
    }

    this.detailGroup.visible = true;

    for (const material of this.getDetailMaterials()) {
      timeline.to(material, { opacity: 0, duration: 0.28 }, 0);
    }

    timeline.call(() => {
      if (this.authorityActive) {
        this.detailGroup.visible = false;
      }
    }, undefined, 0.3);
  }

  private exitAuthorityModeToOverview(): void {
    this.authorityTimeline?.kill();
    this.authorityActive = false;
    this.currentAuthorityMode = false;
    this.hideDetailOrbitLayerImmediately();
    this.authorityGroup.visible = true;
    this.bokehPass.enabled = false;
    this.authorityTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } });

    this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0, duration: 0.46 }, 0);
    this.authorityTimeline.to(this.authorityFragmentProgress, { value: 0, duration: 0.62 }, 0);
    this.authorityTimeline.to(this.authorityGroup.scale, { x: 0.92, y: 0.92, z: 1, duration: 0.56 }, 0);

    for (const material of this.authorityMaterials) {
      this.authorityTimeline.to(material, { opacity: 0, duration: 0.42 }, 0);
    }

    for (const material of this.authorityGuideMaterials) {
      this.authorityTimeline.to(material, { opacity: 0, duration: 0.42 }, 0);
    }

    this.authorityTimeline.call(() => {
      if (!this.authorityActive && !this.currentAuthorityMode) {
        this.authorityGroup.visible = false;
        this.authorityGroup.scale.setScalar(1);
        this.authorityTextureKey = null;
        this.authorityGuideFlip.value = 0;
      }
    }, undefined, 0.64);
  }

  private hideDetailOrbitLayerImmediately(): void {
    this.detailGroup.visible = false;

    for (const material of this.getDetailMaterials()) {
      material.opacity = 0;
      material.needsUpdate = true;
    }
  }

  private transitionAuthorityPlanet(currentPlanet: PlanetKey, nextPlanet: PlanetKey): void {
    if (!this.authorityTimeline || !this.authorityFragmentMaterial || !this.authorityFragmentMesh) {
      this.updateAuthorityTexture(nextPlanet);
      return;
    }

    const currentOrder = getPlanet(currentPlanet).order;
    const nextOrder = getPlanet(nextPlanet).order;
    const direction = nextOrder > currentOrder ? -1 : 1;
    this.authorityGuideFlip.value = 0;
    this.authorityFragmentMesh.scale.set(1, 1, 1);

    this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0.06, duration: 0.36, ease: 'power2.in' }, 0);
    this.authorityTimeline.to(this.authorityFragmentProgress, { value: 0.68, duration: 0.38, ease: 'power2.inOut' }, 0);
    this.authorityTimeline.to(this.authorityFragmentMesh.scale, { x: 0.84, y: 0.84, z: 1, duration: 0.38, ease: 'power2.in' }, 0);
    this.authorityTimeline.to(this.authorityGuideFlip, { value: direction * 0.5, duration: 0.38, ease: 'power2.in' }, 0);
    this.authorityTimeline.call(() => {
      this.updateAuthorityTexture(this.selectedPlanet);
      this.authorityFragmentMesh?.scale.set(0.9, 0.9, 1);
    }, undefined, 0.38);
    this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0.94, duration: 0.58, ease: 'power2.out' }, 0.38);
    this.authorityTimeline.to(this.authorityFragmentProgress, { value: 1, duration: 0.62, ease: 'power2.out' }, 0.38);
    this.authorityTimeline.to(this.authorityFragmentMesh.scale, { x: 1, y: 1, z: 1, duration: 0.62, ease: 'power2.out' }, 0.38);
    this.authorityTimeline.to(this.authorityGuideFlip, { value: direction, duration: 0.42, ease: 'power2.out' }, 0.38);
    this.authorityTimeline.call(() => {
      this.authorityGuideFlip.value = 0;
      this.authorityFragmentMesh?.scale.set(1, 1, 1);
      this.authorityGuideGroup.children.forEach((guideMesh) => {
        guideMesh.rotation.y = 0;
      });
    }, undefined, 1);
  }

  private setNodeVisibility(
    node: PlanetNode,
    visibility: number,
    duration: number,
    timeline: gsap.core.Timeline | null = this.transitionTimeline
  ): void {
    if (visibility >= 0.999) {
      this.applySurfaceOpacity(node.surface, 1);
    } else {
      this.tweenSurfaceOpacity(node.surface, visibility, duration, timeline);
    }
    this.tweenAtmosphereVisibility(node, visibility, duration, timeline);

    if (node.outlineLight) {
      this.tweenOutlineVisibility(node.outlineLight, visibility, duration, timeline);
    }

    if (node.cloudLayer) {
      const cloudOpacity = renderTone.materials.cloudOpacity * visibility;
      this.tweenTransparentLayerOpacity(node.cloudLayer.material, cloudOpacity, duration, timeline);
    }

    if (node.nightLayer) {
      const nightOpacity = renderTone.materials.nightOpacity * visibility;
      this.tweenTransparentLayerOpacity(node.nightLayer.material, nightOpacity, duration, timeline);
    }
  }

  private applyNodeVisibility(node: PlanetNode, visibility: number): void {
    this.applySurfaceOpacity(node.surface, visibility);
    this.applyAtmosphereVisibility(node, visibility);

    if (node.outlineLight) {
      this.applyOutlineVisibility(node.outlineLight, visibility);
    }

    if (node.cloudLayer) {
      this.applyTransparentLayerOpacity(node.cloudLayer.material, renderTone.materials.cloudOpacity * visibility);
    }

    if (node.nightLayer) {
      this.applyTransparentLayerOpacity(node.nightLayer.material, renderTone.materials.nightOpacity * visibility);
    }
  }

  private tweenSurfaceOpacity(
    surface: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>,
    opacity: number,
    duration: number,
    timeline: gsap.core.Timeline | null
  ): void {
    if (opacity >= 0.999 && surface.material.opacity >= 0.999) {
      this.applySurfaceOpacity(surface, 1);
      return;
    }

    surface.material.transparent = true;
    surface.material.depthWrite = false;
    surface.material.needsUpdate = true;

    if (!timeline) {
      this.applySurfaceOpacity(surface, opacity);
      return;
    }

    timeline.to(
      surface.material,
      {
        opacity,
        duration,
        onComplete: () => this.applySurfaceOpacity(surface, opacity)
      },
      0
    );
  }

  private applySurfaceOpacity(
    surface: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>,
    opacity: number
  ): void {
    surface.material.opacity = opacity;

    if (opacity >= 0.999) {
      surface.material.transparent = false;
      surface.material.depthWrite = true;
    } else {
      surface.material.transparent = true;
      surface.material.depthWrite = false;
    }

    surface.material.needsUpdate = true;
  }

  private tweenTransparentLayerOpacity(
    material: THREE.Material,
    opacity: number,
    duration: number,
    timeline: gsap.core.Timeline | null
  ): void {
    this.applyTransparentLayerRenderState(material);

    if (!timeline) {
      this.applyTransparentLayerOpacity(material, opacity);
      return;
    }

    timeline.to(material, { opacity, duration }, 0);
  }

  private applyTransparentLayerOpacity(material: THREE.Material, opacity: number): void {
    this.applyTransparentLayerRenderState(material);
    material.opacity = opacity;
  }

  private applyTransparentLayerRenderState(material: THREE.Material): void {
    material.transparent = true;
    material.depthWrite = false;
    material.needsUpdate = true;
  }

  private tweenAtmosphereVisibility(
    node: PlanetNode,
    visibility: number,
    duration: number,
    timeline: gsap.core.Timeline | null
  ): void {
    const uniform = node.atmosphere.material.uniforms.intensity;
    const baseIntensity = Number(node.atmosphere.userData.baseIntensity ?? uniform.value);

    if (!timeline) {
      uniform.value = baseIntensity * visibility;
      return;
    }

    timeline.to(uniform, { value: baseIntensity * visibility, duration }, 0);
  }

  private applyAtmosphereVisibility(node: PlanetNode, visibility: number): void {
    const uniform = node.atmosphere.material.uniforms.intensity;
    const baseIntensity = Number(node.atmosphere.userData.baseIntensity ?? uniform.value);
    uniform.value = baseIntensity * visibility;
  }

  private tweenOutlineVisibility(
    outlineLight: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>,
    visibility: number,
    duration: number,
    timeline: gsap.core.Timeline | null
  ): void {
    const uniform = outlineLight.material.uniforms.intensity;
    const baseIntensity = Number(outlineLight.userData.baseIntensity ?? uniform.value);

    if (!timeline) {
      uniform.value = baseIntensity * visibility;
      return;
    }

    timeline.to(uniform, { value: baseIntensity * visibility, duration }, 0);
  }

  private applyOutlineVisibility(
    outlineLight: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>,
    visibility: number
  ): void {
    const uniform = outlineLight.material.uniforms.intensity;
    const baseIntensity = Number(outlineLight.userData.baseIntensity ?? uniform.value);
    uniform.value = baseIntensity * visibility;
  }

  private getDetailMaterials(): THREE.Material[] {
    const materials: THREE.Material[] = [];

    this.detailGroup.children.forEach((child) => {
      const material = (child as THREE.Mesh).material;

      if (material instanceof THREE.Material) {
        if (child.name === 'data-line') {
          material.name = 'data-line-material';
        }
        materials.push(material);
      }
    });

    return materials;
  }

  private resize(): void {
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    const compactLandscapeFactor = THREE.MathUtils.clamp(
      (720 - height) / 360 + Math.max(0, width / height - 2.2) * 0.22,
      0,
      1
    );

    this.overviewCameraZ = THREE.MathUtils.lerp(15.5, 12.8, compactLandscapeFactor);
    this.overviewCameraY = THREE.MathUtils.lerp(1.4, 0.86, compactLandscapeFactor);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);

    if (this.currentMode === 'overview') {
      this.camera.position.set(0, this.overviewCameraY, this.overviewCameraZ);
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.currentMode === 'detail') {
      return;
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    const planetKey = (hit?.object.userData.planetKey ?? hit?.object.parent?.userData.planetKey) as PlanetKey | undefined;

    if (planetKey) {
      this.onSelectPlanet(planetKey);
    }
  };

  private animate = (): void => {
    const elapsed = this.clock.getElapsedTime();

    for (const node of this.planetNodes.values()) {
      node.surface.rotation.y += node.rotationSpeed;

      if (node.cloudLayer) {
        node.cloudLayer.rotation.y += node.rotationSpeed * 1.32;
      }

      if (this.currentMode === 'overview') {
        node.group.position.y = node.basePosition.y + Math.sin(elapsed * 0.58 + node.floatPhase) * 0.12;
        node.group.position.x = node.basePosition.x + Math.sin(elapsed * 0.22 + node.floatPhase) * 0.04;
      }
    }

    this.detailGroup.rotation.z = Math.sin(elapsed * 0.22) * 0.06;
    if (this.authorityGroup.visible) {
      this.authorityFragmentTime.value = elapsed;
      this.authorityGroup.rotation.z = Math.sin(elapsed * 0.1) * 0.006;
      this.authorityGroup.children.forEach((child) => {
        const basePosition = child.userData.basePosition as THREE.Vector3 | undefined;

        if (basePosition) {
          const phase = (child.userData.floatPhase as number | undefined) ?? 0;
          const isDust = child.name === 'authority-data-dust-field';
          const xAmplitude = isDust ? 0.018 : 0.008;
          const yAmplitude = isDust ? 0.014 : 0.006;
          child.position.x = basePosition.x + Math.sin(elapsed * (isDust ? 0.22 : 0.16) + phase) * xAmplitude;
          child.position.y = basePosition.y + Math.cos(elapsed * (isDust ? 0.18 : 0.14) + phase) * yAmplitude;
          child.rotation.z = Math.sin(elapsed * (isDust ? 0.12 : 0.08) + phase) * (isDust ? 0.012 : 0.006);
        }
      });
      this.authorityGuideGroup.children.forEach((guideMesh) => {
        guideMesh.rotation.y = this.authorityGuideFlip.value * Math.PI;

        if (this.authorityGuideFlip.value === 0) {
          guideMesh.rotation.y = 0;
        }
      });
    }
    this.ambientGroup.rotation.z = Math.sin(elapsed * 0.035) * 0.015;
    this.camera.lookAt(0, 0, 0);
    this.composer.render();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  };
}

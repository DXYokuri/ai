import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { atlasTargets, getPlanet, isHiddenTarget } from '../domain/planetData';
import type { AtlasMode, AtlasTargetKey, PlanetRecord } from '../domain/types';
import { createRenderPlan } from './renderPlan';
import { renderTone } from './renderTone';
import { chooseClosestQueueTarget, type QueuePickTarget } from './queuePicking';

interface SceneSyncState {
  queueMode: boolean;
  mode: AtlasMode;
  selectedPlanet: AtlasTargetKey | null;
}

interface PlanetNode {
  key: AtlasTargetKey;
  group: THREE.Group;
  surface: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  atmosphereScatter: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  outlineLight?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  cloudLayer?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  nightLayer?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  finalRadius: number;
  basePosition: THREE.Vector3;
  baseScale: number;
  floatPhase: number;
  rotationSpeed: number;
}

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
uniform float rimPower;
uniform float backlightFloor;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  float rim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
  float sunlightDot = dot(normal, normalize(lightDirection));
  float arcCrown = smoothstep(-0.18, 0.82, sunlightDot);
  float alpha = pow(rim, rimPower) * intensity * mix(backlightFloor, 1.0, arcCrown);
  gl_FragColor = vec4(glowColor, alpha);
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

export class SolarAtlasScene {
  private readonly container: HTMLElement;
  private readonly onSelectPlanet: (planetKey: AtlasTargetKey) => void;
  private readonly onReturn: () => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bokehPass: BokehPass;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly planetNodes = new Map<AtlasTargetKey, PlanetNode>();
  private readonly pickables: THREE.Object3D[] = [];
  private readonly ambientGroup = new THREE.Group();
  private readonly detailGroup = new THREE.Group();
  private readonly queueDomeLight = new THREE.HemisphereLight(
    0xe7f4ff,
    0x050608,
    renderTone.lights.domeDetailIntensity
  );
  private backgroundMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private currentMode: AtlasMode = 'overview';
  private currentQueueMode = false;
  private queueActive = false;
  private selectedPlanet: AtlasTargetKey | null = null;
  private overviewCameraZ = 15.5;
  private overviewCameraY = 1.4;
  private portraitActive = false;
  private transitionTimeline: gsap.core.Timeline | null = null;
  private queueTimeline: gsap.core.Timeline | null = null;

  constructor(container: HTMLElement, onSelectPlanet: (planetKey: AtlasTargetKey) => void, onReturn: () => void) {
    this.container = container;
    this.onSelectPlanet = onSelectPlanet;
    this.onReturn = onReturn;
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

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.animate();
  }

  sync(state: SceneSyncState): void {
    const nextQueueMode = state.queueMode && state.mode !== 'overview' && Boolean(state.selectedPlanet);
    const previousSelectedPlanet = this.selectedPlanet;

    if (
      state.mode === this.currentMode &&
      state.selectedPlanet === this.selectedPlanet &&
      nextQueueMode === this.currentQueueMode
    ) {
      return;
    }

    this.currentMode = state.mode;

    if (state.selectedPlanet) {
      this.selectedPlanet = state.selectedPlanet;
    }

    if (state.mode === 'transition-in' && state.selectedPlanet && !nextQueueMode) {
      this.focusPlanet(state.selectedPlanet);
    }

    if (state.mode === 'transition-out' && !nextQueueMode) {
      this.setQueueMode(false);
      this.returnToOverview();
    }

    if (state.mode === 'overview') {
      this.selectedPlanet = null;
      this.applyOverviewPose();
      this.currentQueueMode = false;
      return;
    }

    if (nextQueueMode !== this.currentQueueMode || previousSelectedPlanet !== this.selectedPlanet) {
      this.setQueueMode(nextQueueMode, previousSelectedPlanet !== this.selectedPlanet);
    }

    this.currentQueueMode = nextQueueMode;
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    this.transitionTimeline?.kill();
    this.queueTimeline?.kill();
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

    this.queueDomeLight.position.set(0, 8, 0);
    this.scene.add(this.queueDomeLight);
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
    const renderPlan = createRenderPlan(atlasTargets);

    for (const plan of renderPlan) {
      const planet = getPlanet(plan.key);
      const group = new THREE.Group();
      group.position.set(plan.x, plan.y, plan.z);
      group.userData.planetKey = plan.key;
      group.visible = !isHiddenTarget(plan.key);

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
      const atmosphereScatter = this.createAtmosphereScatter(plan.radius, planet);
      group.add(atmosphereScatter);

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
        atmosphereScatter,
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

  private createAtmosphere(radius: number, planet: PlanetRecord): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
    const baseIntensity = planet.key === 'sun' ? renderTone.atmosphere.sunIntensity : renderTone.atmosphere.planetIntensity;
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * (planet.key === 'sun' ? 1.052 : 1.032), 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          glowColor: { value: new THREE.Color(planet.accent) },
          lightDirection: { value: lightDirection },
          intensity: { value: baseIntensity },
          rimPower: { value: 4.8 },
          backlightFloor: { value: 0.018 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    atmosphere.renderOrder = 14;
    atmosphere.userData.baseIntensity = baseIntensity;
    atmosphere.userData.overviewIntensity = baseIntensity;
    atmosphere.userData.detailIntensity =
      planet.key === 'sun' ? renderTone.atmosphere.sunIntensity : renderTone.atmosphere.innerDetailIntensity;
    atmosphere.userData.queueIntensity =
      Number(atmosphere.userData.detailIntensity) * renderTone.atmosphere.queueIntensityScale;
    return atmosphere;
  }

  private createAtmosphereScatter(
    radius: number,
    planet: PlanetRecord
  ): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
    const overviewIntensity =
      planet.key === 'sun' ? renderTone.atmosphere.sunIntensity * 0.34 : renderTone.atmosphere.planetIntensity * 0.38;
    const detailIntensity =
      planet.key === 'sun' ? renderTone.atmosphere.sunIntensity * 0.42 : renderTone.atmosphere.outerDetailIntensity;
    const atmosphereScatter = new THREE.Mesh(
      new THREE.SphereGeometry(radius * (planet.key === 'sun' ? 1.075 : 1.068), 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          glowColor: { value: new THREE.Color(planet.accent) },
          lightDirection: { value: lightDirection },
          intensity: { value: overviewIntensity },
          rimPower: { value: 2.25 },
          backlightFloor: { value: 0.006 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    atmosphereScatter.name = 'atmosphere-outer-scatter';
    atmosphereScatter.renderOrder = 13;
    atmosphereScatter.userData.baseIntensity = overviewIntensity;
    atmosphereScatter.userData.overviewIntensity = overviewIntensity;
    atmosphereScatter.userData.detailIntensity = detailIntensity;
    atmosphereScatter.userData.queueIntensity = detailIntensity * renderTone.atmosphere.queueIntensityScale;
    return atmosphereScatter;
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
          intensity: { value: renderTone.atmosphere.sunOutlineIntensity },
          rimPower: { value: 5.2 },
          backlightFloor: { value: 0.012 }
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
    this.loadTexture(planet.textures.clouds, THREE.SRGBColorSpace, (texture) => {
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
    this.loadTexture(planet.textures.night, THREE.SRGBColorSpace, (texture) => {
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
    this.loadTexture(planet.textures.ring, THREE.SRGBColorSpace, (texture) => {
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
    this.loadTexture(planet.textures.color, THREE.SRGBColorSpace, (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    });

    this.loadTexture(planet.textures.normal, THREE.NoColorSpace, (texture) => {
      material.normalMap = texture;
      const normalStrength = planet.key === 'pluto' ? 0.62 : 0.42;
      material.normalScale = new THREE.Vector2(normalStrength, normalStrength);
      material.needsUpdate = true;
    });

    this.loadTexture(planet.textures.roughness, THREE.NoColorSpace, (texture) => {
      if (planet.key === 'earth') {
        material.roughnessMap = texture;
        material.metalnessMap = texture;
      } else {
        material.roughnessMap = texture;
      }

      material.needsUpdate = true;
    });
  }

  private loadTexture(
    url: string | undefined,
    colorSpace: THREE.ColorSpace,
    onLoad: (texture: THREE.Texture) => void
  ): void {
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
        texture.colorSpace = colorSpace;
        texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
        texture.needsUpdate = true;
        onLoad(texture);
      })
      .catch(() => undefined);
  }

  private focusPlanet(key: AtlasTargetKey): void {
    this.transitionTimeline?.kill();
    this.detailGroup.visible = true;

    const target = this.planetNodes.get(key);

    if (!target) {
      return;
    }

    const targetRadius = renderTone.layout.detailPlanetRadius;
    const targetScale = targetRadius / target.finalRadius;
    const detailY = this.portraitActive ? 1.48 : 0;
    const detailCameraZ = this.portraitActive ? 10.6 : 8.2;
    this.transitionTimeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    this.transitionTimeline.to(
      this.queueDomeLight,
      { intensity: renderTone.lights.domeDetailIntensity, duration: 0.82 },
      0
    );
    if (this.backgroundMaterial) {
      this.transitionTimeline.to(this.backgroundMaterial, { opacity: 0.1, duration: 0.9 }, 0);
    }
    this.transitionTimeline.to(this.camera.position, { z: detailCameraZ, y: 0.68, duration: 0.68 }, 0);
    this.transitionTimeline.to(this.ambientGroup.rotation, { y: -0.24, duration: 1.4 }, 0);

    for (const node of this.planetNodes.values()) {
      this.setAtmosphereProfile(node, 'detail');

      if (node.key === key) {
        this.showNode(node);
        this.transitionTimeline.to(node.group.position, { x: 0, y: detailY, z: 0, duration: 1.05 }, 0);
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
        this.hideInactiveDetailNode(node, key);
      }
    }

    this.detailGroup.scale.setScalar(targetRadius / 1.34);
    this.transitionTimeline.to(this.detailGroup.position, { y: detailY, duration: 1.05 }, 0);
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
    this.queueTimeline?.kill();
    this.queueTimeline = null;
    this.queueActive = false;
    this.currentQueueMode = false;
    this.transitionTimeline?.kill();
    this.transitionTimeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    this.transitionTimeline.to(
      this.queueDomeLight,
      { intensity: renderTone.lights.domeDetailIntensity, duration: 0.9 },
      0
    );
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
      this.setAtmosphereProfile(node, 'overview');
      const overviewPosition = this.getOverviewPosition(node);

      if (isHiddenTarget(node.key)) {
        this.showNode(node);
        this.transitionTimeline.to(
          node.group.position,
          { x: overviewPosition.x, y: overviewPosition.y, z: overviewPosition.z, duration: 1.1 },
          0
        );
        this.transitionTimeline.to(node.group.scale, { x: 1, y: 1, z: 1, duration: 1.1 }, 0);
        this.setNodeVisibility(node, 0, 0.72);
        this.transitionTimeline.call(() => {
          node.group.visible = false;
        }, undefined, 0.74);
        continue;
      }

      this.showNode(node);
      this.transitionTimeline.to(
        node.group.position,
        { x: overviewPosition.x, y: overviewPosition.y, z: overviewPosition.z, duration: 1.1 },
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

  private getOverviewPosition(node: PlanetNode): THREE.Vector3 {
    if (!this.portraitActive || isHiddenTarget(node.key)) {
      return node.basePosition.clone();
    }

    const relativeIndex = getPlanet(node.key).order - 4;
    return new THREE.Vector3(0, -relativeIndex * 1.08, -Math.abs(relativeIndex) * 0.28);
  }

  private applyOverviewPose(): void {
    this.resetQueueForOverview();

    for (const node of this.planetNodes.values()) {
      this.setAtmosphereProfile(node, 'overview');

      if (isHiddenTarget(node.key)) {
        this.applyNodeVisibility(node, 0);
        node.group.visible = false;
        continue;
      }

      this.showNode(node);
      node.group.position.copy(this.getOverviewPosition(node));
      node.group.scale.setScalar(node.baseScale);
      this.applyNodeVisibility(node, 1);
    }

    this.camera.position.set(0, this.overviewCameraY, this.overviewCameraZ);
    if (this.backgroundMaterial) {
      this.backgroundMaterial.opacity = 0.95;
    }
    this.hideDetailOrbitLayerImmediately();
  }

  private resetQueueForOverview(): void {
    this.queueTimeline?.kill();
    this.queueTimeline = null;
    this.queueActive = false;
    this.currentQueueMode = false;
    this.queueDomeLight.intensity = renderTone.lights.domeDetailIntensity;
    this.hideDetailOrbitLayerImmediately();
  }

  private setQueueMode(active: boolean, force = false): void {
    if (active === this.queueActive && !force) {
      return;
    }

    this.queueActive = active;
    this.queueTimeline?.kill();
    this.queueTimeline = null;

    if (active && this.selectedPlanet) {
      this.arrangePlanetQueue(this.selectedPlanet);
      this.hideDetailOrbitLayerForQueue();
      return;
    }

    if (!active && this.selectedPlanet && this.currentMode !== 'transition-out') {
      this.focusPlanet(this.selectedPlanet);
    }
  }

  private getQueuePose(
    planet: PlanetRecord,
    selectedPlanet: PlanetRecord,
    node: PlanetNode
  ): { position: THREE.Vector3; scale: number; visibility: number } {
    const relativeIndex = planet.order - selectedPlanet.order;
    const distance = Math.abs(relativeIndex);

    if (relativeIndex === 0) {
      return {
        position: new THREE.Vector3(0, this.portraitActive ? 0.5 : 0, 0),
        scale: renderTone.layout.detailPlanetRadius / node.finalRadius,
        visibility: 1
      };
    }

    const targetRadius = Math.max(
      renderTone.queue.minimumNeighborRadius,
      renderTone.layout.detailPlanetRadius * (renderTone.queue.neighborRadius - distance * renderTone.queue.radiusFalloff)
    );

    return {
      position: this.portraitActive
        ? new THREE.Vector3(relativeIndex * 0.18, 0.5 - relativeIndex * 1.55, -distance * 0.9)
        : new THREE.Vector3(
            relativeIndex * renderTone.queue.spacingX,
            -distance * renderTone.queue.spacingY,
            -distance * renderTone.queue.spacingZ
          ),
      scale: targetRadius / node.finalRadius,
      visibility: Math.max(renderTone.queue.minimumVisibility, renderTone.queue.neighborVisibility - distance * 0.1)
    };
  }

  private arrangePlanetQueue(selectedKey: AtlasTargetKey, duration: number = renderTone.queue.transitionDuration): void {
    const selectedPlanet = getPlanet(selectedKey);
    const hiddenQueue = selectedKey === 'pluto';
    this.transitionTimeline?.kill();
    this.queueTimeline?.kill();
    this.queueTimeline = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    this.queueTimeline.to(
      this.camera.position,
      {
        z: this.portraitActive ? 12.4 : renderTone.queue.cameraZ,
        y: this.portraitActive ? 0.5 : renderTone.queue.cameraY,
        duration
      },
      0
    );
    this.queueTimeline.to(
      this.queueDomeLight,
      { intensity: renderTone.lights.domeQueueIntensity, duration: duration * 0.9 },
      0
    );
    this.queueTimeline.to(this.ambientGroup.rotation, { y: renderTone.queue.ambientRotationY, duration }, 0);

    if (this.backgroundMaterial) {
      this.queueTimeline.to(this.backgroundMaterial, { opacity: renderTone.queue.backgroundOpacity, duration }, 0);
    }

    for (const node of this.planetNodes.values()) {
      this.setAtmosphereProfile(node, 'queue');

      if (hiddenQueue && node.key !== selectedKey) {
        this.applyNodeVisibility(node, 0);
        node.group.visible = false;
        continue;
      }

      if (!hiddenQueue && isHiddenTarget(node.key)) {
        this.applyNodeVisibility(node, 0);
        node.group.visible = false;
        continue;
      }

      this.showNode(node);
      const pose = this.getQueuePose(getPlanet(node.key), selectedPlanet, node);
      this.queueTimeline.to(
        node.group.position,
        { x: pose.position.x, y: pose.position.y, z: pose.position.z, duration },
        0
      );
      this.queueTimeline.to(
        node.group.scale,
        { x: pose.scale, y: pose.scale, z: pose.scale, duration },
        0
      );
      this.setNodeVisibility(node, pose.visibility, duration, this.queueTimeline);
    }
  }

  private showNode(node: PlanetNode): void {
    node.group.visible = true;
  }

  private hideInactiveDetailNode(node: PlanetNode, selectedKey: AtlasTargetKey): void {
    if (!node.group.visible) {
      this.applyNodeVisibility(node, 0);
      return;
    }

    this.setNodeVisibility(node, 0, 0.78);
    this.transitionTimeline?.call(
      () => {
        if (!this.queueActive && this.selectedPlanet === selectedKey && node.key !== selectedKey) {
          node.group.visible = false;
        }
      },
      undefined,
      0.8
    );
  }

  private hideDetailOrbitLayerForQueue(): void {
    const timeline = this.queueTimeline;

    if (!timeline) {
      this.detailGroup.visible = false;
      return;
    }

    this.detailGroup.visible = true;
    for (const material of this.getDetailMaterials()) {
      timeline.to(material, { opacity: 0, duration: 0.34 }, 0);
    }
    timeline.call(() => {
      if (this.queueActive) {
        this.detailGroup.visible = false;
      }
    }, undefined, 0.36);
  }

  private hideDetailOrbitLayerImmediately(): void {
    this.detailGroup.visible = false;

    for (const material of this.getDetailMaterials()) {
      material.opacity = 0;
      material.needsUpdate = true;
    }
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
    for (const layer of [node.atmosphere, node.atmosphereScatter]) {
      const uniform = layer.material.uniforms.intensity;
      const baseIntensity = Number(layer.userData.baseIntensity ?? uniform.value);

      if (!timeline) {
        uniform.value = baseIntensity * visibility;
        continue;
      }

      timeline.to(uniform, { value: baseIntensity * visibility, duration }, 0);
    }
  }

  private applyAtmosphereVisibility(node: PlanetNode, visibility: number): void {
    for (const layer of [node.atmosphere, node.atmosphereScatter]) {
      const uniform = layer.material.uniforms.intensity;
      const baseIntensity = Number(layer.userData.baseIntensity ?? uniform.value);
      uniform.value = baseIntensity * visibility;
    }
  }

  private setAtmosphereProfile(node: PlanetNode, profile: 'overview' | 'detail' | 'queue'): void {
    const profileKey = `${profile}Intensity`;

    for (const layer of [node.atmosphere, node.atmosphereScatter]) {
      layer.userData.baseIntensity = Number(layer.userData[profileKey] ?? layer.userData.baseIntensity);
    }
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
    const nextPortraitActive = width < height && width <= 900;
    const portraitChanged = nextPortraitActive !== this.portraitActive;
    this.portraitActive = nextPortraitActive;
    const compactLandscapeFactor = THREE.MathUtils.clamp(
      (720 - height) / 360 + Math.max(0, width / height - 2.2) * 0.22,
      0,
      1
    );

    this.overviewCameraZ = THREE.MathUtils.lerp(15.5, 12.8, compactLandscapeFactor);
    this.overviewCameraY = THREE.MathUtils.lerp(1.4, 0.86, compactLandscapeFactor);
    if (this.portraitActive) {
      this.overviewCameraZ = 17.8;
      this.overviewCameraY = 0;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);

    if (this.currentMode === 'overview') {
      this.applyOverviewPose();
    } else if (portraitChanged && this.queueActive && this.selectedPlanet) {
      this.arrangePlanetQueue(this.selectedPlanet, 0.42);
    } else if (portraitChanged && this.selectedPlanet) {
      this.focusPlanet(this.selectedPlanet);
    }
  }

  private findQueuePlanetAtPointer(event: PointerEvent, bounds: DOMRect): AtlasTargetKey | undefined {
    const pointer = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
    const targets: QueuePickTarget[] = [];

    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);

    for (const node of this.planetNodes.values()) {
      if (!node.group.visible) {
        continue;
      }

      const center = node.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
      const edge = node.group.localToWorld(new THREE.Vector3(node.finalRadius, 0, 0)).project(this.camera);
      const centerX = (center.x + 1) * 0.5 * bounds.width;
      const centerY = (1 - center.y) * 0.5 * bounds.height;
      const edgeX = (edge.x + 1) * 0.5 * bounds.width;
      const edgeY = (1 - edge.y) * 0.5 * bounds.height;
      const visibleRadius = Math.hypot(edgeX - centerX, edgeY - centerY);

      targets.push({
        key: node.key,
        x: centerX,
        y: centerY,
        radius: Math.max(visibleRadius * renderTone.queue.touchRadiusScale, renderTone.queue.minimumTouchRadius)
      });
    }

    return chooseClosestQueueTarget(pointer, targets);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.currentMode === 'detail' && !this.queueActive) {
      return;
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.queueActive ? undefined : this.raycaster.intersectObjects(this.pickables, false)[0];
    const raycastPlanetKey = (hit?.object.userData.planetKey ?? hit?.object.parent?.userData.planetKey) as
      | AtlasTargetKey
      | undefined;
    const planetKey = this.queueActive ? this.findQueuePlanetAtPointer(event, bounds) : raycastPlanetKey;

    if (planetKey) {
      this.onSelectPlanet(planetKey);
      return;
    }

    if (this.queueActive && !planetKey) {
      this.onReturn();
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
        const overviewPosition = this.getOverviewPosition(node);
        node.group.position.y = overviewPosition.y + Math.sin(elapsed * 0.58 + node.floatPhase) * 0.12;
        node.group.position.x = overviewPosition.x + Math.sin(elapsed * 0.22 + node.floatPhase) * 0.04;
      }
    }

    this.detailGroup.rotation.z = Math.sin(elapsed * 0.22) * 0.06;
    this.ambientGroup.rotation.z = Math.sin(elapsed * 0.035) * 0.015;
    this.camera.lookAt(0, 0, 0);
    this.composer.render();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  };
}

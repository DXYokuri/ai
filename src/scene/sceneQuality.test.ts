import { describe, expect, it } from 'vitest';
import appSource from '../app/App.tsx?raw';
import styles from '../styles.css?raw';
import renderToneSource from './renderTone.ts?raw';
import source from './SolarAtlasScene.ts?raw';
import stageSource from './SolarAtlasStage.tsx?raw';

describe('SolarAtlasScene quality constraints', () => {
  it('does not use a low-quality wireframe shell around the detail planet', () => {
    expect(source).not.toContain('wireframe: true');
    expect(source).not.toContain("wire.name = 'wire'");
  });

  it('removes every legacy glitch and authority rendering system', () => {
    expect(source).not.toContain('AuthorityPlanetProfile');
    expect(source).not.toContain('authorityPlanetProfiles');
    expect(source).not.toContain('authorityFragmentVertex');
    expect(source).not.toContain('authorityFragmentShader');
    expect(source).not.toContain('createAuthorityFallbackTexture');
    expect(source).not.toContain('InstancedBufferGeometry');
    expect(source).not.toContain('authority-flat-spherical-pixel-map');
    expect(source).not.toContain('authority-flat-geometric-guides');
    expect(appSource).not.toContain('AuthorityHud');
    expect(appSource).not.toContain('AUTHORITY MODE');
    expect(appSource).not.toContain('BROADCAST DESIGN');
    expect(appSource).not.toContain('glitchActive');
    expect(appSource).not.toContain('glitch-pass');
    expect(styles).not.toContain('.authority-hud');
    expect(styles).not.toContain('.glitch-pass');
    expect(styles).not.toContain('@keyframes glitch-slice');
  });

  it('keeps the queue entry arrow visible in the upper planet airspace', () => {
    expect(appSource).toContain('Enter planet queue mode');
    expect(appSource).toContain('Exit planet queue mode');
    expect(appSource).toContain('size={116}');
    expect(styles).toContain('top: clamp(42px, 6.5vh, 68px);');
    expect(styles).toContain('width: clamp(150px, 12vw, 210px);');
    expect(styles).toContain('height: clamp(70px, 9vh, 94px);');
  });

  it('keeps detail planet layers stable instead of forcing every layer transparent', () => {
    expect(source).toContain('private setNodeVisibility');
    expect(source).toContain('if (visibility >= 0.999) {');
    expect(source).toContain('this.applySurfaceOpacity(node.surface, 1);');
    expect(source).toContain('renderTone.materials.cloudOpacity * visibility');
    expect(source).toContain('renderTone.materials.nightOpacity * visibility');
    expect(source).toContain('surface.material.transparent = false');
    expect(source).toContain('surface.material.depthWrite = true');
  });

  it('uses a real dome light without flattening the directional planet lighting', () => {
    expect(source).toContain('private readonly queueDomeLight');
    expect(source).toContain('new THREE.HemisphereLight');
    expect(source).toContain('renderTone.lights.domeDetailIntensity');
    expect(source).toContain('renderTone.lights.domeQueueIntensity');
    expect(source).toContain('new THREE.DirectionalLight');
    expect(renderToneSource).toContain('domeDetailIntensity');
    expect(renderToneSource).toContain('domeQueueIntensity');
  });

  it('arranges all real PBR planet nodes in a perspective queue with the selected planet centered', () => {
    expect(source).toContain('private getQueuePose');
    expect(source).toContain('private arrangePlanetQueue');
    expect(source).toContain('const relativeIndex = planet.order - selectedPlanet.order;');
    expect(source).toContain("relativeIndex === 0");
    expect(source).toContain('x: 0');
    expect(source).toContain('y: 0');
    expect(source).toContain('z: 0');
    expect(source).toContain('Math.abs(relativeIndex)');
    expect(source).toContain('renderTone.queue.spacingX');
    expect(source).toContain('renderTone.queue.spacingY');
    expect(source).toContain('renderTone.queue.spacingZ');
    expect(source).toContain("ease: 'power3.inOut'");
  });

  it('uses queue mode throughout React and the Three.js stage', () => {
    expect(appSource).toContain('queueMode');
    expect(appSource).toContain('mode-queue');
    expect(appSource).toContain('is-queue');
    expect(stageSource).toContain('queueMode');
    expect(source).toContain('queueMode');
    expect(source).toContain('private setQueueMode');
    expect(source).toContain('private resetQueueForOverview');
    expect(source).not.toContain('authorityMode');
    expect(stageSource).not.toContain('authorityMode');
  });

  it('slides the detail information panels outward while queue mode remains active', () => {
    expect(styles).toContain('.mode-queue .detail-hud__left');
    expect(styles).toContain('translateX(calc(-100% - var(--detail-safe-side)))');
    expect(styles).toContain('.mode-queue .detail-hud__right');
    expect(styles).toContain('translateX(calc(100% + var(--detail-safe-side)))');
    expect(styles).toContain('.mode-queue .detail-lock');
    expect(styles).toContain('.mode-queue .detail-footer');
  });

  it('allows the queue transition to be entered during return transitions', () => {
    expect(source).toContain("state.queueMode && state.mode !== 'overview'");
    expect(appSource).toContain("state.mode === 'transition-out' && state.selectedPlanet ? selectPlanet(state, state.selectedPlanet)");
  });

  it('hides normal detail orbit coils in queue mode and restores them on exit', () => {
    expect(source).toContain('private hideDetailOrbitLayerForQueue');
    expect(source).toContain('this.hideDetailOrbitLayerForQueue');
    expect(source).toContain('this.detailGroup.visible = false');
    expect(source).toContain('this.focusPlanet(this.selectedPlanet)');
  });

  it('lets users select a planet by clicking its real 3D mesh in queue mode', () => {
    expect(source).toContain("if (this.currentMode === 'detail' && !this.queueActive)");
    expect(source).toContain('this.raycaster.intersectObjects(this.pickables, false)');
    expect(source).toContain('this.onSelectPlanet(planetKey)');
    expect(styles).toContain('.detail-hud.is-queue');
    expect(styles).toContain('pointer-events: none;');
  });

  it('returns to overview when queue mode receives a blank canvas click', () => {
    expect(appSource).toContain('onReturn={handleReturn}');
    expect(stageSource).toContain('onReturn: () => void');
    expect(stageSource).toContain('new SolarAtlasScene(container, onSelectPlanet, onActivatePlanet, onReturn)');
    expect(source).toContain('private readonly onReturn: () => void;');
    expect(source).toContain('if (this.queueActive && !planetKey) {');
    expect(source).toContain('this.onReturn();');
  });

  it('fully hides planets replaced during standard detail switching', () => {
    expect(source).toContain('private showNode(node: PlanetNode): void');
    expect(source).toContain('private hideInactiveDetailNode(node: PlanetNode, selectedKey: AtlasTargetKey): void');
    expect(source).toContain('this.setNodeVisibility(node, 0, 0.78);');
    expect(source).toContain('node.group.visible = false;');
    expect(source).toContain('this.showNode(node);');
  });

  it('renders hidden Pluto alone when queue mode is active', () => {
    expect(source).toContain("const hiddenQueue = selectedKey === 'pluto';");
    expect(source).toContain('if (hiddenQueue && node.key !== selectedKey)');
    expect(source).toContain('node.group.visible = false;');
  });

  it('adds a dedicated outline light to the overview sun', () => {
    expect(source).toContain('outlineLight?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;');
    expect(source).toContain('this.createSunOutline(plan.radius, planet)');
    expect(source).toContain("sunOutline.name = 'sun-silhouette-outline-light'");
    expect(source).toContain('renderTone.atmosphere.sunOutlineIntensity');
  });

  it('uses a dual-layer directional shader arc crown in detail and queue modes', () => {
    expect(source).toContain('atmosphereScatter: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;');
    expect(source).toContain('private createAtmosphereScatter');
    expect(source).toContain('uniform float rimPower;');
    expect(source).toContain('uniform float backlightFloor;');
    expect(source).toContain('float arcCrown = smoothstep');
    expect(source).toContain('this.setAtmosphereProfile(node,');
    expect(renderToneSource).toContain('innerDetailIntensity');
    expect(renderToneSource).toContain('outerDetailIntensity');
    expect(renderToneSource).toContain('queueIntensityScale');
  });

  it('keeps the overview sun outline thin and increases the idle planet drift', () => {
    expect(source).toContain('new THREE.SphereGeometry(radius * 1.065');
    expect(source).toContain('Math.sin(elapsed * 0.58 + node.floatPhase) * 0.12');
    expect(source).toContain('Math.sin(elapsed * 0.22 + node.floatPhase) * 0.04');
    expect(renderToneSource).toContain('sunOutlineIntensity: 0.2');
  });

  it('uses responsive overview camera framing for very wide low-height screens', () => {
    expect(source).toContain('private overviewCameraZ = 15.5;');
    expect(source).toContain('private overviewCameraY = 1.4;');
    expect(source).toContain('const compactLandscapeFactor = THREE.MathUtils.clamp');
    expect(source).toContain('this.overviewCameraZ = THREE.MathUtils.lerp(15.5, 12.8, compactLandscapeFactor);');
  });

  it('keeps the overview right-side gradient below pure white and narrows the bright region', () => {
    expect(source).toContain("gradient.addColorStop(0.48, '#020202');");
    expect(source).toContain("gradient.addColorStop(0.68, '#242424');");
    expect(source).toContain("gradient.addColorStop(0.88, '#686868');");
    expect(source).toContain("gradient.addColorStop(1, '#aaaaaa');");
    expect(styles).toContain('#aaaaaa 100%');
  });

  it('keeps the flip-focus detail panel and eight-planet position chart', () => {
    expect(appSource).toContain('detail-panel-focus-layer');
    expect(appSource).toContain('PlanetPositionChart');
    expect(styles).toContain('@keyframes detail-panel-focus-in');
    expect(styles).toContain('.planet-position-chart__track');
  });

  it('keeps detail HUD panels inside responsive safe zones', () => {
    expect(styles).toContain('--detail-safe-top:');
    expect(styles).toContain('--detail-safe-bottom:');
    expect(styles).toContain('--detail-safe-side:');
    expect(styles).toContain('grid-template-rows: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain('padding: var(--detail-safe-top) var(--detail-safe-side) var(--detail-safe-bottom);');
  });

  it('uses an ultra-compact readable panel layout on phone-height landscape screens', () => {
    expect(styles).toContain('@media (max-height: 440px) and (orientation: landscape)');
    expect(styles).toContain('--detail-safe-bottom: 86px;');
    expect(styles).toContain('--detail-safe-top: 96px;');
  });

  it('keeps detail interaction unlocked throughout transition animations', () => {
    expect(appSource).toContain('locked={detailVisible}');
    expect(styles).toContain('.mode-transition-in .detail-hud');
    expect(styles).toContain('.mode-transition-out .detail-hud');
    expect(styles).toContain('pointer-events: auto;');
  });

  it('keeps an expanded panel mounted while its planet content changes', () => {
    expect(appSource).not.toContain('key={`${activePanel.key}-${planet.key}`}');
    expect(appSource).not.toContain('key={activePanel.key}');
    expect(styles).toContain('@keyframes detail-panel-content-refresh');
  });

  it('uses a native portrait atlas instead of a rotate-device lock screen', () => {
    expect(appSource).not.toContain('ROTATE DEVICE');
    expect(styles).not.toContain('.atlas-experience {\n    display: none;');
    expect(styles).toContain('@media (max-width: 900px) and (orientation: portrait)');
    expect(styles).toContain('scroll-snap-type: x mandatory;');
    expect(source).toContain('private portraitActive = false;');
    expect(source).toContain('private getOverviewPosition');
    expect(source).toContain('if (this.portraitActive)');
  });

  it('uses a straight portrait overview queue with breathing space', () => {
    expect(source).toContain('createPortraitOverviewLayout(planets, width, height');
    expect(source).toContain('node.group.position.x = this.portraitActive');
    expect(source).toContain('node.group.position.z = overviewPosition.z;');
  });

  it('keeps every portrait detail panel visible and the bottom rail touch draggable', () => {
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(styles).toContain('width: calc(50% - 17px);');
    expect(styles).toContain('bottom: 11vh;');
    expect(styles).toContain('gap: 10px;');
    expect(styles).toContain('touch-action: pan-x;');
    expect(styles).toContain('-webkit-overflow-scrolling: touch;');
  });

  it('releases the detail HUD during return so the next canvas action is immediate', () => {
    expect(styles).toContain('.mode-transition-out .detail-hud.is-locked');
    expect(styles).toContain('pointer-events: none;');
  });

  it('provides a visible multilingual compatibility fallback instead of a blank WebGL layer', () => {
    expect(stageSource).toContain('WebGL compatibility mode');
    expect(stageSource).toContain('兼容模式');
    expect(stageSource).toContain('호환 모드');
    expect(stageSource).toContain('Copy link');
  });

  it('keeps normal and roughness maps in linear color space', () => {
    expect(source).toContain('this.loadTexture(planet.textures.normal, THREE.NoColorSpace');
    expect(source).toContain('this.loadTexture(planet.textures.roughness, THREE.NoColorSpace');
  });
});

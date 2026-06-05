import { describe, expect, it } from 'vitest';
import appSource from '../app/App.tsx?raw';
import styles from '../styles.css?raw';
import renderToneSource from './renderTone.ts?raw';
import source from './SolarAtlasScene.ts?raw';

describe('SolarAtlasScene quality constraints', () => {
  it('does not use a low-quality wireframe shell around the detail planet', () => {
    expect(source).not.toContain('wireframe: true');
    expect(source).not.toContain("wire.name = 'wire'");
  });

  it('renders authority mode as GPU texture fragments instead of pure color blocks', () => {
    expect(source).toContain('InstancedBufferGeometry');
    expect(source).toContain('sampler2D planetTexture');
    expect(source).toContain('texture2D(planetTexture');
    expect(source).toContain('instanceUvCenter');
    expect(source).toContain('flatAuthorityPlane');
    expect(source).not.toContain("block.name = 'authority-fragment-block'");
    expect(source).not.toContain('new THREE.BoxGeometry(1, 1, 1)');
  });

  it('keeps the authority entry arrow visible in the upper planet airspace', () => {
    expect(appSource).toContain('size={116}');
    expect(styles).toContain('top: clamp(96px, 16vh, 164px);');
    expect(styles).toContain('width: clamp(184px, 13vw, 230px);');
    expect(styles).toContain('height: clamp(104px, 11vh, 134px);');
  });

  it('offsets authority texture fragments with per-fragment drift motion', () => {
    expect(source).toContain('attribute float instanceFloatPhase;');
    expect(source).toContain('attribute float instanceMotion;');
    expect(source).toContain('vec2 planarDrift');
    expect(source).toContain('instancePosition.xy + planarScatter + planarDrift + local');
  });

  it('keeps detail planet layers stable instead of forcing every layer to full transparent opacity', () => {
    expect(source).toContain('private setNodeVisibility');
    expect(source).toContain('if (visibility >= 0.999) {');
    expect(source).toContain('this.applySurfaceOpacity(node.surface, 1);');
    expect(source).toContain('renderTone.materials.cloudOpacity * visibility');
    expect(source).toContain('renderTone.materials.nightOpacity * visibility');
    expect(source).toContain('opacity >= 0.999 && surface.material.opacity >= 0.999');
    expect(source).toContain('surface.material.transparent = false');
    expect(source).toContain('surface.material.depthWrite = true');
    expect(source).not.toContain('this.setNodeOpacity(node, 1, 0.58);');
  });

  it('keeps depth-of-field disabled for the flat authority graphic and the normal detail planet', () => {
    expect(source).toContain('private readonly bokehPass: BokehPass;');
    expect(source).toContain('this.bokehPass.enabled = false;');
    expect(source).not.toContain('this.bokehPass.enabled = active;');
  });

  it('draws authority mode as a flat spherical pixel composition instead of a perspective debris cloud', () => {
    expect(source).toContain("this.authorityGroup.name = 'authority-flat-spherical-pixel-map'");
    expect(source).toContain('const gridSize = 72;');
    expect(source).toContain('const sphereSilhouette =');
    expect(source).toContain('fragmentPositions[write3 + 2] = 0;');
    expect(source).toContain('fragmentScatter[write3 + 2] = 0;');
    expect(source).toContain('const planarPixelBlock =');
    expect(source).toContain('fragmentRotations[fragmentCount] = (random() - 0.5) * 0.075;');
    expect(source).toContain('side: THREE.FrontSide');
    expect(source).toContain('this.tweenSurfaceOpacity(node.surface, 0, 0.78, this.authorityTimeline);');
    expect(source).toContain('this.tweenAtmosphereVisibility(node, 0, 0.78, this.authorityTimeline);');
    expect(source).toContain('this.authorityFragmentMaterial.depthTest = false;');
    expect(source).not.toContain('this.authorityTimeline.to(this.authorityGroup.rotation, { y:');
    expect(source).not.toContain('this.authorityGroup.rotation.x =');
  });

  it('uses planet-specific authority tone masks instead of a uniformly bright fragment field', () => {
    expect(source).toContain('const authorityPlanetProfiles: Record<PlanetKey, AuthorityPlanetProfile>');
    expect(source).toContain('uAuthorityLightCenter');
    expect(source).toContain('uAuthorityLightScale');
    expect(source).toContain('uAuthorityShadowBias');
    expect(source).toContain('uAuthorityBrightness');
    expect(source).toContain('applyAuthorityProfile(key)');
    expect(source).toContain('float authorityLightMask');
    expect(source).toContain('vec3 recoveredWhite = monochromeTexture * authorityTone');
    expect(source).not.toContain('mix(monochromeTexture * 1.34 + vec3(0.045), vec3(0.96)');
  });

  it('crossfades and scales authority planet imagery when switching planets', () => {
    expect(source).toContain('private authorityTextureKey: PlanetKey | null = null;');
    expect(source).toContain('private authorityFragmentMesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> | null = null;');
    expect(source).toContain('private transitionAuthorityPlanet(currentPlanet: PlanetKey, nextPlanet: PlanetKey): void');
    expect(source).toContain('float circularClip =');
    expect(source).toContain('const direction = nextOrder > currentOrder ? -1 : 1;');
    expect(source).toContain('this.authorityTimeline.to(this.authorityFragmentOpacity, { value: 0');
    expect(source).toContain('this.authorityTimeline.to(this.authorityFragmentMesh.scale');
    expect(source).toContain('this.authorityTimeline.call(() => {');
    expect(source).toContain('this.updateAuthorityTexture(this.selectedPlanet);');
    expect(source).not.toContain('uniform float uSlideProgress;');
    expect(source).not.toContain('uSlideDirection');
    expect(source).not.toContain('sphericalSlidePlane');
    expect(source).not.toContain('flatAuthorityPlane.x * flipWidth');
  });

  it('restores the normal detail planet to the selected authority target when leaving authority mode', () => {
    expect(source).toContain('if (!active && this.selectedPlanet) {');
    expect(source).toContain('this.focusPlanet(this.selectedPlanet);');
  });

  it('replaces authority orbit arcs with planet-specific flat geometric block guides', () => {
    expect(source).toContain("this.authorityGuideGroup.name = 'authority-flat-geometric-guides'");
    expect(source).toContain('this.buildAuthorityGuidesForPlanet(key)');
    expect(source).toContain('new THREE.PlaneGeometry(size, size');
    expect(source).toContain('new THREE.ShapeGeometry(triangleShape)');
    expect(source).toContain('guideMesh.rotation.y = this.authorityGuideFlip.value * Math.PI');
    expect(source).toContain('guideMesh.rotation.y = 0;');
  });

  it('hides the normal interlocking detail orbit coils while authority mode is active', () => {
    expect(source).toContain('private hideDetailOrbitLayerForAuthority(): void');
    expect(source).toContain('this.hideDetailOrbitLayerForAuthority();');
    expect(source).toContain('timeline.to(material, { opacity: 0, duration: 0.28 }, 0);');
    expect(source).toContain('this.detailGroup.visible = false;');
    expect(source).not.toContain('this.authorityTimeline.to(material, { opacity: 0.006');
  });

  it('allows the authority transition to be entered even during return transitions', () => {
    expect(source).toContain("state.authorityMode && state.mode !== 'overview'");
    expect(source).not.toContain("state.mode !== 'transition-out' && Boolean(state.selectedPlanet)");
    expect(appSource).toContain("state.mode === 'transition-out' && state.selectedPlanet ? selectPlanet(state, state.selectedPlanet)");
  });

  it('smoothly exits authority mode to overview without leaving stale atmosphere tweens', () => {
    expect(appSource).toContain('if (authorityMode) {');
    expect(appSource).toContain('setAuthorityMode(false);');
    expect(source).toContain('private resetAuthorityModeForOverview(): void');
    expect(source).toContain('private exitAuthorityModeToOverview(): void');
    expect(source).toContain('this.exitAuthorityModeToOverview();');
    expect(source).toContain('this.hideDetailOrbitLayerImmediately();');
    expect(source).toContain('this.authorityTimeline?.kill();');
    expect(source).toContain('this.authorityFragmentOpacity.value = 0;');
    expect(source).toContain('this.authorityFragmentProgress.value = 0;');
    expect(source).toContain('this.authorityGroup.visible = false;');
    expect(source).toContain('this.resetAuthorityModeForOverview();');
    expect(source).not.toContain("state.mode === 'transition-out' && !nextAuthorityMode) {\n      this.setAuthorityMode(false);\n      this.returnToOverview();");
  });

  it('adds floating authority typography and two rotating right-side dials', () => {
    expect(appSource).toContain('authority-dials');
    expect(appSource).toContain('authority-dial authority-dial--primary');
    expect(appSource).toContain('authority-dial authority-dial--secondary');
    expect(styles).toContain('animation: authority-left-float');
    expect(styles).toContain('@keyframes authority-left-float');
    expect(styles).toContain('@keyframes authority-dial-spin');
    expect(styles).toContain('.authority-dial--secondary');
  });

  it('adds reference-style dotted maps and broadcast title modules to authority mode', () => {
    expect(appSource).toContain('authority-broadcast');
    expect(appSource).toContain('BROADCAST DESIGN');
    expect(appSource).toContain('authority-dot-map authority-dot-map--north');
    expect(appSource).toContain('authority-usa-line-map');
    expect(appSource).toContain('usa-map-outline');
    expect(appSource).toContain('usa-map-target-zone');
    expect(appSource).not.toContain('authority-dot-map authority-dot-map--south');
    expect(appSource).not.toContain('dot-map-shape--africa');
    expect(appSource).toContain('authority-dotline-field');
    expect(styles).toContain('.authority-broadcast strong');
    expect(styles).toContain('animation: authority-broadcast-float');
    expect(styles).toContain('.authority-broadcast strong::before');
    expect(styles).toContain('.authority-dot-map--north');
    expect(styles).toContain('.authority-usa-line-map');
    expect(styles).toContain('.usa-map-outline');
    expect(styles).toContain('.usa-map-target-zone');
    expect(styles).not.toContain('.authority-dot-map--south');
    expect(styles).not.toContain('.dot-map-shape--africa');
    expect(styles).toContain('radial-gradient(circle, rgba(255, 255, 255');
    expect(styles).toContain('repeating-linear-gradient(90deg, transparent 0 7px');
  });

  it('makes the right-side authority dials visually larger and heavier', () => {
    expect(styles).toContain('width: 106px;');
    expect(styles).toContain('border: 2px solid rgba(255, 255, 255, 0.56);');
    expect(styles).toContain('height: 74%;');
    expect(styles).toContain('width: 82px;');
  });

  it('adds a dedicated outline light to the overview sun', () => {
    expect(source).toContain('outlineLight?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;');
    expect(source).toContain('this.createSunOutline(plan.radius, planet)');
    expect(source).toContain("sunOutline.name = 'sun-silhouette-outline-light'");
    expect(source).toContain('renderTone.atmosphere.sunOutlineIntensity');
    expect(renderToneSource).toContain('sunOutlineIntensity');
  });

  it('does not run the global glitch flash over the normal detail planet', () => {
    expect(appSource).toContain("glitchActive && atlasState.mode === 'overview' && !authorityMode");
    expect(styles).toContain('.mode-detail .scanline-pass');
    expect(styles).toContain('animation-duration: 12s;');
  });
});

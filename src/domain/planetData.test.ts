import { describe, expect, it } from 'vitest';
import { PLANET_ORDER, getPlanet, hiddenPlanets, planets } from './planetData';

describe('planetData', () => {
  it('keeps the atlas order from the Sun to Neptune', () => {
    expect(PLANET_ORDER).toEqual([
      'sun',
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune'
    ]);

    expect(planets.map((planet) => planet.key)).toEqual(PLANET_ORDER);
    expect(planets.map((planet) => planet.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('provides complete fields for every HUD and texture surface', () => {
    for (const planet of planets) {
      expect(planet.label).toMatch(/^[A-Z][A-Z ]+$/);
      expect(planet.visualRadius).toBeGreaterThan(0);
      expect(planet.detailScale).toBeGreaterThanOrEqual(1);
      expect(planet.textures.color).toMatch(/^\.\/textures\/planets\//);
      expect(Object.keys(planet.stats).length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(planet.environment).length).toBeGreaterThanOrEqual(4);
      expect(planet.mission.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not depend on third-party runtime texture hosts', () => {
    const textureUrls = planets.flatMap((planet) => Object.values(planet.textures).filter(Boolean));

    expect(textureUrls.every((url) => url?.startsWith('./textures/'))).toBe(true);
    expect(textureUrls.some((url) => url?.includes('unpkg.com'))).toBe(false);
    expect(textureUrls.some((url) => url?.includes('raw.githubusercontent.com'))).toBe(false);
  });

  it('includes Earth specialty maps and Saturn ring texture', () => {
    const earth = planets.find((planet) => planet.key === 'earth');
    const saturn = planets.find((planet) => planet.key === 'saturn');

    expect(earth?.textures.clouds).toBeDefined();
    expect(earth?.textures.night).toBeDefined();
    expect(earth?.textures.normal).toBeDefined();
    expect(saturn?.textures.ring).toBeDefined();
  });

  it('keeps Pluto as a complete hidden target outside the main planet order', () => {
    expect(planets).toHaveLength(9);
    expect(PLANET_ORDER).not.toContain('pluto');
    expect(hiddenPlanets.map((planet) => planet.key)).toEqual(['pluto']);
    expect(getPlanet('pluto').textures.color).toMatch(/^\.\/textures\/pluto\//);
    expect(getPlanet('pluto').label).toBe('PLUTO');
  });

  it('uses local high-fidelity color, normal, and roughness maps for Pluto', () => {
    const pluto = getPlanet('pluto');

    expect(pluto.textures.color).toBe('./textures/pluto/pluto-color-8k.jpg');
    expect(pluto.textures.normal).toBe('./textures/pluto/pluto-normal-8k.jpg');
    expect(pluto.textures.roughness).toBe('./textures/pluto/pluto-roughness-8k.jpg');
  });
});

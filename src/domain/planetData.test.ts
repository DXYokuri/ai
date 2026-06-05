import { describe, expect, it } from 'vitest';
import { PLANET_ORDER, planets } from './planetData';

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
      expect(planet.textures.color).toMatch(/^https:\/\//);
      expect(Object.keys(planet.stats).length).toBeGreaterThanOrEqual(4);
      expect(Object.keys(planet.environment).length).toBeGreaterThanOrEqual(4);
      expect(planet.mission.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('includes Earth specialty maps and Saturn ring texture', () => {
    const earth = planets.find((planet) => planet.key === 'earth');
    const saturn = planets.find((planet) => planet.key === 'saturn');

    expect(earth?.textures.clouds).toBeDefined();
    expect(earth?.textures.night).toBeDefined();
    expect(earth?.textures.normal).toBeDefined();
    expect(saturn?.textures.ring).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { createRenderPlan } from './renderPlan';
import { planets } from '../domain/planetData';
import { renderTone } from './renderTone';

describe('createRenderPlan', () => {
  it('creates a complete non-overlapping overview layout', () => {
    const plan = createRenderPlan(planets);

    expect(plan).toHaveLength(9);
    expect(plan[0].key).toBe('sun');
    expect(plan[8].key).toBe('neptune');

    for (let index = 1; index < plan.length; index += 1) {
      expect(plan[index].x).toBeGreaterThan(plan[index - 1].x);
      expect(plan[index].pickRadius).toBeGreaterThanOrEqual(plan[index].radius * 1.25);
    }
  });

  it('uses the reduced cinematic overview scale requested for the atlas', () => {
    expect(renderTone.layout.overviewScale).toBeGreaterThanOrEqual(0.65);
    expect(renderTone.layout.overviewScale).toBeLessThanOrEqual(0.8);

    const plan = createRenderPlan(planets);
    const earthPlan = plan.find((entry) => entry.key === 'earth');
    const earth = planets.find((entry) => entry.key === 'earth');

    expect(earthPlan?.radius).toBeCloseTo((earth?.visualRadius ?? 0) * renderTone.layout.overviewScale);
  });

  it('keeps detail planets at a unified cinematic radius', () => {
    expect(renderTone.layout.detailPlanetRadius).toBeGreaterThanOrEqual(1.22);
    expect(renderTone.layout.detailPlanetRadius).toBeLessThanOrEqual(1.48);
  });
});

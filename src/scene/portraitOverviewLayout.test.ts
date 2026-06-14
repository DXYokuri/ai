import { describe, expect, it } from 'vitest';
import { planets } from '../domain/planetData';
import { createPortraitOverviewLayout } from './portraitOverviewLayout';

describe('createPortraitOverviewLayout', () => {
  it('keeps every planet on one flat vertical axis and fills the safe content height', () => {
    const layout = createPortraitOverviewLayout(planets, 390, 844, {
      topInsetPx: 64,
      bottomInsetPx: 62
    });
    const positions = planets.map((planet) => layout.get(planet.key));

    expect(positions.every((position) => position?.x === 0 && position.z === 0)).toBe(true);
    expect(positions[0]?.screenEdgePx).toBeCloseTo(64, 0);
    expect(positions.at(-1)?.screenEdgePx).toBeCloseTo(844 - 62, 0);

    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]!.y).toBeLessThan(positions[index - 1]!.y);
      expect(positions[index]!.screenGapPx).toBeGreaterThanOrEqual(8);
    }
  });

  it('uniformly scales the queue on shorter portrait screens instead of overlapping planets', () => {
    const tall = createPortraitOverviewLayout(planets, 430, 932, { topInsetPx: 64, bottomInsetPx: 62 });
    const short = createPortraitOverviewLayout(planets, 360, 640, { topInsetPx: 58, bottomInsetPx: 58 });

    expect(short.scale).toBeLessThan(tall.scale);
    expect([...short.values()].every((position) => position.screenGapPx >= 8)).toBe(true);
  });
});

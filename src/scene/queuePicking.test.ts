import { describe, expect, it } from 'vitest';
import { chooseClosestQueueTarget } from './queuePicking';

describe('chooseClosestQueueTarget', () => {
  it('selects the side planet nearest the pointer when its touch area overlaps the centered planet', () => {
    const target = chooseClosestQueueTarget(
      { x: 710, y: 420 },
      [
        { key: 'earth', x: 600, y: 420, radius: 150 },
        { key: 'mars', x: 720, y: 420, radius: 72 }
      ]
    );

    expect(target).toBe('mars');
  });

  it('returns undefined when the pointer is outside every planet touch area', () => {
    const target = chooseClosestQueueTarget(
      { x: 80, y: 80 },
      [
        { key: 'earth', x: 600, y: 420, radius: 150 },
        { key: 'mars', x: 720, y: 420, radius: 72 }
      ]
    );

    expect(target).toBeUndefined();
  });
});

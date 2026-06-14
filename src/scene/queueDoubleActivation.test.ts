import { describe, expect, it } from 'vitest';
import { QueueDoubleActivation } from './queueDoubleActivation';

describe('QueueDoubleActivation', () => {
  it('activates a planet when it is clicked twice inside 420ms', () => {
    const activation = new QueueDoubleActivation(420);

    expect(activation.register('earth', 1_000)).toBe(false);
    expect(activation.register('earth', 1_390)).toBe(true);
  });

  it('starts a new sequence when a different planet is clicked', () => {
    const activation = new QueueDoubleActivation(420);

    expect(activation.register('earth', 1_000)).toBe(false);
    expect(activation.register('mars', 1_200)).toBe(false);
    expect(activation.register('mars', 1_500)).toBe(true);
  });

  it('does not activate after the time window expires', () => {
    const activation = new QueueDoubleActivation(420);

    expect(activation.register('earth', 1_000)).toBe(false);
    expect(activation.register('earth', 1_421)).toBe(false);
  });
});

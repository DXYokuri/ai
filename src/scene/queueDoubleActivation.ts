import type { AtlasTargetKey } from '../domain/types';

export class QueueDoubleActivation {
  private lastKey: AtlasTargetKey | null = null;
  private lastTime = Number.NEGATIVE_INFINITY;

  constructor(private readonly windowMs: number) {}

  register(key: AtlasTargetKey, time: number): boolean {
    const activated = this.lastKey === key && time - this.lastTime <= this.windowMs;
    this.lastKey = activated ? null : key;
    this.lastTime = activated ? Number.NEGATIVE_INFINITY : time;
    return activated;
  }

  reset(): void {
    this.lastKey = null;
    this.lastTime = Number.NEGATIVE_INFINITY;
  }
}

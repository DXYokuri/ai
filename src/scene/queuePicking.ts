import type { PlanetKey } from '../domain/types';

export interface QueuePickPoint {
  x: number;
  y: number;
}

export interface QueuePickTarget extends QueuePickPoint {
  key: PlanetKey;
  radius: number;
}

export function chooseClosestQueueTarget(
  pointer: QueuePickPoint,
  targets: QueuePickTarget[]
): PlanetKey | undefined {
  let closestKey: PlanetKey | undefined;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    const deltaX = pointer.x - target.x;
    const deltaY = pointer.y - target.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared <= target.radius * target.radius && distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestKey = target.key;
    }
  }

  return closestKey;
}

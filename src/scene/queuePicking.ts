import type { AtlasTargetKey } from '../domain/types';

export interface QueuePickPoint {
  x: number;
  y: number;
}

export interface QueuePickTarget extends QueuePickPoint {
  key: AtlasTargetKey;
  radius: number;
}

export function chooseClosestQueueTarget(
  pointer: QueuePickPoint,
  targets: QueuePickTarget[]
): AtlasTargetKey | undefined {
  let closestKey: AtlasTargetKey | undefined;
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

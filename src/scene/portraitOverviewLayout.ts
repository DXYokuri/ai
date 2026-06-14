import type { PlanetKey, PlanetRecord } from '../domain/types';
import { renderTone } from './renderTone';

export interface PortraitOverviewInsets {
  topInsetPx: number;
  bottomInsetPx: number;
  cameraZ?: number;
  fieldOfViewDegrees?: number;
  minimumGapPx?: number;
}

export interface PortraitOverviewPosition {
  x: 0;
  y: number;
  z: 0;
  screenEdgePx: number;
  screenGapPx: number;
}

export interface PortraitOverviewLayout extends Map<PlanetKey, PortraitOverviewPosition> {
  scale: number;
}

export function createPortraitOverviewLayout(
  planets: readonly (PlanetRecord & { key: PlanetKey })[],
  _width: number,
  height: number,
  insets: PortraitOverviewInsets
): PortraitOverviewLayout {
  const minimumGapPx = insets.minimumGapPx ?? 8;
  const top = insets.topInsetPx;
  const bottom = height - insets.bottomInsetPx;
  const availableHeight = Math.max(bottom - top, 1);
  const cameraZ = insets.cameraZ ?? 17.8;
  const fieldOfView = ((insets.fieldOfViewDegrees ?? 42) * Math.PI) / 180;
  const visibleWorldHeight = 2 * cameraZ * Math.tan(fieldOfView / 2);
  const pixelsPerWorldUnit = height / visibleWorldHeight;
  const baseRadii = planets.map(
    (planet) => planet.visualRadius * renderTone.layout.overviewScale * pixelsPerWorldUnit
  );
  const radiusTotal = baseRadii.reduce((total, radius) => total + radius * 2, 0);
  const scale = Math.min(1, (availableHeight - minimumGapPx * (planets.length - 1)) / radiusTotal);
  const scaledDiameters = baseRadii.map((radius) => radius * 2 * scale);
  const remainingSpace = availableHeight - scaledDiameters.reduce((total, diameter) => total + diameter, 0);
  const gapPx = Math.max(minimumGapPx, remainingSpace / Math.max(planets.length - 1, 1));
  const layout = new Map<PlanetKey, PortraitOverviewPosition>() as PortraitOverviewLayout;
  let cursor = top;
  let previousEdge = top;

  planets.forEach((planet, index) => {
    const diameter = scaledDiameters[index];
    const centerPx = cursor + diameter / 2;
    const normalizedY = 0.5 - centerPx / height;

    layout.set(planet.key, {
      x: 0,
      y: normalizedY * visibleWorldHeight,
      z: 0,
      screenEdgePx: index === planets.length - 1 ? cursor + diameter : cursor,
      screenGapPx: index === 0 ? gapPx : cursor - previousEdge
    });
    previousEdge = cursor + diameter;
    cursor += diameter + gapPx;
  });

  layout.scale = scale;
  return layout;
}

import type { PlanetKey, PlanetRecord } from '../domain/types';
import { renderTone } from './renderTone';

export interface PlanetRenderPlan {
  key: PlanetKey;
  x: number;
  y: number;
  z: number;
  radius: number;
  pickRadius: number;
  floatPhase: number;
  rotationSpeed: number;
}

export function createRenderPlan(planets: PlanetRecord[]): PlanetRenderPlan[] {
  return planets.map((planet, index) => ({
    key: planet.key,
    x: planet.overviewX,
    y: planet.key === 'sun' ? -0.08 : 0,
    z: planet.key === 'sun' ? -0.25 : 0,
    radius: planet.visualRadius * renderTone.layout.overviewScale,
    pickRadius: Math.max(planet.visualRadius * renderTone.layout.overviewScale * 1.6, 0.48),
    floatPhase: index * 0.72,
    rotationSpeed: planet.key === 'sun' ? 0.0015 : 0.0024 + index * 0.00018
  }));
}

import { describe, expect, it } from 'vitest';
import { renderTone } from './renderTone';

describe('renderTone', () => {
  it('keeps planet lighting under the dimmed cinematic thresholds', () => {
    expect(renderTone.exposure).toBeLessThanOrEqual(0.9);
    expect(renderTone.bloom.strength).toBeLessThanOrEqual(0.34);
    expect(renderTone.lights.sunIntensity).toBeLessThanOrEqual(2.52);
    expect(renderTone.lights.rimIntensity).toBeLessThanOrEqual(0.78);
    expect(renderTone.materials.sunEmissiveIntensity).toBeLessThanOrEqual(0.46);
    expect(renderTone.atmosphere.planetIntensity).toBeLessThanOrEqual(0.42);
    expect(renderTone.atmosphere.sunIntensity).toBeLessThanOrEqual(0.24);
  });

  it('slightly lifts overview planet visibility and rim glow', () => {
    expect(renderTone.exposure).toBeGreaterThanOrEqual(0.86);
    expect(renderTone.lights.ambientIntensity).toBeGreaterThanOrEqual(0.22);
    expect(renderTone.atmosphere.planetIntensity).toBeGreaterThanOrEqual(0.32);
    expect(renderTone.surface.shadowFloor).toBeGreaterThanOrEqual(0.24);
  });
});

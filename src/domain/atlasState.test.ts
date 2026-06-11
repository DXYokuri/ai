import { describe, expect, it } from 'vitest';
import { createAtlasState, selectPlanet, completeTransitionIn, beginReturn, completeReturn } from './atlasState';

describe('atlasState', () => {
  it('moves through the required overview/detail lifecycle', () => {
    const initial = createAtlasState();
    const entering = selectPlanet(initial, 'earth');
    const detail = completeTransitionIn(entering);
    const returning = beginReturn(detail);
    const overview = completeReturn(returning);

    expect(initial.mode).toBe('overview');
    expect(entering).toMatchObject({ mode: 'transition-in', selectedPlanet: 'earth' });
    expect(detail).toMatchObject({ mode: 'detail', selectedPlanet: 'earth' });
    expect(returning).toMatchObject({ mode: 'transition-out', selectedPlanet: 'earth' });
    expect(overview).toMatchObject({ mode: 'overview', selectedPlanet: null });
  });

  it('retargets planet selection from detail and active transition states', () => {
    const enteringEarth = selectPlanet(createAtlasState(), 'earth');
    const enteringVenus = selectPlanet(enteringEarth, 'venus');
    const detailVenus = completeTransitionIn(enteringVenus);
    const enteringJupiter = selectPlanet(detailVenus, 'jupiter');
    const returningJupiter = beginReturn(completeTransitionIn(enteringJupiter));
    const enteringMars = selectPlanet(returningJupiter, 'mars');

    expect(enteringVenus).toMatchObject({ mode: 'transition-in', selectedPlanet: 'venus' });
    expect(enteringJupiter).toMatchObject({ mode: 'transition-in', selectedPlanet: 'jupiter' });
    expect(enteringMars).toMatchObject({ mode: 'transition-in', selectedPlanet: 'mars' });
  });

  it('does not replay detail focus when selecting the already locked planet', () => {
    const detail = completeTransitionIn(selectPlanet(createAtlasState(), 'earth'));

    expect(selectPlanet(detail, 'earth')).toBe(detail);
  });

  it('enters and leaves the hidden Pluto target through the standard lifecycle', () => {
    const entering = selectPlanet(createAtlasState(), 'pluto');
    const detail = completeTransitionIn(entering);
    const returning = beginReturn(detail);

    expect(entering).toMatchObject({ mode: 'transition-in', selectedPlanet: 'pluto' });
    expect(detail).toMatchObject({ mode: 'detail', selectedPlanet: 'pluto' });
    expect(completeReturn(returning)).toMatchObject({ mode: 'overview', selectedPlanet: null });
  });
});

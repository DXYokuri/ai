import type { AtlasState, PlanetKey } from './types';

export function createAtlasState(): AtlasState {
  return {
    mode: 'overview',
    selectedPlanet: null
  };
}

export function selectPlanet(state: AtlasState, selectedPlanet: PlanetKey): AtlasState {
  if (state.mode === 'detail' && state.selectedPlanet === selectedPlanet) {
    return state;
  }

  if (state.mode === 'transition-in' && state.selectedPlanet === selectedPlanet) {
    return state;
  }

  return {
    mode: 'transition-in',
    selectedPlanet
  };
}

export function completeTransitionIn(state: AtlasState): AtlasState {
  if (state.mode !== 'transition-in' || !state.selectedPlanet) {
    return state;
  }

  return {
    mode: 'detail',
    selectedPlanet: state.selectedPlanet
  };
}

export function beginReturn(state: AtlasState): AtlasState {
  if ((state.mode !== 'detail' && state.mode !== 'transition-in') || !state.selectedPlanet) {
    return state;
  }

  return {
    mode: 'transition-out',
    selectedPlanet: state.selectedPlanet
  };
}

export function completeReturn(state: AtlasState): AtlasState {
  if (state.mode !== 'transition-out') {
    return state;
  }

  return {
    mode: 'overview',
    selectedPlanet: null
  };
}

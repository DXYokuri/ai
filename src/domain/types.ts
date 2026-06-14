export type PlanetKey =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export type HiddenPlanetKey = 'pluto';
export type AtlasTargetKey = PlanetKey | HiddenPlanetKey;
export type AtlasMode = 'overview' | 'transition-in' | 'detail' | 'transition-out';

export interface PlanetTextures {
  color: string;
  previewColor?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
  clouds?: string;
  night?: string;
  ring?: string;
}

export interface PlanetRecord {
  key: AtlasTargetKey;
  label: string;
  order: number;
  visualRadius: number;
  overviewX: number;
  detailScale: number;
  color: string;
  accent: string;
  textures: PlanetTextures;
  stats: Record<string, string>;
  environment: Record<string, string>;
  mission: string[];
}

export interface AtlasState {
  mode: AtlasMode;
  selectedPlanet: AtlasTargetKey | null;
}

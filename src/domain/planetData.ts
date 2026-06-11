import type { AtlasTargetKey, PlanetKey, PlanetRecord } from './types';

const PLANET_TEXTURE = 'https://unpkg.com/artastra@1.0.8/textures';
const THREE_PLANETS = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets';

export const PLANET_ORDER = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune'
] as const satisfies readonly PlanetKey[];

export type MainPlanetRecord = PlanetRecord & { key: PlanetKey };

export const planets: MainPlanetRecord[] = [
  {
    key: 'sun',
    label: 'SUN',
    order: 0,
    visualRadius: 1.95,
    overviewX: -7.1,
    detailScale: 2.35,
    color: '#f3f0dd',
    accent: '#fff4c2',
    textures: {
      color: `${PLANET_TEXTURE}/sun.jpg`
    },
    stats: {
      diameter: '1,392,700 km',
      mass: '1.989e30 kg',
      gravity: '274 m/s2',
      rotation: '25.4 days'
    },
    environment: {
      class: 'G-Type Main Sequence',
      surface: '5,778 K',
      corona: '1-3 MK',
      output: '3.828e26 W'
    },
    mission: ['Solar Dynamics Observatory', 'Parker Solar Probe', 'SOHO Helioseismology']
  },
  {
    key: 'mercury',
    label: 'MERCURY',
    order: 1,
    visualRadius: 0.42,
    overviewX: -4.75,
    detailScale: 1.45,
    color: '#a8a8a0',
    accent: '#d8d6cf',
    textures: {
      color: `${PLANET_TEXTURE}/2k_mercury.jpg`
    },
    stats: {
      diameter: '4,879 km',
      mass: '3.301e23 kg',
      gravity: '3.7 m/s2',
      orbit: '88 days'
    },
    environment: {
      temperature: '-173 to 427 C',
      atmosphere: 'Trace exosphere',
      pressure: 'Near vacuum',
      radiation: 'High solar flux'
    },
    mission: ['MESSENGER Surface Map', 'BepiColombo Cruise', 'Polar Ice Survey']
  },
  {
    key: 'venus',
    label: 'VENUS',
    order: 2,
    visualRadius: 0.62,
    overviewX: -3.25,
    detailScale: 1.65,
    color: '#c2a46c',
    accent: '#f3d38d',
    textures: {
      color: `${PLANET_TEXTURE}/8k_venus_surface.jpg`,
      roughness: `${PLANET_TEXTURE}/4k_venus_atmosphere.jpg`
    },
    stats: {
      diameter: '12,104 km',
      mass: '4.867e24 kg',
      gravity: '8.87 m/s2',
      orbit: '224.7 days'
    },
    environment: {
      temperature: '464 C',
      atmosphere: 'CO2 / N2',
      pressure: '92 bar',
      clouds: 'Sulfuric acid'
    },
    mission: ['Magellan Radar Archive', 'DAVINCI Descent Prep', 'VERITAS Surface Grid']
  },
  {
    key: 'earth',
    label: 'EARTH',
    order: 3,
    visualRadius: 0.66,
    overviewX: -1.5,
    detailScale: 1.9,
    color: '#8fa8b8',
    accent: '#d7f4ff',
    textures: {
      color: `${THREE_PLANETS}/earth_atmos_2048.jpg`,
      normal: `${THREE_PLANETS}/earth_normal_2048.jpg`,
      roughness: `${THREE_PLANETS}/earth_specular_2048.jpg`,
      clouds: `${THREE_PLANETS}/earth_clouds_1024.png`,
      night: `${THREE_PLANETS}/earth_lights_2048.png`
    },
    stats: {
      diameter: '12,742 km',
      mass: '5.972e24 kg',
      gravity: '9.81 m/s2',
      orbit: '365.25 days'
    },
    environment: {
      temperature: '-89 to 58 C',
      atmosphere: 'N2 / O2',
      pressure: '101.3 kPa',
      water: '71% surface'
    },
    mission: ['ISS Telemetry Relay', 'Landsat Climate Index', 'Deep Space Network Node']
  },
  {
    key: 'mars',
    label: 'MARS',
    order: 4,
    visualRadius: 0.52,
    overviewX: 0.35,
    detailScale: 1.55,
    color: '#b2653e',
    accent: '#ffb08a',
    textures: {
      color: `${PLANET_TEXTURE}/mars.jpg`
    },
    stats: {
      diameter: '6,779 km',
      mass: '6.417e23 kg',
      gravity: '3.71 m/s2',
      orbit: '687 days'
    },
    environment: {
      temperature: '-125 to 20 C',
      atmosphere: 'CO2 thin',
      pressure: '0.636 kPa',
      dust: 'Global storms'
    },
    mission: ['Perseverance Sample Cache', 'MRO Terrain Relay', 'Phobos Recon Window']
  },
  {
    key: 'jupiter',
    label: 'JUPITER',
    order: 5,
    visualRadius: 1.05,
    overviewX: 2.45,
    detailScale: 2.05,
    color: '#b6a28b',
    accent: '#f4dcc0',
    textures: {
      color: `${PLANET_TEXTURE}/jupiter.jpg`
    },
    stats: {
      diameter: '139,820 km',
      mass: '1.898e27 kg',
      gravity: '24.79 m/s2',
      orbit: '11.86 years'
    },
    environment: {
      temperature: '-145 C cloud tops',
      atmosphere: 'H2 / He',
      pressure: 'Layered bands',
      storms: 'Great Red Spot'
    },
    mission: ['Juno Magnetosphere Pass', 'Europa Clipper Transit', 'Io Plasma Torus Scan']
  },
  {
    key: 'saturn',
    label: 'SATURN',
    order: 6,
    visualRadius: 0.92,
    overviewX: 4.65,
    detailScale: 1.95,
    color: '#c6b28d',
    accent: '#fff1c7',
    textures: {
      color: `${PLANET_TEXTURE}/8k_saturn.jpg`,
      ring: `${PLANET_TEXTURE}/saturn_rings_black2.png`
    },
    stats: {
      diameter: '116,460 km',
      mass: '5.683e26 kg',
      gravity: '10.44 m/s2',
      orbit: '29.45 years'
    },
    environment: {
      temperature: '-178 C',
      atmosphere: 'H2 / He',
      rings: 'Ice and rock',
      wind: '1,800 km/h'
    },
    mission: ['Cassini Legacy Archive', 'Titan Radar Survey', 'Ring Plane Occultation']
  },
  {
    key: 'uranus',
    label: 'URANUS',
    order: 7,
    visualRadius: 0.64,
    overviewX: 6.45,
    detailScale: 1.7,
    color: '#9ec7ca',
    accent: '#dcffff',
    textures: {
      color: `${PLANET_TEXTURE}/2k_uranus.jpg`
    },
    stats: {
      diameter: '50,724 km',
      mass: '8.681e25 kg',
      gravity: '8.69 m/s2',
      orbit: '84 years'
    },
    environment: {
      temperature: '-224 C',
      atmosphere: 'H2 / He / CH4',
      tilt: '97.8 degrees',
      field: 'Offset magnetic axis'
    },
    mission: ['Ice Giant Orbiter Study', 'Miranda Terrain Sweep', 'Methane Band Analysis']
  },
  {
    key: 'neptune',
    label: 'NEPTUNE',
    order: 8,
    visualRadius: 0.62,
    overviewX: 8.05,
    detailScale: 1.7,
    color: '#536aa9',
    accent: '#b9c8ff',
    textures: {
      color: `${PLANET_TEXTURE}/2k_neptune.jpg`
    },
    stats: {
      diameter: '49,244 km',
      mass: '1.024e26 kg',
      gravity: '11.15 m/s2',
      orbit: '164.8 years'
    },
    environment: {
      temperature: '-214 C',
      atmosphere: 'H2 / He / CH4',
      wind: '2,100 km/h',
      storms: 'Dark vortex systems'
    },
    mission: ['Triton Cryovolcanic Watch', 'Voyager Archive Compare', 'Outer Lens Calibration']
  }
];

export const hiddenPlanets: PlanetRecord[] = [
  {
    key: 'pluto',
    label: 'PLUTO',
    order: 9,
    visualRadius: 0.38,
    overviewX: 9.8,
    detailScale: 1.5,
    color: '#e8dfda',
    accent: '#f5ebe5',
    textures: {
      color: './textures/pluto/pluto-color-8k.jpg',
      normal: './textures/pluto/pluto-normal-8k.jpg',
      roughness: './textures/pluto/pluto-roughness-8k.jpg'
    },
    stats: {
      diameter: '2,376.6 km',
      mass: '1.303e22 kg',
      gravity: '0.62 m/s2',
      orbit: '248 years'
    },
    environment: {
      temperature: '-233 to -223 C',
      atmosphere: 'N2 / CH4 / CO',
      pressure: '1 Pa',
      surface: 'Nitrogen ice plains'
    },
    mission: ['New Horizons Flyby', 'Sputnik Planitia Survey', 'Charon Binary Analysis']
  }
];

export const atlasTargets: PlanetRecord[] = [...planets, ...hiddenPlanets];

export const planetByKey = new Map<AtlasTargetKey, PlanetRecord>(
  atlasTargets.map((planet) => [planet.key, planet])
);

export function getPlanet(key: AtlasTargetKey): PlanetRecord {
  const planet = planetByKey.get(key);

  if (!planet) {
    throw new Error(`Unknown planet key: ${key}`);
  }

  return planet;
}

export function isHiddenTarget(key: AtlasTargetKey): key is 'pluto' {
  return key === 'pluto';
}

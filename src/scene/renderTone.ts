export const renderTone = {
  layout: {
    overviewScale: 0.72,
    detailPlanetRadius: 1.34,
    inactivePlanetScale: 0.22
  },
  exposure: 0.87,
  bloom: {
    strength: 0.33,
    radius: 0.4,
    threshold: 0.32
  },
  lights: {
    sunIntensity: 2.48,
    rimIntensity: 0.77,
    ambientIntensity: 0.23
  },
  materials: {
    sunEmissiveIntensity: 0.42,
    cloudOpacity: 0.29,
    nightOpacity: 0.2,
    saturnRingOpacity: 0.5
  },
  atmosphere: {
    sunIntensity: 0.18,
    sunOutlineIntensity: 0.2,
    planetIntensity: 0.34
  },
  surface: {
    shadowFloor: 0.25,
    terminatorSoftness: 0.92,
    edgeDarkening: 0.21
  },
  detailOverlay: {
    orbitOpacity: 0.22,
    scanRingOpacity: 0.28,
    dataLineOpacity: 0.14
  }
} as const;

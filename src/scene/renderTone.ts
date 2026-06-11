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
    ambientIntensity: 0.23,
    domeDetailIntensity: 0.16,
    domeQueueIntensity: 0.72
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
    planetIntensity: 0.34,
    innerDetailIntensity: 0.42,
    outerDetailIntensity: 0.18,
    queueIntensityScale: 0.62
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
  },
  queue: {
    spacingX: 2.16,
    spacingY: 0.23,
    spacingZ: 1.08,
    neighborRadius: 0.62,
    radiusFalloff: 0.065,
    minimumNeighborRadius: 0.24,
    neighborVisibility: 0.82,
    minimumVisibility: 0.2,
    cameraZ: 9.35,
    cameraY: 0.34,
    ambientRotationY: -0.1,
    backgroundOpacity: 0.14,
    transitionDuration: 0.96,
    touchRadiusScale: 1.12,
    minimumTouchRadius: 38
  }
} as const;

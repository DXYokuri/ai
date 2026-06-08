import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { AtlasMode, PlanetKey } from '../domain/types';
import { SolarAtlasScene } from './SolarAtlasScene';

interface SolarAtlasStageProps {
  queueMode: boolean;
  mode: AtlasMode;
  selectedPlanet: PlanetKey | null;
  onSelectPlanet: (planetKey: PlanetKey) => void;
  onReturn: () => void;
}

export function SolarAtlasStage({ queueMode, mode, selectedPlanet, onSelectPlanet, onReturn }: SolarAtlasStageProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SolarAtlasScene | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !window.WebGLRenderingContext) {
      return undefined;
    }

    sceneRef.current = new SolarAtlasScene(container, onSelectPlanet, onReturn);

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [onReturn, onSelectPlanet]);

  useEffect(() => {
    sceneRef.current?.sync({ queueMode, mode, selectedPlanet });
  }, [queueMode, mode, selectedPlanet]);

  return (
    <div className="webgl-stage" ref={containerRef} aria-hidden="true">
      <div className="webgl-fallback" />
    </div>
  );
}

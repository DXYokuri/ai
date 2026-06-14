import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AtlasMode, AtlasTargetKey } from '../domain/types';
import { SolarAtlasScene } from './SolarAtlasScene';

interface SolarAtlasStageProps {
  queueMode: boolean;
  mode: AtlasMode;
  selectedPlanet: AtlasTargetKey | null;
  onSelectPlanet: (planetKey: AtlasTargetKey) => void;
  onActivatePlanet: (planetKey: AtlasTargetKey) => void;
  onReturn: () => void;
}

export function SolarAtlasStage({
  queueMode,
  mode,
  selectedPlanet,
  onSelectPlanet,
  onActivatePlanet,
  onReturn
}: SolarAtlasStageProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SolarAtlasScene | null>(null);
  const [compatibilityMode, setCompatibilityMode] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !window.WebGLRenderingContext) {
      setCompatibilityMode(true);
      return undefined;
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setCompatibilityMode(true);
    };

    try {
      sceneRef.current = new SolarAtlasScene(container, onSelectPlanet, onActivatePlanet, onReturn);
      sceneRef.current.rendererElement.addEventListener('webglcontextlost', handleContextLost);
      setCompatibilityMode(false);

      return () => {
        sceneRef.current?.rendererElement.removeEventListener('webglcontextlost', handleContextLost);
        sceneRef.current?.dispose();
        sceneRef.current = null;
      };
    } catch {
      setCompatibilityMode(true);
      return undefined;
    }
  }, [onActivatePlanet, onReturn, onSelectPlanet]);

  useEffect(() => {
    sceneRef.current?.sync({ queueMode, mode, selectedPlanet });
  }, [queueMode, mode, selectedPlanet]);

  return (
    <div className="webgl-stage" ref={containerRef}>
      <div className="webgl-fallback" />
      {compatibilityMode ? <CompatibilityFallback /> : null}
    </div>
  );
}

function CompatibilityFallback(): ReactElement {
  const url = 'https://future-ui-solar-system-atlas.vercel.app';

  return (
    <section className="compatibility-fallback" aria-label="WebGL compatibility mode">
      <div className="compatibility-fallback__solar-system" aria-hidden="true">
        {['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map((key) => (
          <span className={`compatibility-planet compatibility-planet--${key}`} key={key} />
        ))}
      </div>
      <div className="compatibility-fallback__message">
        <strong>兼容模式 / WebGL compatibility mode / 호환 모드</strong>
        <p>请使用 Chrome、Safari 或系统浏览器打开。</p>
        <p>Open in Chrome, Safari, or your system browser.</p>
        <p>Chrome, Safari 또는 시스템 브라우저에서 열어 주세요.</p>
        <div>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(url)}>
            Copy link
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Open externally
          </a>
        </div>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock3,
  Orbit,
  Satellite,
  Search,
  Shield,
  Signal
} from 'lucide-react';
import { beginReturn, completeReturn, completeTransitionIn, createAtlasState, selectPlanet } from '../domain/atlasState';
import { getPlanet, planets } from '../domain/planetData';
import type { AtlasState, AtlasTargetKey, PlanetKey } from '../domain/types';
import { SolarAtlasStage } from '../scene/SolarAtlasStage';

interface AppProps {
  animationDurationMs?: number;
}

export function App({ animationDurationMs = 2100 }: AppProps): ReactElement {
  const [atlasState, setAtlasState] = useState<AtlasState>(() => createAtlasState());
  const [queueMode, setQueueMode] = useState(false);
  const selectedPlanet = atlasState.selectedPlanet ? getPlanet(atlasState.selectedPlanet) : null;
  const detailVisible = atlasState.mode === 'detail' || atlasState.mode === 'transition-in' || atlasState.mode === 'transition-out';

  const handleSelectPlanet = useCallback(
    (planetKey: AtlasTargetKey) => {
      setAtlasState((state) => selectPlanet(state, planetKey));
    },
    []
  );

  const handleReturn = useCallback(() => {
    setQueueMode(false);
    setAtlasState((state) => beginReturn(state));
  }, []);

  const handleToggleQueueMode = useCallback(() => {
    const nextActive = !queueMode;

    if (nextActive && atlasState.mode === 'transition-out' && atlasState.selectedPlanet) {
      setAtlasState((state) =>
        state.mode === 'transition-out' && state.selectedPlanet ? selectPlanet(state, state.selectedPlanet) : state
      );
    }

    setQueueMode(nextActive);
  }, [atlasState.mode, atlasState.selectedPlanet, queueMode]);

  useEffect(() => {
    if (atlasState.mode !== 'transition-in' && atlasState.mode !== 'transition-out') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAtlasState((state) => (state.mode === 'transition-in' ? completeTransitionIn(state) : completeReturn(state)));
    }, animationDurationMs);

    return () => window.clearTimeout(timeoutId);
  }, [animationDurationMs, atlasState.mode, atlasState.selectedPlanet]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleReturn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReturn]);

  useEffect(() => {
    if (!detailVisible) {
      setQueueMode(false);
    }
  }, [detailVisible]);

  const shellClassName = useMemo(() => {
    const classes = ['atlas-shell', `mode-${atlasState.mode}`];

    if (queueMode) {
      classes.push('mode-queue');
    }

    return classes.join(' ');
  }, [atlasState.mode, queueMode]);

  return (
    <main className={shellClassName}>
      <div className="atlas-experience">
        <SolarAtlasStage
          queueMode={queueMode && detailVisible}
          mode={atlasState.mode}
          selectedPlanet={atlasState.selectedPlanet}
          onSelectPlanet={handleSelectPlanet}
          onReturn={handleReturn}
        />

        <OverviewOverlay
          mode={atlasState.mode}
          selectedPlanet={atlasState.selectedPlanet}
          onSelectPlanet={handleSelectPlanet}
        />

        {detailVisible && selectedPlanet ? (
          <>
            <QueueToggle active={queueMode} onToggle={handleToggleQueueMode} />
            <DetailHud
              queueMode={queueMode}
              planet={selectedPlanet}
              locked={detailVisible}
              onOpenPluto={() => handleSelectPlanet('pluto')}
              onBackdropReturn={handleReturn}
            />
          </>
        ) : null}

        <div className="scanline-pass" aria-hidden="true" />
      </div>
    </main>
  );
}

interface OverviewOverlayProps {
  mode: AtlasState['mode'];
  selectedPlanet: AtlasTargetKey | null;
  onSelectPlanet: (planetKey: AtlasTargetKey) => void;
}

function OverviewOverlay({ mode, selectedPlanet, onSelectPlanet }: OverviewOverlayProps): ReactElement {
  const headerVisible = mode === 'overview' || mode === 'transition-in';

  return (
    <section className={`overview-overlay ${headerVisible ? 'is-visible' : ''}`} aria-label="Solar system overview">
      <header className="system-header">
        <div className="header-brand">
          <span>FUI 2.0</span>
          <small>FUTURE INTERFACE</small>
        </div>
        <nav className="header-tabs" aria-label="Atlas navigation">
          <span>OVERVIEW</span>
          <span>SYSTEMS</span>
          <span>ANALYTICS</span>
          <span>CONFIG</span>
        </nav>
        <div className="header-clock">
          <small>SYNC</small>
          <span>14:35:42</span>
        </div>
      </header>

      <div className="overview-rail" aria-label="Planet selection">
        {planets.map((planet) => (
          <button
            aria-pressed={selectedPlanet === planet.key}
            className={`planet-command ${selectedPlanet === planet.key ? 'is-active' : ''}`}
            key={planet.key}
            onClick={() => onSelectPlanet(planet.key)}
            style={{ '--planet-accent': planet.accent } as CSSProperties}
            type="button"
          >
            <Orbit size={14} />
            <span>{planet.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface DetailHudProps {
  queueMode: boolean;
  planet: ReturnType<typeof getPlanet>;
  locked: boolean;
  onOpenPluto: () => void;
  onBackdropReturn: () => void;
}

function DetailHud({ queueMode, planet, locked, onOpenPluto, onBackdropReturn }: DetailHudProps): ReactElement {
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanelKey | null>(null);

  useEffect(() => {
    setFocusedPanel(null);
  }, [queueMode]);

  const handleOpenPluto = () => {
    setFocusedPanel(null);
    onOpenPluto();
  };

  return (
    <section
      className={`detail-hud ${locked ? 'is-locked' : ''} ${queueMode ? 'is-queue' : ''} ${focusedPanel ? 'has-focused-panel' : ''}`}
      aria-label={`${planet.label} detail interface`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (focusedPanel) {
            setFocusedPanel(null);
          } else {
            onBackdropReturn();
          }
        }
      }}
    >
      <StandardDetailHud
        focusedPanel={focusedPanel}
        onFocusPanel={setFocusedPanel}
        onOpenPluto={handleOpenPluto}
        planet={planet}
      />

      <footer className="detail-footer">
        <span>MODE COMMAND</span>
        <span>OPERATOR USER_01</span>
        <span>SYSTEM UPTIME 294d 14h 32m</span>
        <span>STATUS LOCKED</span>
      </footer>
    </section>
  );
}

interface QueueToggleProps {
  active: boolean;
  onToggle: () => void;
}

function QueueToggle({ active, onToggle }: QueueToggleProps): ReactElement {
  const Icon = active ? ChevronDown : ChevronUp;

  return (
    <button
      aria-label={active ? 'Exit planet queue mode' : 'Enter planet queue mode'}
      className="queue-toggle"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      type="button"
    >
      <Icon aria-hidden="true" size={116} strokeWidth={0.82} />
    </button>
  );
}

interface StandardDetailHudProps {
  focusedPanel: FocusedPanelKey | null;
  onFocusPanel: (panel: FocusedPanelKey | null) => void;
  onOpenPluto: () => void;
  planet: ReturnType<typeof getPlanet>;
}

type FocusedPanelKey = 'planet-info' | 'statistics' | 'environment' | 'orbit-position';

const plutoSearchResults = [
  'PLUTO REMOVED FROM THE EIGHT-PLANET ROSTER',
  'PLUTO DELISTED FROM THE SOLAR SYSTEM',
  'PLUTO RECLASSIFIED AS A DWARF PLANET'
];

function StandardDetailHud({ focusedPanel, onFocusPanel, onOpenPluto, planet }: StandardDetailHudProps): ReactElement {
  const panelDefinitions: Array<{
    key: FocusedPanelKey;
    icon: ReactNode;
    renderContent: () => ReactNode;
    title: string;
  }> = [
    {
      key: 'planet-info',
      icon: <Shield size={15} />,
      title: 'PLANET INFO',
      renderContent: () => (
        <div className="planet-title">
          <small>PLANETARY NODE</small>
          <strong>{planet.label}</strong>
          <span>
            {planet.key.toUpperCase()}-{planet.order.toString().padStart(2, '0')}/ATLAS
          </span>
        </div>
      )
    },
    {
      key: 'statistics',
      icon: <Activity size={15} />,
      title: 'STATISTICS',
      renderContent: () => <MetricRows data={planet.stats} />
    },
    {
      key: 'environment',
      icon: <Signal size={15} />,
      title: 'ENVIRONMENT',
      renderContent: () => <MetricRows data={planet.environment} />
    },
    {
      key: 'orbit-position',
      icon: <Satellite size={15} />,
      title: 'ORBIT POSITION',
      renderContent: () => <PlanetPositionChart planetKey={planet.key} />
    }
  ];
  const activePanel = panelDefinitions.find((panel) => panel.key === focusedPanel) ?? null;

  return (
    <>
      <div className="detail-hud__left">
        {panelDefinitions.slice(0, 3).map((panel) => (
          <HudPanel
            focusable
            icon={panel.icon}
            key={panel.key}
            onFocus={() => onFocusPanel(panel.key)}
            title={panel.title}
          >
            {panel.renderContent()}
          </HudPanel>
        ))}
      </div>

      <div className="detail-lock">
        <div className="target-label">
          <span>TARGET</span>
          <strong>{planet.label}</strong>
        </div>
        <div className="lock-reticle" aria-hidden="true" />
      </div>

      <div className="detail-hud__right">
        <HudPanel icon={<Clock3 size={15} />} title="SYSTEM TIME">
          <SystemTime />
        </HudPanel>

        <HudPanel actionLabel="Discover hidden Pluto target" icon={<Search size={15} />} onAction={onOpenPluto} title="SEARCH">
          <ul className="mission-list">
            {plutoSearchResults.map((result) => (
              <li key={result}>
                <span />
                {result}
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel
          focusable
          icon={<Satellite size={15} />}
          onFocus={() => onFocusPanel('orbit-position')}
          title="ORBIT POSITION"
        >
          <PlanetPositionChart planetKey={planet.key} />
        </HudPanel>
      </div>

      {activePanel ? (
        <div
          aria-label={`${activePanel.title} expanded panel`}
          className="detail-panel-focus-layer"
          onClick={() => onFocusPanel(null)}
          role="dialog"
        >
          <HudPanel expanded icon={activePanel.icon} title={activePanel.title}>
            <div className="detail-panel-content-refresh" key={`content-${planet.key}-${activePanel.title}`}>
              {activePanel.renderContent()}
            </div>
          </HudPanel>
        </div>
      ) : null}
    </>
  );
}

function SystemTime(): ReactElement {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const date = now.toLocaleDateString('en-CA');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="system-time">
      <strong>{time}</strong>
      <span>{date}</span>
      <small>{zone}</small>
    </div>
  );
}

interface PlanetPositionChartProps {
  planetKey: AtlasTargetKey;
}

const positionChartSizes: Record<Exclude<PlanetKey, 'sun'>, number> = {
  mercury: 8,
  venus: 13,
  earth: 14,
  mars: 10,
  jupiter: 23,
  saturn: 20,
  uranus: 16,
  neptune: 15
};

function PlanetPositionChart({ planetKey }: PlanetPositionChartProps): ReactElement {
  const orbitalPlanets = planets.filter((planet): planet is typeof planet & { key: Exclude<PlanetKey, 'sun'> } => planet.key !== 'sun');
  const unlisted = planetKey === 'pluto';
  const selectedIndex = planetKey === 'sun' || unlisted ? 3.5 : orbitalPlanets.findIndex((planet) => planet.key === planetKey);

  return (
    <div aria-label="Planet position chart" className="planet-position-chart">
      <div
        aria-label="Sun external reference"
        className={`planet-position-chart__sun-reference ${planetKey === 'sun' ? 'is-active' : ''}`}
      >
        <i />
        <span>SUN</span>
      </div>
      <div className="planet-position-chart__axis" aria-hidden="true" />
      <div className="planet-position-chart__track">
        {orbitalPlanets.map((planet, index) => {
          const active = !unlisted && planet.key === planetKey;
          const offset = (index - selectedIndex) * 26;

          return (
            <div
              aria-current={active ? 'true' : undefined}
              aria-label={`${planet.label} position`}
              className={`planet-silhouette planet-silhouette--${planet.key} ${active ? 'is-active' : ''}`}
              data-testid="planet-silhouette"
              key={planet.key}
              style={
                {
                  '--planet-accent': planet.accent,
                  '--planet-offset': `${offset}px`,
                  '--planet-size': `${positionChartSizes[planet.key]}px`
                } as CSSProperties
              }
            >
              <i />
              <span>{planet.label}</span>
            </div>
          );
        })}
      </div>
      {unlisted ? <span className="planet-position-chart__unlisted">TARGET UNLISTED</span> : null}
    </div>
  );
}

interface HudPanelProps {
  actionLabel?: string;
  children: ReactNode;
  expanded?: boolean;
  focusable?: boolean;
  icon: ReactNode;
  onAction?: () => void;
  onFocus?: () => void;
  title: string;
}

function HudPanel({
  actionLabel,
  children,
  expanded = false,
  focusable = false,
  icon,
  onAction,
  onFocus,
  title
}: HudPanelProps): ReactElement {
  const interactive = focusable || Boolean(onAction);
  const activate = () => {
    if (onAction) {
      onAction();
    } else {
      onFocus?.();
    }
  };

  return (
    <article
      aria-label={actionLabel ?? (focusable ? `Focus ${title} panel` : undefined)}
      className={`hud-panel ${interactive ? 'is-focusable' : ''} ${onAction ? 'is-actionable' : ''} ${expanded ? 'is-expanded' : ''}`}
      onClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              activate();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <header>
        {icon}
        <span>{title}</span>
      </header>
      <div className="hud-panel__body">{children}</div>
    </article>
  );
}

interface MetricRowsProps {
  data: Record<string, string>;
}

function MetricRows({ data }: MetricRowsProps): ReactElement {
  return (
    <dl className="metric-rows">
      {Object.entries(data).map(([label, value]) => (
        <div key={label}>
          <dt>{label.toUpperCase()}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

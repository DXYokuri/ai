import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  Orbit,
  RotateCcw,
  Satellite,
  Search,
  Shield,
  Signal
} from 'lucide-react';
import { beginReturn, completeReturn, completeTransitionIn, createAtlasState, selectPlanet } from '../domain/atlasState';
import { getPlanet, planets } from '../domain/planetData';
import type { AtlasState, PlanetKey } from '../domain/types';
import { SolarAtlasStage } from '../scene/SolarAtlasStage';

interface AppProps {
  animationDurationMs?: number;
}

export function App({ animationDurationMs = 2100 }: AppProps): ReactElement {
  const [atlasState, setAtlasState] = useState<AtlasState>(() => createAtlasState());
  const [glitchActive, setGlitchActive] = useState(false);
  const [authorityMode, setAuthorityMode] = useState(false);
  const selectedPlanet = atlasState.selectedPlanet ? getPlanet(atlasState.selectedPlanet) : null;
  const detailVisible = atlasState.mode === 'detail' || atlasState.mode === 'transition-in' || atlasState.mode === 'transition-out';

  const handleSelectPlanet = useCallback(
    (planetKey: PlanetKey) => {
      setAtlasState((state) => selectPlanet(state, planetKey));
    },
    []
  );

  const handleReturn = useCallback(() => {
    if (authorityMode) {
      setAuthorityMode(false);
    }

    setAtlasState((state) => beginReturn(state));
  }, [authorityMode]);

  const handleToggleAuthorityMode = useCallback(() => {
    const nextActive = !authorityMode;

    if (nextActive && atlasState.mode === 'transition-out' && atlasState.selectedPlanet) {
      setAtlasState((state) =>
        state.mode === 'transition-out' && state.selectedPlanet ? selectPlanet(state, state.selectedPlanet) : state
      );
    }

    setAuthorityMode(nextActive);
  }, [atlasState.mode, atlasState.selectedPlanet, authorityMode]);

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
      setAuthorityMode(false);
    }
  }, [detailVisible]);

  useEffect(() => {
    let scheduleTimeoutId = 0;
    let activeTimeoutId = 0;

    const schedule = () => {
      scheduleTimeoutId = window.setTimeout(
        () => {
          setGlitchActive(true);
          activeTimeoutId = window.setTimeout(() => {
            setGlitchActive(false);
            schedule();
          }, 300 + Math.random() * 500);
        },
        2000 + Math.random() * 3000
      );
    };

    schedule();
    return () => {
      window.clearTimeout(scheduleTimeoutId);
      window.clearTimeout(activeTimeoutId);
    };
  }, []);

  const shellClassName = useMemo(() => {
    const classes = ['atlas-shell', `mode-${atlasState.mode}`];

    if (authorityMode) {
      classes.push('mode-authority');
    }

    if (glitchActive && atlasState.mode === 'overview' && !authorityMode) {
      classes.push('is-glitching');
    }

    return classes.join(' ');
  }, [atlasState.mode, authorityMode, glitchActive]);

  return (
    <main className={shellClassName}>
      <div className="rotate-lock" aria-hidden="true">
        <div className="rotate-lock__frame">
          <RotateCcw size={22} />
          <span>ROTATE DEVICE</span>
          <small>LANDSCAPE MODE</small>
        </div>
      </div>

      <div className="atlas-experience">
        <SolarAtlasStage
          authorityMode={authorityMode && detailVisible}
          mode={atlasState.mode}
          selectedPlanet={atlasState.selectedPlanet}
          onSelectPlanet={handleSelectPlanet}
        />

        <OverviewOverlay
          mode={atlasState.mode}
          selectedPlanet={atlasState.selectedPlanet}
          onSelectPlanet={handleSelectPlanet}
        />

        {detailVisible && selectedPlanet ? (
          <>
            <AuthorityToggle active={authorityMode} onToggle={handleToggleAuthorityMode} />
            <DetailHud
              authorityMode={authorityMode}
              planet={selectedPlanet}
              locked={atlasState.mode === 'detail'}
              onBackdropReturn={handleReturn}
            />
          </>
        ) : null}

        <div className="glitch-pass" aria-hidden="true" />
        <div className="scanline-pass" aria-hidden="true" />
      </div>
    </main>
  );
}

interface OverviewOverlayProps {
  mode: AtlasState['mode'];
  selectedPlanet: PlanetKey | null;
  onSelectPlanet: (planetKey: PlanetKey) => void;
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
  authorityMode: boolean;
  planet: ReturnType<typeof getPlanet>;
  locked: boolean;
  onBackdropReturn: () => void;
}

function DetailHud({ authorityMode, planet, locked, onBackdropReturn }: DetailHudProps): ReactElement {
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanelKey | null>(null);

  useEffect(() => {
    setFocusedPanel(null);
  }, [authorityMode, planet.key]);

  return (
    <section
      className={`detail-hud ${locked ? 'is-locked' : ''} ${authorityMode ? 'is-authority' : ''} ${focusedPanel ? 'has-focused-panel' : ''}`}
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
      {authorityMode ? (
        <AuthorityHud planet={planet} />
      ) : (
        <StandardDetailHud focusedPanel={focusedPanel} onFocusPanel={setFocusedPanel} planet={planet} />
      )}

      <footer className="detail-footer">
        {authorityMode ? (
          <>
            <span>AUTHORITY CLASSIFIED</span>
            <span>ACCESS GRANTED</span>
            <span>RESTRICTED SIGNAL 024-A</span>
            <span>WARNING LIVE</span>
          </>
        ) : (
          <>
            <span>MODE COMMAND</span>
            <span>OPERATOR USER_01</span>
            <span>SYSTEM UPTIME 294d 14h 32m</span>
            <span>STATUS LOCKED</span>
          </>
        )}
      </footer>
    </section>
  );
}

interface AuthorityToggleProps {
  active: boolean;
  onToggle: () => void;
}

function AuthorityToggle({ active, onToggle }: AuthorityToggleProps): ReactElement {
  const Icon = active ? ChevronDown : ChevronUp;

  return (
    <button
      aria-label={active ? 'Exit authority mode' : 'Enter authority mode'}
      className="authority-toggle"
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
  planet: ReturnType<typeof getPlanet>;
}

type FocusedPanelKey = 'planet-info' | 'statistics' | 'environment';

function StandardDetailHud({ focusedPanel, onFocusPanel, planet }: StandardDetailHudProps): ReactElement {
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
    }
  ];
  const activePanel = panelDefinitions.find((panel) => panel.key === focusedPanel) ?? null;

  return (
    <>
      <div className="detail-hud__left">
        {panelDefinitions.map((panel) => (
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
        <HudPanel icon={<Grid3X3 size={15} />} title="ANALYTICS">
          <div className="chart-lines" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="analytics-readout">
            <strong>76%</strong>
            <span>ORBITAL CONFIDENCE</span>
          </div>
        </HudPanel>

        <HudPanel icon={<Search size={15} />} title="MISSION DATABASE">
          <ul className="mission-list">
            {planet.mission.map((mission) => (
              <li key={mission}>
                <span />
                {mission}
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel icon={<Satellite size={15} />} title="ORBIT POSITION">
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
            {activePanel.renderContent()}
          </HudPanel>
        </div>
      ) : null}
    </>
  );
}

interface PlanetPositionChartProps {
  planetKey: PlanetKey;
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
  const selectedIndex = planetKey === 'sun' ? 3.5 : orbitalPlanets.findIndex((planet) => planet.key === planetKey);

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
          const active = planet.key === planetKey;
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
    </div>
  );
}

interface AuthorityHudProps {
  planet: ReturnType<typeof getPlanet>;
}

function AuthorityHud({ planet }: AuthorityHudProps): ReactElement {
  const indexRows = ['241.345', '127.200', '217.231', '124.100', '621.980', '026.534'];
  const logs = [
    'ACCESS GRANTED',
    'CLASSIFIED NODE OPEN',
    `${planet.key.toUpperCase()} ARCHIVE DECODED`,
    'RESTRICTED SIGNAL LOCK',
    'WARNING: DATA LOSS ACTIVE'
  ];

  return (
    <div className="authority-hud" aria-label={`${planet.label} authority mode`}>
      <div className="authority-broadcast" aria-hidden="true">
        <small>SUITABLE FOR</small>
        <strong>BROADCAST DESIGN</strong>
      </div>

      <div className="authority-dotline-field" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="authority-dot-map authority-dot-map--north" aria-hidden="true">
        <div className="authority-map-alert">!</div>
        <svg className="authority-usa-line-map" viewBox="0 0 320 140" role="img" aria-label="Restricted dotted USA map">
          <path
            className="usa-map-outline"
            d="M18 68 L31 50 L59 47 L76 33 L105 37 L132 31 L159 39 L184 38 L207 48 L235 44 L255 54 L281 57 L302 70 L290 84 L260 88 L245 101 L218 96 L198 111 L166 105 L142 116 L118 101 L91 107 L66 91 L42 88 Z"
          />
          <path
            className="usa-map-coast"
            d="M41 52 C53 62 55 80 72 88 M239 51 C228 63 224 82 236 96 M111 38 C114 54 106 66 112 81 M168 39 C159 55 161 78 150 96 M205 48 C198 61 201 75 194 90"
          />
          <path
            className="usa-map-state-lines"
            d="M54 53 H270 M45 68 H295 M53 83 H276 M82 47 V101 M118 39 V106 M154 39 V108 M190 43 V101 M226 49 V95 M260 58 V86"
          />
          <rect className="usa-map-target-zone" x="102" y="50" width="58" height="42" />
          <circle className="usa-map-target-ring" cx="130" cy="70" r="18" />
          <circle className="usa-map-target-core" cx="130" cy="70" r="4" />
          <path className="usa-map-scan" d="M4 118 H312" />
        </svg>
        <div className="usa-map-code">
          <span>223:4</span>
          <span>04:17</span>
        </div>
        <div className="dot-map-bars" />
      </section>

      <section className="authority-column authority-column--left">
        <div className="authority-kicker">RESTRICTED ACCESS</div>
        <h2>AUTHORITY MODE</h2>
        <strong className="authority-grant">ACCESS GRANTED</strong>
        <div className="authority-index">
          <span>NODE</span>
          <b>{planet.key.toUpperCase()}-{planet.order.toString().padStart(2, '0')}</b>
          <span>AUTH</span>
          <b>LEVEL 09</b>
          <span>CLASS</span>
          <b>BLACK FILE</b>
        </div>
        <div className="dot-matrix" aria-hidden="true" />
      </section>

      <section className="authority-column authority-column--right">
        <div className="authority-kicker authority-kicker--red">WARNING / LIVE</div>
        <div className="authority-readouts">
          {indexRows.map((entry, index) => (
            <div key={entry}>
              <span>{entry}</span>
              <i aria-hidden="true" />
              <b>{index % 2 === 0 ? 'DECODE' : 'MONITOR'}</b>
            </div>
          ))}
        </div>
        <div className="authority-dials" aria-hidden="true">
          <div className="authority-dial authority-dial--primary">
            <span />
            <span />
            <span />
          </div>
          <div className="authority-dial authority-dial--secondary">
            <span />
            <span />
          </div>
        </div>
        <div className="authority-map" aria-hidden="true" />
      </section>

      <section className="authority-bottom">
        <div className="authority-wave" aria-hidden="true" />
        <ul>
          {logs.map((log) => (
            <li key={log}>{log}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface HudPanelProps {
  children: ReactNode;
  expanded?: boolean;
  focusable?: boolean;
  icon: ReactNode;
  onFocus?: () => void;
  title: string;
}

function HudPanel({ children, expanded = false, focusable = false, icon, onFocus, title }: HudPanelProps): ReactElement {
  return (
    <article
      aria-label={focusable ? `Focus ${title} panel` : undefined}
      className={`hud-panel ${focusable ? 'is-focusable' : ''} ${expanded ? 'is-expanded' : ''}`}
      onClick={
        focusable
          ? (event) => {
              event.stopPropagation();
              onFocus?.();
            }
          : undefined
      }
      onKeyDown={
        focusable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onFocus?.();
              }
            }
          : undefined
      }
      role={focusable ? 'button' : undefined}
      tabIndex={focusable ? 0 : undefined}
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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the complete overview command rail', () => {
    render(<App animationDurationMs={0} />);

    for (const label of ['SUN', 'MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy();
    }
  });

  it('opens a planet detail HUD and returns with Escape', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeTruthy();
      expect(screen.getAllByText('EARTH').length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('SEARCH')).toBeNull();
    });
  });

  it('keeps the command rail interactive while detail HUD is open', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getAllByText('EARTH').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /jupiter/i }));

    await waitFor(() => {
      expect(screen.getAllByText('JUPITER').length).toBeGreaterThan(0);
    });
  });

  it('can interrupt the return animation with a new planet selection', async () => {
    render(<App animationDurationMs={30} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('STATUS LOCKED')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /mars/i }));

    await waitFor(() => {
      expect(screen.getAllByText('MARS').length).toBeGreaterThan(0);
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });
  });

  it('toggles planet queue mode while keeping the standard detail HUD mounted', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /enter planet queue mode/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/earth detail interface/i).className).toContain('is-queue');
      expect(screen.getByText('PLANET INFO')).toBeTruthy();
      expect(screen.queryByText('AUTHORITY MODE')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /exit planet queue mode/i }));

    await waitFor(() => {
      expect(screen.getByText('PLANET INFO')).toBeTruthy();
      expect(screen.getByLabelText(/earth detail interface/i).className).not.toContain('is-queue');
    });
  });

  it('keeps planet queue mode active while switching planets through the persistent rail', async () => {
    render(<App animationDurationMs={2000} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /enter planet queue mode/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/earth detail interface/i).className).toContain('is-queue');
    });

    fireEvent.click(screen.getByRole('button', { name: /jupiter/i }));

    await waitFor(() => {
      expect(screen.getByText('PLANET INFO')).toBeTruthy();
      expect(screen.getAllByText('JUPITER').length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/jupiter detail interface/i).className).toContain('is-queue');
    });
  });

  it('enters planet queue mode while the return animation is in progress', async () => {
    render(<App animationDurationMs={2000} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /enter planet queue mode/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/earth detail interface/i).className).toContain('is-queue');
      expect(screen.getByText('SEARCH')).toBeTruthy();
    });
  });

  it('expands a left detail panel over the planet without removing the surrounding HUD', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    const panelTrigger = await screen.findByRole('button', { name: /focus planet info panel/i });
    fireEvent.click(panelTrigger);

    const expandedPanel = await screen.findByRole('dialog', { name: /planet info expanded panel/i });
    expect(screen.getAllByText('PLANET INFO')).toHaveLength(2);
    expect(screen.getByText('SEARCH')).toBeTruthy();
    expect(screen.getByLabelText(/earth detail interface/i).className).toContain('has-focused-panel');

    fireEvent.click(expandedPanel);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /planet info expanded panel/i })).toBeNull();
    });
  });

  it('shows an eight-planet position chart with the selected planet centered and the sun as an external reference', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    const chart = await screen.findByLabelText('Planet position chart');
    expect(within(chart).getAllByTestId('planet-silhouette')).toHaveLength(8);
    expect(within(chart).getByLabelText('EARTH position').getAttribute('aria-current')).toBe('true');
    expect(within(chart).getByLabelText('Sun external reference')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^sun$/i }));

    await waitFor(() => {
      expect(within(screen.getByLabelText('Planet position chart')).getByLabelText('Sun external reference').className).toContain(
        'is-active'
      );
    });
  });

  it('shows the device time and advances it every second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByText('SYSTEM TIME')).toBeTruthy();
    expect(screen.getByText('03:04:05')).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('03:04:06')).toBeTruthy();
  });

  it('keeps a focused panel open while switching planets and lets orbit position expand', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));
    fireEvent.click(await screen.findByRole('button', { name: /focus orbit position panel/i }));

    expect(await screen.findByRole('dialog', { name: /orbit position expanded panel/i })).toBeTruthy();
    const expandedPanel = screen.getByRole('dialog', { name: /orbit position expanded panel/i });
    fireEvent.click(screen.getByRole('button', { name: /jupiter/i }));

    await waitFor(() => {
      const currentPanel = screen.getByRole('dialog', { name: /orbit position expanded panel/i });
      expect(currentPanel).toBe(expandedPanel);
      const expandedChart = within(currentPanel).getByLabelText('Planet position chart');
      expect(within(expandedChart).getByLabelText('JUPITER position').getAttribute('aria-current')).toBe('true');
    });
  });

  it('keeps detail controls interactive during transition-in and closes focused panels for major view changes', async () => {
    render(<App animationDurationMs={2000} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));
    const detail = await screen.findByLabelText(/earth detail interface/i);
    expect(detail.className).toContain('is-locked');

    fireEvent.click(screen.getByRole('button', { name: /focus orbit position panel/i }));
    expect(await screen.findByRole('dialog', { name: /orbit position expanded panel/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /discover hidden pluto target/i }));
    await waitFor(() => expect(screen.getByLabelText(/pluto detail interface/i)).toBeTruthy());
    expect(screen.queryByRole('dialog', { name: /orbit position expanded panel/i })).toBeNull();
  });

  it('replaces the right middle panel with Pluto search results', async () => {
    render(<App animationDurationMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    expect(await screen.findByText('SEARCH')).toBeTruthy();
    expect(screen.getByText('PLUTO REMOVED FROM THE EIGHT-PLANET ROSTER')).toBeTruthy();
    expect(screen.getByText('PLUTO DELISTED FROM THE SOLAR SYSTEM')).toBeTruthy();
    expect(screen.getByText('PLUTO RECLASSIFIED AS A DWARF PLANET')).toBeTruthy();
    const detail = screen.getByLabelText(/earth detail interface/i);
    expect(within(detail).queryByText('ANALYTICS')).toBeNull();
    expect(within(detail).queryByText('MISSION DATABASE')).toBeNull();
  });

  it('opens hidden Pluto from search without adding it to the persistent command rail', async () => {
    render(<App animationDurationMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /earth/i }));
    fireEvent.click(await screen.findByRole('button', { name: /discover hidden pluto target/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/pluto detail interface/i)).toBeTruthy();
      expect(screen.getAllByText('PLUTO').length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText('Planet selection').querySelectorAll('button')).toHaveLength(9);
    expect(screen.queryByRole('button', { name: /^pluto$/i })).toBeNull();

    const chart = screen.getByLabelText('Planet position chart');
    expect(within(chart).getByText('TARGET UNLISTED')).toBeTruthy();
    expect(within(chart).getAllByTestId('planet-silhouette').every((silhouette) => !silhouette.hasAttribute('aria-current'))).toBe(
      true
    );

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));
    await waitFor(() => expect(screen.getByLabelText(/earth detail interface/i)).toBeTruthy());
  });
});

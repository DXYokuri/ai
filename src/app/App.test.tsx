import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
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
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
      expect(screen.getAllByText('EARTH').length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('MISSION DATABASE')).toBeNull();
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
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('STATUS LOCKED')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /mars/i }));

    await waitFor(() => {
      expect(screen.getAllByText('MARS').length).toBeGreaterThan(0);
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });
  });

  it('toggles planet queue mode while keeping the standard detail HUD mounted', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
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
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
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
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /enter planet queue mode/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/earth detail interface/i).className).toContain('is-queue');
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });
  });

  it('expands a left detail panel over the planet without removing the surrounding HUD', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    const panelTrigger = await screen.findByRole('button', { name: /focus planet info panel/i });
    fireEvent.click(panelTrigger);

    const expandedPanel = await screen.findByRole('dialog', { name: /planet info expanded panel/i });
    expect(screen.getAllByText('PLANET INFO')).toHaveLength(2);
    expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
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
});

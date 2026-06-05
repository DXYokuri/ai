import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('toggles authority mode from the hidden detail arrow', async () => {
    render(<App animationDurationMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /enter authority mode/i }));

    await waitFor(() => {
      expect(screen.getByText('AUTHORITY MODE')).toBeTruthy();
      expect(screen.getAllByText('ACCESS GRANTED').length).toBeGreaterThan(0);
      expect(screen.queryByText('PLANET INFO')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /exit authority mode/i }));

    await waitFor(() => {
      expect(screen.getByText('PLANET INFO')).toBeTruthy();
      expect(screen.queryByText('AUTHORITY MODE')).toBeNull();
    });
  });

  it('exits authority mode to the newly selected planet after an authority rail switch', async () => {
    render(<App animationDurationMs={2000} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /enter authority mode/i }));

    await waitFor(() => {
      expect(screen.getByText('AUTHORITY MODE')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /jupiter/i }));
    fireEvent.click(screen.getByRole('button', { name: /exit authority mode/i }));

    await waitFor(() => {
      expect(screen.getByText('PLANET INFO')).toBeTruthy();
      expect(screen.getAllByText('JUPITER').length).toBeGreaterThan(0);
      expect(screen.queryByText('AUTHORITY MODE')).toBeNull();
    });
  });

  it('enters authority mode while the return animation is in progress', async () => {
    render(<App animationDurationMs={2000} />);

    fireEvent.click(screen.getByRole('button', { name: /earth/i }));

    await waitFor(() => {
      expect(screen.getByText('MISSION DATABASE')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /enter authority mode/i }));

    await waitFor(() => {
      expect(screen.getByText('AUTHORITY MODE')).toBeTruthy();
      expect(screen.queryByText('MISSION DATABASE')).toBeNull();
    });
  });
});

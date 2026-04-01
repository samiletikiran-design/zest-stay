import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OfflineIndicator from './OfflineIndicator';
import React from 'react';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('does not render when online', () => {
    render(<OfflineIndicator />);
    expect(screen.queryByText(/You are currently offline/i)).not.toBeInTheDocument();
  });

  it('renders when offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(<OfflineIndicator />);
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
  });

  it('updates when going offline', () => {
    render(<OfflineIndicator />);
    expect(screen.queryByText(/You are currently offline/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
  });

  it('updates when going online', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(<OfflineIndicator />);
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/You are currently offline/i)).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

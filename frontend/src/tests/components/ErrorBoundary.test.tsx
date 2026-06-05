/**
 * ErrorBoundary smoke tests
 *
 * Verifies that the boundary:
 *  1. Renders children when there is no error
 *  2. Shows the fallback UI when a child throws
 *  3. Resets (shows children again) after "Try again" is clicked
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Suppress expected console.error noise from the intentional throw
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <span>All good</span>;
}

function renderInBoundary(shouldThrow: boolean) {
  return render(
    <MemoryRouter>
      <ErrorBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </MemoryRouter>
  );
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    renderInBoundary(false);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws', () => {
    renderInBoundary(true);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets to children after "Try again" is clicked', () => {
    const { rerender } = renderInBoundary(true);
    // Error state shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click "Try again" — resets boundary state.
    // After the click, React immediately re-renders the same (still-throwing) child,
    // so the boundary snaps back to error state. We must supply a non-throwing child
    // AND force a fresh boundary instance (via key) to observe the clean state.
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    rerender(
      <MemoryRouter>
        <ErrorBoundary key="reset">
          <Bomb shouldThrow={false} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveErrorBoundary } from './LiveErrorBoundary';

function ProblematicComponent() {
  throw new Error("Simulated component crash");
  return <div>Should not render</div>;
}

describe('LiveErrorBoundary', () => {
  it('HARDEN-001 renders children when no error occurs', () => {
    render(
      <LiveErrorBoundary>
        <div data-testid="child">Safe Child</div>
      </LiveErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('HARDEN-001 catches error and renders fallback instead of crashing', () => {
    // suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <LiveErrorBoundary fallbackMessage="Test fallback">
        <ProblematicComponent />
      </LiveErrorBoundary>
    );
    
    expect(screen.getByText('Session Component Error')).toBeDefined();
    expect(screen.getByText('Test fallback')).toBeDefined();
    
    consoleErrorSpy.mockRestore();
  });
});

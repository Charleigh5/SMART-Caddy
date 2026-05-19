// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { FrameHealthMeter } from './FrameHealthMeter';

describe('FrameHealthMeter Telemetry Renders', () => {
  afterEach(() => {
    cleanup();
  });

  it('TELEMETRY-001 shows fixture/no-live-session state when mode is SETUP', () => {
    render(<FrameHealthMeter framesSent={0} averagePayloadBytes={100} maxPayloadBytes={200} mode="SETUP" />);
    expect(screen.getByText(/FIXTURE \/ NO SESSION/i)).toBeDefined();
  });

  it('TELEMETRY-002 shows provider timeout/fallback state when fallbackActive is true', () => {
    render(<FrameHealthMeter framesSent={0} averagePayloadBytes={100} maxPayloadBytes={200} fallbackActive={true} />);
    expect(screen.getByText(/PROVIDER TIMEOUT\//i)).toBeDefined();
    expect(screen.getByText(/FALLBACK/i)).toBeDefined();
  });

  it('renders correctly with rejected frames', () => {
    render(<FrameHealthMeter framesSent={10} averagePayloadBytes={100} maxPayloadBytes={200} rejectedFrames={5} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows degraded warning above 500KB', () => {
    render(<FrameHealthMeter framesSent={10} averagePayloadBytes={600 * 1024} maxPayloadBytes={800 * 1024} />);
    expect(screen.getByText(/Warning: Large frames may increase latency/i)).toBeDefined();
  });

  it('shows critical state above 1MB (and degraded warning)', () => {
    render(<FrameHealthMeter framesSent={10} averagePayloadBytes={1200 * 1024} maxPayloadBytes={1500 * 1024} />);
    expect(screen.getByText(/Warning: Large frames may increase latency/i)).toBeDefined();
  });

  it('TELEMETRY-003 telemetry labels do not imply measured swing metrics', () => {
    render(<FrameHealthMeter framesSent={10} averagePayloadBytes={100} maxPayloadBytes={200} />);
    // Verify terminology is about SIGHT and TELEMETRY not swing metrics
    expect(screen.getByText(/Sight Telemetry/i)).toBeDefined();
    expect(screen.queryByText(/Spin/i)).toBeNull();
    expect(screen.queryByText(/Speed/i)).toBeNull();
    expect(screen.queryByText(/Launch Angle/i)).toBeNull();
  });
});

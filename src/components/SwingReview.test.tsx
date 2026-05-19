/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SwingReview } from './SwingReview';
import { getSwingVideo, getSwingVideos } from '../lib/storage';
import { useParams, useNavigate } from 'react-router-dom';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn()
}));

vi.mock('../lib/storage', () => ({
  getSwingVideo: vi.fn(),
  getSwingVideos: vi.fn(),
  saveSwingAnalysis: vi.fn(),
  saveCoachingNote: vi.fn(),
  saveDrill: vi.fn(),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('SwingReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: '123' });
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    
    // Default mocks
    vi.mocked(getSwingVideos).mockResolvedValue([]);
  });

  const sampleBlob = new Blob([''], { type: 'video/mp4' });

  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.fetch = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({}),
      ok: true
    })) as any;
  });

  it('renders when video.analysis is undefined', async () => {
    vi.mocked(getSwingVideo).mockResolvedValue({
      id: '123',
      timestamp: Date.now(),
      viewAngle: 'FACE_ON',
      blob: sampleBlob,
      analyzed: true,
      analysis: undefined
    });

    render(<SwingReview />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    
    expect(screen.getAllByText(/AI Feedback/i).length).toBeGreaterThan(0);
  });

  it('renders when video.analysis is empty object', async () => {
    vi.mocked(getSwingVideo).mockResolvedValue({
      id: '123',
      timestamp: Date.now(),
      viewAngle: 'FACE_ON',
      blob: sampleBlob,
      analyzed: true,
      analysis: {}
    });

    render(<SwingReview />);
    await waitFor(() => {
      expect(screen.getAllByText(/AI Feedback/i).length).toBeGreaterThan(0);
    });
  });

  it('renders data-gap warning when dataGaps array contains items', async () => {
    vi.mocked(getSwingVideo).mockResolvedValue({
      id: '123',
      timestamp: Date.now(),
      viewAngle: 'FACE_ON',
      blob: sampleBlob,
      analyzed: true,
      analysis: {
        dataGaps: ['Low lighting', 'Blurry club face']
      }
    });

    render(<SwingReview />);
    await waitFor(() => {
      expect(screen.getAllByText('ESTIMATED').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Low lighting').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Blurry club face').length).toBeGreaterThan(0);
    });
  });

  it('renders visualization components and truth labels in single view', async () => {
    vi.mocked(getSwingVideo).mockResolvedValue({
      id: '123',
      timestamp: Date.now(),
      viewAngle: 'FACE_ON',
      blob: sampleBlob,
      analyzed: true,
      analysis: {
        tempoAnalysis: { ratio: 3 }
      }
    });

    render(<SwingReview />);
    
    await waitFor(() => {
      expect(screen.getAllByText('MOCK_RENDER_TEST').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Power & Efficiency').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Swing DNA Profile').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Interactive Visualization Demo/i).length).toBeGreaterThan(0);
    });
  });

  it('renders visualization in comparison view without crashing', async () => {
    vi.mocked(getSwingVideo).mockResolvedValue({
      id: '123',
      timestamp: Date.now(),
      viewAngle: 'FACE_ON',
      blob: sampleBlob,
      analyzed: true,
      analysis: { tempoAnalysis: { ratio: 3 } }
    });
    
    vi.mocked(getSwingVideos).mockResolvedValue([
      { id: '123', timestamp: Date.now(), viewAngle: 'FACE_ON', blob: sampleBlob, analyzed: true },
      { id: '456', timestamp: Date.now() - 1000, viewAngle: 'FACE_ON', blob: sampleBlob, analyzed: true, analysis: { tempoAnalysis: { ratio: 4 } } }
    ]);

    render(<SwingReview />);
    
    await waitFor(() => {
      expect(screen.getAllByText(/Compare/i)[0]).toBeInTheDocument();
    });

    // Click "Compare" on the older video to engage comparison mode
    // We get the specific compare buttons
    const compareButtons = screen.getAllByText(/Compare$|Compare /i).filter(el => el.tagName === 'BUTTON' || el.closest('button'));
    fireEvent.click(compareButtons[compareButtons.length - 1]);

    // Now wait for the modal Select Swing to Compare to appear
    await waitFor(() => {
      expect(screen.getByText(/Select Swing to Compare/i)).toBeInTheDocument();
    });

    // Then click the swing entry in the modal modal (it contains the text "Analyzed")
    const selectButton = screen.getAllByText(/Analyzed/i).find(el => el.closest('button'));
    if (selectButton) fireEvent.click(selectButton.closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Hardware Metrics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hardware Metrics'));

    // Should render the visualizer which now has the compare properties
    await waitFor(() => {
      expect(screen.getAllByText('MOCK_RENDER_TEST').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Power & Efficiency').length).toBeGreaterThan(0);
      // Data in bar/radar should reflect comparison (though we are mostly testing it doesn't crash here)
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});

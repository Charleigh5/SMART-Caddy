// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AiCaddy } from './AiCaddy';
import React from 'react';

// Mock matchMedia
window.matchMedia = window.matchMedia || function() {
    return {
        matches: false,
        media: '',
        onchange: null,
        addListener: function() {}, // Deprecated
        removeListener: function() {}, // Deprecated
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; },
    } as any;
};

// Mock AudioContext
(window as any).AudioContext = vi.fn(function() {
  return {
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    }),
    decodeAudioData: vi.fn().mockResolvedValue({}),
    destination: {},
    close: vi.fn().mockResolvedValue({}),
  };
});

describe('AiCaddy Voice Query', () => {
  let mockRecognition: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      continuous: false,
      interimResults: false,
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null
    };

    // Override global SpeechRecognition
    (window as any).SpeechRecognition = vi.fn(function() { return mockRecognition; });

    // Mock fetch for API calls
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ targetStrategy: 'aim left', clubThought: 'swing smooth', missStrategy: '', shotRecommendation: '' }),
    });
    global.fetch = mockFetch;
  });
  
  afterEach(() => {
    cleanup();
  });

  it('VOICE-001/002 shows mic button when supported', () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    expect(screen.getAllByTitle('Speak to Caddy').length).toBeGreaterThan(0);
  });

  it('VOICE-003 starts listening on click', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    await waitFor(() => {
      expect(mockRecognition.start).toHaveBeenCalled();
    });
  });

  it('VOICE-002 hides mic button when unsupported', () => {
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;
    cleanup(); // fresh clean
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    expect(screen.queryByTitle('Speak to Caddy')).toBeNull();
  });

  it('VOICE-004 transcript captured and displayed', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    // Simulate recognition result
    if (mockRecognition.onresult) {
      mockRecognition.onresult({
        resultIndex: 0,
        results: [
          [{ transcript: 'what club should I hit', isFinal: true }]
        ]
      });
    }

    // Simulate end of speech
    if (mockRecognition.onend) {
      mockRecognition.onend();
    }

    await waitFor(() => {
      expect(screen.getByText(/"what club should I hit"/)).toBeDefined();
    });
  });

  it('VOICE-005 empty transcript is not submitted', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    if (mockRecognition.onresult) {
      mockRecognition.onresult({
        resultIndex: 0,
        results: [[{ transcript: '   ', isFinal: true }]]
      });
    }
    if (mockRecognition.onend) {
      mockRecognition.onend();
    }

    await waitFor(() => {
      // Voice state should revert to idle if empty instead of showing transcript
      expect(screen.queryByText('Voice Query Transcript')).toBeNull();
    });
  });

  it('VOICE-008 user can cancel/stop listening', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    // Start
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    if (mockRecognition.onstart) {
      mockRecognition.onstart(); // state = 'listening'
    }
    
    // Stop: clicking the button again while listening should stop it
    await waitFor(() => {
      expect(screen.getAllByTitle('Stop listening').length).toBeGreaterThan(0);
    });
    
    fireEvent.click(screen.getAllByTitle('Stop listening')[0]);
    
    await waitFor(() => {
      expect(mockRecognition.stop).toHaveBeenCalled();
    });
  });

  it('VOICE-009 error states render for no-speech', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    if (mockRecognition.onerror) {
      mockRecognition.onerror({ error: 'no-speech' });
    }

    await waitFor(() => {
      expect(screen.getByText(/Error: no-speech/)).toBeDefined();
    });
  });

  it('clear transcript works', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    if (mockRecognition.onresult) {
      mockRecognition.onresult({
        resultIndex: 0,
        results: [[{ transcript: 'hello', isFinal: true }]]
      });
    }
    if (mockRecognition.onend) {
      mockRecognition.onend();
    }

    await waitFor(() => {
      expect(screen.getByText(/"hello"/)).toBeDefined();
    });

    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      expect(screen.queryByText(/"hello"/)).toBeNull();
    });
  });

  it('VOICE-006 caddy-advice receives spoken query safely & VOICE-007 TTS triggers', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    
    if (mockRecognition.onresult) {
      mockRecognition.onresult({
        resultIndex: 0,
        results: [[{ transcript: 'test voice query', isFinal: true }]]
      });
    }
    if (mockRecognition.onend) {
      mockRecognition.onend();
    }

    await waitFor(() => {
      expect(screen.getByText('Send Query')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Send Query'));

    await waitFor(() => {
      // 1. Should call /api/gemini/caddy-advice
      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/caddy-advice', expect.any(Object));
      const call = mockFetch.mock.calls.find((c: any) => c[0] === '/api/gemini/caddy-advice');
      const body = JSON.parse(call[1].body);
      expect(body.context).toContain('test voice query');

      // 2. Should automatically call /api/gemini/tts since it's a voice query and we checked autoTTS by default
      expect(mockFetch).toHaveBeenCalledWith('/api/gemini/tts', expect.any(Object));
    });
  });

  it('VOICE-007 autoTTS does not fire for manual typed requests', async () => {
    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    
    // Using manual ask for advice button (does not have "Speak to Caddy" title)
    fireEvent.click(screen.getByText('Manual Request'));

    await waitFor(() => {
      const caddyFetchCall = mockFetch.mock.calls.find((c: any) => c[0] === '/api/gemini/caddy-advice');
      expect(caddyFetchCall).toBeDefined();
    });

    // We wait for the promise roundtrip...
    await new Promise(r => setTimeout(r, 0));

    // Confirm TTS was never called
    const ttsCall = mockFetch.mock.calls.find((c: any) => c[0] === '/api/gemini/tts');
    expect(ttsCall).toBeUndefined();
  });

  it('VOICE-008 TTS failure degrades safely without crashing advice card', async () => {
    // Override fetch mock locally just for TTS to fail
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/gemini/tts') {
        return { ok: false, status: 500, json: async () => ({ error: 'TTS fail' }), text: async () => 'TTS fail' };
      }
      return {
        ok: true,
        json: async () => ({ advice: { targetStrategy: 'safe' } })
      };
    }) as any;

    render(<AiCaddy courseName="Test" holeNumber={1} par={4} shots={[]} />);
    fireEvent.click(screen.getAllByTitle('Speak to Caddy')[0]);
    if (mockRecognition.onresult) mockRecognition.onresult({ resultIndex: 0, results: [[{ transcript: 'test fail', isFinal: true }]] });
    if (mockRecognition.onend) mockRecognition.onend();
    
    await waitFor(() => expect(screen.getByText('Send Query')).toBeDefined());
    fireEvent.click(screen.getByText('Send Query'));

    // Should not crash, and should finish fetching.
    await waitFor(() => {
      expect(screen.getByText(/Target Strategy/i)).toBeDefined(); // Since wait for finishes
    });
    
    // Restore global fetch
    global.fetch = originalFetch;
  });
});


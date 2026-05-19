import { describe, it, expect } from 'vitest';
import { parseCaddyOutput } from './caddyModelOutputParser';
import deltaFixture from './__fixtures__/geminiLiveTranscriptDelta.json';
import finalFixture from './__fixtures__/geminiLiveFinalAdvice.json';
import malformedFixture from './__fixtures__/malformedAdvice.json';

describe('Caddy Model Output Parser', () => {
    it('PARSER-001 parses Gemini Live transcript delta into partial advice', () => {
        const parsed = parseCaddyOutput(deltaFixture.delta, 'delta-1', 'GEMINI_LIVE');
        expect(parsed.situation).toBe('Ball in rough, 150 yards out.');
        expect(parsed.smartTarget).toBe('Back of the green.');
        expect(parsed.clubThought).toBe('Aggressive through the turf.');
        expect(parsed.avoid).toBe('Right bunker.');
        expect(parsed.riskLevel).toBe('MEDIUM');
    });

    it('PARSER-002 parses Gemini Live final output into complete CaddyAdvice', () => {
        const parsed = parseCaddyOutput(finalFixture.text, 'final-1', 'GEMINI_LIVE');
        expect(parsed.situation).toBe('Par 4 approach.');
        expect(parsed.smartTarget).toBe('Left side of flag.');
        expect(parsed.clubThought).toBe('Smooth 7 iron.');
        expect(parsed.avoid).toBe('Water left.');
        expect(parsed.riskLevel).toBe('LOW');
    });

    it('PARSER-005 malformed output falls back safely', () => {
        const parsed = parseCaddyOutput(malformedFixture.text, 'malformed-1', 'GEMINI_LIVE');
        expect(parsed.situation).toBe('General play'); // default fallback from extractField
        expect(parsed.smartTarget).toBe('Center green');
        expect(parsed.riskLevel).toBe('UNKNOWN');
        expect(parsed.rawModelSummary).toBe(malformedFixture.text);
    });
});

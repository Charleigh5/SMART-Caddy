import { describe, it, expect } from 'vitest';
import { CaddyAdvice } from './caddyAdviceSchema';

describe('Caddy Advice Schema', () => {
    it('is exportable and types are correct', () => {
        const advice: CaddyAdvice = {
            adviceId: '1',
            createdAt: '2023-01-01',
            source: 'GEMINI_LIVE',
            situation: 'Test',
            smartTarget: 'Test',
            clubThought: 'Test',
            avoid: 'Test',
            riskLevel: 'LOW',
            confidence: 'HIGH',
            dataGaps: [],
            blockedClaims: [],
            evidenceLabels: []
        };
        expect(advice.adviceId).toBe('1');
    });
});

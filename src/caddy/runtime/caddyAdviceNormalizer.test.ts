import { describe, it, expect } from 'vitest';
import { normalizeAdvice } from './caddyAdviceNormalizer';
import restFallbackFixture from './__fixtures__/restFallbackAdvice.json';
import localFallbackFixture from './__fixtures__/localFallbackAdvice.json';
import { CaddyAdvice } from './caddyAdviceSchema';

describe('Caddy Advice Normalizer', () => {
    it('PARSER-003 parses REST fallback into same CaddyAdvice schema', () => {
        const normalized = normalizeAdvice(restFallbackFixture as Partial<CaddyAdvice>);
        expect(normalized.adviceId).toBe('rest-123');
        expect(normalized.source).toBe('REST_FALLBACK');
        expect(normalized.situation).toBe('Fairway, 100 yds');
        expect(normalized.confidence).toBe('HIGH');
        expect(normalized.confidenceCapped).toBe(false);
    });

    it('PARSER-004 parses local fallback into same CaddyAdvice schema', () => {
        const normalized = normalizeAdvice(localFallbackFixture as Partial<CaddyAdvice>);
        expect(normalized.source).toBe('LOCAL_FALLBACK');
        expect(normalized.dataGaps).toContain('No connection');
        expect(normalized.confidence).toBe('LOW'); // since dataGaps length > 0
        expect(normalized.confidenceCapped).toBe(true);
    });

    it('PARSER-006 missing confidence defaults to LOW', () => {
        const partial: Partial<CaddyAdvice> = {
            situation: 'Test',
            smartTarget: 'Test',
            clubThought: 'Test',
            avoid: 'Test'
        };
        const normalized = normalizeAdvice(partial);
        expect(normalized.confidence).toBe('LOW');
    });

    it('PARSER-007 missing risk defaults to UNKNOWN', () => {
        const normalized = normalizeAdvice({});
        expect(normalized.riskLevel).toBe('UNKNOWN');
    });

    it('PARSER-009 truth guard caps confidence when blocked claims exist', () => {
        const partial: Partial<CaddyAdvice> = {
            rawModelSummary: 'Your smash factor is 1.45',
            confidence: 'HIGH'
        };
        const normalized = normalizeAdvice(partial);
        expect(normalized.confidence).toBe('BLOCKED');
        expect(normalized.confidenceCapped).toBe(true);
        expect(normalized.blockedClaims).toContain('SMASH FACTOR');
    });
});

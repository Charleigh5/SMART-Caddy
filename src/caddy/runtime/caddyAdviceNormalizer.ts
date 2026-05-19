import { CaddyAdvice } from './caddyAdviceSchema';
import { checkTruthGuard } from './caddyTruthGuard';

export function normalizeAdvice(partial: Partial<CaddyAdvice>): CaddyAdvice {
    const rawText = partial.rawModelSummary || `${partial.situation} ${partial.smartTarget} ${partial.clubThought} ${partial.avoid}`;
    const { blocked, blockedClaims } = checkTruthGuard(rawText);
    
    let baseConfidence = partial.confidence || 'MEDIUM';
    let dataGaps = partial.dataGaps || [];
    let confidenceCapped = false;
    
    if (blocked) {
        baseConfidence = 'BLOCKED';
        confidenceCapped = true;
    } else if (dataGaps.length > 0) {
        baseConfidence = 'LOW';
        confidenceCapped = true;
    }

    if (!partial.confidence && !blocked && dataGaps.length === 0) {
        baseConfidence = 'LOW'; // default if missing
    }

    return {
        adviceId: partial.adviceId || `advice-${Date.now()}`,
        createdAt: partial.createdAt || new Date().toISOString(),
        source: partial.source || 'LOCAL_FALLBACK',
        situation: partial.situation || 'Unknown Situation',
        smartTarget: partial.smartTarget || 'Unknown Target',
        clubThought: partial.clubThought || 'Standard Swing',
        avoid: partial.avoid || 'Hazards',
        riskLevel: partial.riskLevel || 'UNKNOWN',
        confidence: baseConfidence,
        dataGaps: dataGaps,
        blockedClaims: [...(partial.blockedClaims || []), ...blockedClaims],
        evidenceLabels: partial.evidenceLabels || [],
        recommendedClubId: partial.recommendedClubId,
        targetYardage: partial.targetYardage,
        targetDescription: partial.targetDescription,
        rawModelSummary: partial.rawModelSummary,
        confidenceCapped
    };
}

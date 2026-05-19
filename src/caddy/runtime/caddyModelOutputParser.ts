import { CaddyAdvice, AdviceSource } from './caddyAdviceSchema';
import { checkTruthGuard } from './caddyTruthGuard';

function extractField(text: string, fieldName: string, defaultValue: string = 'Unknown'): string {
    const regex = new RegExp(`\\*?\\*?${fieldName}:?\\*?\\*?\\s*(.*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : defaultValue;
}

export function parseCaddyOutput(rawText: string, adviceId: string, source: AdviceSource): Partial<CaddyAdvice> {
    const situation = extractField(rawText, 'Situation', 'General play');
    const smartTarget = extractField(rawText, 'Smart Target', 'Center green');
    const clubThought = extractField(rawText, 'Club Thought', 'Smooth swing');
    const avoid = extractField(rawText, 'Avoid', 'Short side');
    const rawRisk = extractField(rawText, 'Risk', 'UNKNOWN').toUpperCase();
    
    let riskLevel: any = 'UNKNOWN';
    if (['LOW', 'MEDIUM', 'HIGH'].includes(rawRisk)) riskLevel = rawRisk;

    return {
        adviceId,
        source,
        situation,
        smartTarget,
        clubThought,
        avoid,
        riskLevel,
        rawModelSummary: rawText,
    };
}

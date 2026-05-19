import { ActiveCaddyContextCard, CaddyAdviceReceipt } from './caddyTypes';
import { CaddyAdvice } from './caddyAdviceSchema';
import { LOCAL_FALLBACK_ADVICE } from './caddyFallbacks';
import { saveCaddyAdviceReceipt } from './caddyAdviceReceipt';
import { normalizeAdvice } from './caddyAdviceNormalizer';

export async function requestCaddyAdvice(context: ActiveCaddyContextCard): Promise<CaddyAdviceReceipt> {
  const receiptId = `receipt-${Date.now()}`;
  
  try {
    const contextString = JSON.stringify(context, null, 2);
    
    // We expect the REST API to return JSON resembling our CaddyAdvice shape.
    const res = await fetch('/api/gemini/caddy-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: contextString })
    });
    
    if (!res.ok) {
      throw new Error(`REST API failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    const rawAdvice: Partial<CaddyAdvice> = {
        adviceId: receiptId,
        source: 'REST_FALLBACK',
        situation: data.situation || data.shotRecommendation || 'Current situation analysis.',
        smartTarget: data.targetStrategy || data.smartTarget || 'Center of the green.',
        clubThought: data.clubThought || 'Standard full swing.',
        avoid: data.missStrategy || data.avoid || 'Hazards.',
        riskLevel: data.riskLevel || 'MEDIUM',
        confidence: data.confidence || 'MEDIUM',
        dataGaps: [...context.dataGaps, ...(data.dataGaps || [])],
        rawModelSummary: JSON.stringify(data)
    };
    
    const advice = normalizeAdvice(rawAdvice);
    
    const receipt: CaddyAdviceReceipt = {
        id: receiptId,
        timestamp: new Date().toISOString(),
        context,
        advice,
        source: 'REST_API',
        status: 'SUCCESS'
    };
    
    saveCaddyAdviceReceipt(receipt);
    return receipt;
    
  } catch (err: any) {
    console.error("Caddy Runtime Error:", err);
    
    const receipt: CaddyAdviceReceipt = {
        id: receiptId,
        timestamp: new Date().toISOString(),
        context,
        advice: normalizeAdvice({...LOCAL_FALLBACK_ADVICE, adviceId: receiptId}),
        source: 'LOCAL_FALLBACK',
        status: 'FAILED'
    };
    saveCaddyAdviceReceipt(receipt);
    return receipt;
  }
}

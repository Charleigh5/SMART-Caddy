import { describe, it, expect } from 'vitest';
import { generateReceipt, receiptToMarkdown, QaReceiptMetadata } from './manualQaReceipt';
import { INITIAL_QA_MATRIX } from './manualQaMatrix';
import { INITIAL_LEDGER } from './ledger';

describe('manualQaReceipt tests', () => {
  const mockMetadata: QaReceiptMetadata = {
    qaRunId: 'QA-123',
    createdAt: '2023-01-01',
    tester: 'Test User',
    device: 'Desktop',
    browser: 'Chrome',
    os: 'macOS',
    viewport: '1000x1000',
    microphoneAvailable: true,
    cameraAvailable: true,
    providerConfigState: 'Configured'
  };

  it('QA-RUNNER-010 Every manual QA gate featureId exists in ledger.ts', () => {
    const validFeatureIds = new Set(INITIAL_LEDGER.map(f => f.featureId));
    INITIAL_QA_MATRIX.forEach(gate => {
      expect(validFeatureIds.has(gate.featureId)).toBe(true);
    });
  });

  it('QA-RUNNER-005 JSON receipt export works', () => {
    const receipt = generateReceipt(mockMetadata, INITIAL_QA_MATRIX);
    expect(receipt.metadata.qaRunId).toBe('QA-123');
    expect(receipt.gates.length).toBe(INITIAL_QA_MATRIX.length);
    expect(receipt.summary.total).toBe(INITIAL_QA_MATRIX.length);
    expect(receipt.summary.notTested).toBe(INITIAL_QA_MATRIX.length); // All initially PENDING_REAL_DEVICE_QA
    expect(receipt.featuresEligibleForVerified.length).toBe(0);
    expect(receipt.instructions).toContain('Paste this QA receipt back into the project conversation');
  });

  it('QA-RUNNER-006 Markdown receipt export works', () => {
    const receipt = generateReceipt(mockMetadata, INITIAL_QA_MATRIX);
    const md = receiptToMarkdown(receipt);
    expect(md).toContain('# Manual QA Receipt: QA-123');
    expect(md).toContain('**Tester:** Test User');
    expect(md).toContain('**Device/Browser:** Desktop - macOS - Chrome');
    expect(md).toContain('- **Total Gates:** ' + INITIAL_QA_MATRIX.length);
    expect(md).toContain('Paste this QA receipt back into the project conversation');
  });
});

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

  describe('strict manual QA receipt validation constraints', () => {
    it('reverts PASS to PENDING_REAL_DEVICE_QA if browser contains JSDOM, CI, headless, or mock', () => {
      const badMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        browser: 'HeadlessChrome (ci)'
      };
      const testGate = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'verified_screen.png'
      };

      const receipt = generateReceipt(badMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].notes).toContain('headless/simulated/CI/mock client metadata detected');
    });

    it('reverts PASS to PENDING_REAL_DEVICE_QA if providerConfigState is MOCK_MODE_ACTIVE', () => {
      const badMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        providerConfigState: 'MOCK_MODE_ACTIVE'
      };
      const testGate = {
        id: 'QA-014',
        category: 'Scorecard cropper workflow',
        name: 'Scorecard cropper viewport scaling',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Adjust...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'cropper_verified.png'
      };

      const receipt = generateReceipt(badMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].notes).toContain('providerConfigState is MOCK_MODE_ACTIVE');
    });

    it('reverts PASS to PENDING_REAL_DEVICE_QA if proofArtifactRef is only a test log', () => {
      const testGate = {
        id: 'QA-015',
        category: 'Scorecard OCR validation',
        name: 'Scorecard OCR validation and confirmation flow',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Verify...',
        testerStatus: 'PASS' as const,
        notes: 'Passed within vitest console logs',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'vitest_execution.log'
      };

      const receipt = generateReceipt(mockMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].notes).toContain('proofArtifactRef is only a test log');
    });

    it('reverts PASS to PENDING_REAL_DEVICE_QA if screenshot is required but screenshotPassed or file extension is invalid', () => {
      const testGateNoCheck = {
        id: 'QA-015',
        category: 'Scorecard OCR validation',
        name: 'Scorecard OCR validation and confirmation flow',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Verify...',
        testerStatus: 'PASS' as const,
        notes: 'Passed',
        screenshotRequired: true,
        screenshotProvided: false, // missing
        proofArtifactRef: 'some_image.png'
      };

      const testGateNoImageRef = {
        id: 'QA-015',
        category: 'Scorecard OCR validation',
        name: 'Scorecard OCR validation and confirmation flow',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Verify...',
        testerStatus: 'PASS' as const,
        notes: 'Passed',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'not_an_image_file' // invalid extension
      };

      const receipt1 = generateReceipt(mockMetadata, [testGateNoCheck]);
      expect(receipt1.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt1.gates[0].notes).toContain('required screenshot/media proof is missing or invalid');

      const receipt2 = generateReceipt(mockMetadata, [testGateNoImageRef]);
      expect(receipt2.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt2.gates[0].notes).toContain('required screenshot/media proof is missing or invalid');
    });

    it('demotes PASS to PENDING_REAL_DEVICE_QA and sets CONTESTED_UNVERIFIED if AI agent is tester for real-device gate', () => {
      const aiMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        tester: 'Gemini AI Coding Agent'
      };
      const testGate = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'verified_screen.png',
        proofArtifactExists: true
      };

      const receipt = generateReceipt(aiMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].validationStatus).toBe('CONTESTED_UNVERIFIED');
      expect(receipt.validationStatus).toBe('CONTESTED_UNVERIFIED');
      expect(receipt.generatedByAgent).toBe(true);
      expect(receipt.verifiedByHuman).toBe(false);
    });

    it('demotes PASS to PENDING_REAL_DEVICE_QA and sets INVALID_MISSING_ARTIFACT if proof has no checksum, url check, attachment, or existence check', () => {
      const normalMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        tester: 'ctw'
      };
      
      const testGate = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'non_existent_raw_filename.png',
        proofArtifactExists: false
      };

      const receipt = generateReceipt(normalMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].validationStatus).toBe('INVALID_MISSING_ARTIFACT');
    });

    it('retains PASS if human tester provides URL, checksum SHA, or valid attachment', () => {
      const normalMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        tester: 'ctw'
      };
      
      const testGateUrl = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'https://images.example.com/proof.png'
      };

      const testGateSha = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'a5d933bebd674e1d93540c946e3ef546f6ca951e73796dcdbeb9b951167dc89f.png'
      };

      const receiptUrl = generateReceipt(normalMetadata, [testGateUrl]);
      expect(receiptUrl.gates[0].testerStatus).toBe('PASS');
      expect(receiptUrl.gates[0].validationStatus).toBe('VALID');

      const receiptSha = generateReceipt(normalMetadata, [testGateSha]);
      expect(receiptSha.gates[0].testerStatus).toBe('PASS');
      expect(receiptSha.gates[0].validationStatus).toBe('VALID');
    });

    it('strictly excludes f-7-scorecard-scanner from featuresEligibleForVerified', () => {
      const normalMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        tester: 'ctw'
      };
      
      const testGate1 = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'https://images.example.com/proof1.png'
      };

      const testGate2 = {
        id: 'QA-014',
        category: 'Scorecard cropper workflow',
        name: 'Scorecard cropper viewport scaling',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'https://images.example.com/proof2.png'
      };

      const testGate3 = {
        id: 'QA-015',
        category: 'Scorecard OCR validation',
        name: 'Scorecard OCR validation and confirmation flow',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'https://images.example.com/proof3.png'
      };

      const receipt = generateReceipt(normalMetadata, [testGate1, testGate2, testGate3]);
      expect(receipt.featuresEligibleForVerified).not.toContain('f-7-scorecard-scanner');
    });

    it('demotes PASS to PENDING_REAL_DEVICE_QA and sets CONTESTED_UNVERIFIED if proofRef is a repo-created placeholder on disk', () => {
      const normalMetadata: QaReceiptMetadata = {
        ...mockMetadata,
        tester: 'ctw'
      };
      
      const testGate = {
        id: 'QA-013',
        category: 'Scorecard camera lifecycle',
        name: 'Scorecard camera lifecycle activation',
        featureId: 'f-7-scorecard-scanner',
        ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
        requiredProof: 'Verify...',
        relatedComponent: 'src/components/ScorecardScanner.tsx',
        nextRequiredFixIfFailed: 'Check...',
        testerStatus: 'PASS' as const,
        notes: 'Looks good',
        screenshotRequired: true,
        screenshotProvided: true,
        proofArtifactRef: 'iphone15pro_scorecard_camera.png'
      };

      const receipt = generateReceipt(normalMetadata, [testGate]);
      expect(receipt.gates[0].testerStatus).toBe('PENDING_REAL_DEVICE_QA');
      expect(receipt.gates[0].validationStatus).toBe('CONTESTED_UNVERIFIED');
      expect(receipt.gates[0].notes).toContain('synthetic placeholder detected');
    });
  });
});

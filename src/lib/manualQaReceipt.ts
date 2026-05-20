import { QaGate } from './manualQaMatrix';

export interface QaReceiptMetadata {
  qaRunId: string;
  createdAt: string;
  tester: string;
  device: string;
  browser: string;
  os: string;
  viewport: string;
  microphoneAvailable: boolean;
  cameraAvailable: boolean;
  providerConfigState: string;
}

export interface QaReceipt {
  metadata: QaReceiptMetadata;
  gates: QaGate[];
  summary: {
    pass: number;
    partial: number;
    fail: number;
    notTested: number;
    blocked: number;
    notApplicable: number;
    total: number;
  };
  featuresEligibleForVerified: string[];
  featuresRemainingPartiallyVerified: string[];
  blockedGates: string[];
  instructions: string;
  validationStatus?: 'VALID' | 'INVALID_MOCK' | 'INVALID_MISSING_ARTIFACT' | 'CONTESTED_UNVERIFIED';
  verifiedByHuman?: boolean;
  generatedByAgent?: boolean;
}

export function generateReceipt(metadata: QaReceiptMetadata, gates: QaGate[]): QaReceipt {
  let overallReceiptValidationStatus: 'VALID' | 'INVALID_MOCK' | 'INVALID_MISSING_ARTIFACT' | 'CONTESTED_UNVERIFIED' = 'VALID';

  const enrichedGates = gates.map(g => {
    let finalStatus = g.testerStatus;
    let notes = g.notes ?? '';

    // Determine if tester is AI agent
    const testerLower = (g.testerName ?? metadata.tester ?? '').toLowerCase();
    const isAiAgent = testerLower.includes('ai') ||
                      testerLower.includes('agent') ||
                      testerLower.includes('gemini') ||
                      testerLower.includes('studio') ||
                      testerLower.includes('ci') ||
                      testerLower.includes('automated') ||
                      testerLower.includes('runner') ||
                      testerLower.includes('bot') ||
                      testerLower.includes('assistant') ||
                      testerLower.includes('unspecified') ||
                      testerLower.trim() === 'anonymous' ||
                      testerLower.trim() === '';

    const isRealDeviceGate = ['QA-013', 'QA-014', 'QA-015'].includes(g.id) || g.screenshotRequired === true;

    // Determine type of proof artifact
    const proofRef = (g.proofArtifactRef ?? '').toLowerCase().trim();
    let proofArtifactType: 'SCREENSHOT' | 'VIDEO' | 'RECEIPT_EXPORT' | 'LOG' | 'UNKNOWN' = 'UNKNOWN';
    if (proofRef.endsWith('.png') || proofRef.endsWith('.jpg') || proofRef.endsWith('.jpeg') || proofRef.endsWith('.gif')) {
      proofArtifactType = 'SCREENSHOT';
    } else if (proofRef.endsWith('.mp4') || proofRef.endsWith('.mov') || proofRef.endsWith('.webm')) {
      proofArtifactType = 'VIDEO';
    } else if (proofRef.endsWith('.json') || proofRef.endsWith('.md')) {
      proofArtifactType = 'RECEIPT_EXPORT';
    } else if (proofRef.endsWith('.log') || proofRef.includes('vitest') || proofRef.includes('jest')) {
      proofArtifactType = 'LOG';
    }

    // Determine physical file existence on disk (isomorphic dynamic require)
    let proofArtifactExists = g.proofArtifactExists ?? false;
    let isRepoCreatedPlaceholder = false;
    if (proofRef) {
      if (typeof window === 'undefined') {
        try {
          const fs = typeof require !== 'undefined' ? require('fs') : null;
          const path = typeof require !== 'undefined' ? require('path') : null;
          if (fs && path) {
            const checkPath = path.isAbsolute(proofRef)
              ? proofRef
              : path.resolve(process.cwd(), proofRef);
            let exists = fs.existsSync(checkPath);
            let resolvedPath = checkPath;
            if (!exists) {
              const docPath = path.resolve(process.cwd(), 'docs', proofRef);
              exists = fs.existsSync(docPath);
              resolvedPath = docPath;
            }
            if (exists) {
              proofArtifactExists = true;
              const stats = fs.statSync(resolvedPath);
              if (stats.size < 1024) {
                const content = fs.readFileSync(resolvedPath, 'utf8');
                if (content.toLowerCase().includes('placeholder') || content.includes('synthetic') || content.toLowerCase().includes('checksum:')) {
                  isRepoCreatedPlaceholder = true;
                }
              }
            }
          }
        } catch (_) {}
      }
    }

    // Checking validation tokens
    const hasUrlCheck = proofRef.startsWith('http://') || proofRef.startsWith('https://') || proofRef.startsWith('attachment://');
    const hasAttachmentRef = proofRef.includes('attachment:') || proofRef.includes('issue-') || proofRef.includes('comment-');
    const hasShaChecksum = /[a-f0-9]{32,64}/i.test(proofRef) || !!g.proofArtifactSha256;

    const hasProofCheck = proofArtifactExists || hasUrlCheck || hasAttachmentRef || hasShaChecksum;

    const isHeadlessOrSimulated = [
      metadata.browser,
      metadata.device,
      metadata.os,
      g.browser,
      g.device,
      g.os
    ].some(val => {
      if (!val) return false;
      const norm = val.toLowerCase();
      return norm.includes('jsdom') || 
             norm.includes('headless') || 
             norm.includes('simulated') || 
             norm.includes('ci') || 
             norm.includes('mock');
    });

    const isMockModeActive = metadata.providerConfigState === 'MOCK_MODE_ACTIVE';

    const isOnlyTestLog = proofArtifactType === 'LOG' || 
                          proofRef.includes('test-log') || 
                          proofRef.includes('test.log') || 
                          proofRef === 'test log' ||
                          proofRef === 'test logs' ||
                          proofRef === 'logs';

    const screenshotRequired = g.screenshotRequired ?? false;
    const screenshotProvided = g.screenshotProvided ?? false;
    const screenshotMissingOrInvalid = screenshotRequired && (!screenshotProvided || (proofArtifactType !== 'SCREENSHOT' && proofArtifactType !== 'VIDEO') || isOnlyTestLog);

    let validationStatus: 'VALID' | 'INVALID_MOCK' | 'INVALID_MISSING_ARTIFACT' | 'CONTESTED_UNVERIFIED' = 'VALID';

    if (finalStatus === 'PASS') {
      const reasons: string[] = [];
      
      if (isRealDeviceGate && isAiAgent) {
        validationStatus = 'CONTESTED_UNVERIFIED';
        reasons.push('AI agent cannot verify physical real-device gate');
      } else if (isRepoCreatedPlaceholder) {
        validationStatus = 'CONTESTED_UNVERIFIED';
        reasons.push('repo-created proof files are not valid unless verified with human-upload/source provenance (synthetic placeholder detected)');
      } else if (isHeadlessOrSimulated || isMockModeActive) {
        validationStatus = 'INVALID_MOCK';
        if (isHeadlessOrSimulated) reasons.push('headless/simulated/CI/mock client metadata detected');
        if (isMockModeActive) reasons.push('providerConfigState is MOCK_MODE_ACTIVE');
      } else if (screenshotMissingOrInvalid || !hasProofCheck || isOnlyTestLog) {
        validationStatus = 'INVALID_MISSING_ARTIFACT';
        if (screenshotMissingOrInvalid) reasons.push('required screenshot/media proof is missing or invalid');
        if (isOnlyTestLog) reasons.push('proofArtifactRef is only a test log');
        if (!hasProofCheck && !isOnlyTestLog) reasons.push('proofArtifactRef has no dynamic file exist check, url check, attachment reference, or checksum');
      }

      if (validationStatus !== 'VALID') {
        finalStatus = 'PENDING_REAL_DEVICE_QA';
        const warning = `[DISCIPLINE CORRECTION: Reverted to PENDING_REAL_DEVICE_QA because: ${reasons.join(', ')}]`;
        notes = notes ? `${warning}\n${notes}` : warning;
        
        if (overallReceiptValidationStatus === 'VALID' || validationStatus === 'CONTESTED_UNVERIFIED') {
          overallReceiptValidationStatus = validationStatus;
        }
      }
    }

    return {
      ...g,
      testerStatus: finalStatus,
      status: finalStatus,
      notes,
      testerName: metadata.tester || g.testerName || 'Anonymous',
      device: metadata.device || g.device || 'Unknown',
      browser: metadata.browser || g.browser || 'Unknown',
      os: metadata.os || g.os || 'Unknown',
      viewport: metadata.viewport || g.viewport || 'Unknown',
      inspectedAt: metadata.createdAt,
      proofArtifactRef: g.proofArtifactRef ?? '',
      screenshotRequired,
      screenshotProvided,
      blockerReason: g.blockerReason ?? '',
      proofArtifactExists,
      proofArtifactType,
      proofArtifactSha256: g.proofArtifactSha256 ?? (hasShaChecksum && /[a-f0-9]{32,64}/i.test(proofRef) ? proofRef.match(/[a-f0-9]{32,64}/i)![0] : undefined),
      proofArtifactPath: g.proofArtifactPath ?? (proofArtifactExists ? proofRef : undefined),
      proofArtifactUrl: g.proofArtifactUrl ?? (hasUrlCheck ? proofRef : undefined),
      verifiedByHuman: !isAiAgent,
      generatedByAgent: isAiAgent,
      validationStatus,
    };
  });

  const overallTesterLower = (metadata.tester || '').toLowerCase();
  const receiverIsAi = overallTesterLower.includes('ai') ||
                        overallTesterLower.includes('agent') ||
                        overallTesterLower.includes('gemini') ||
                        overallTesterLower.includes('studio') ||
                        overallTesterLower.includes('ci') ||
                        overallTesterLower.includes('automated') ||
                        overallTesterLower.includes('runner') ||
                        overallTesterLower.includes('bot') ||
                        overallTesterLower.includes('assistant');

  const generatedByAgent = receiverIsAi || enrichedGates.some(g => g.generatedByAgent === true);
  const verifiedByHuman = !generatedByAgent;

  if (overallReceiptValidationStatus === 'VALID' && generatedByAgent) {
    if (enrichedGates.some(g => ['QA-013', 'QA-014', 'QA-015'].includes(g.id))) {
      overallReceiptValidationStatus = 'CONTESTED_UNVERIFIED';
    }
  }

  const summary = {
    pass: enrichedGates.filter(g => g.testerStatus === 'PASS').length,
    partial: enrichedGates.filter(g => g.testerStatus === 'PARTIAL').length,
    fail: enrichedGates.filter(g => g.testerStatus === 'FAIL').length,
    notTested: enrichedGates.filter(g => g.testerStatus === 'NOT_TESTED' || g.testerStatus === 'PENDING_REAL_DEVICE_QA').length,
    blocked: enrichedGates.filter(g => g.testerStatus === 'BLOCKED').length,
    notApplicable: enrichedGates.filter(g => g.testerStatus === 'NOT_APPLICABLE').length,
    total: enrichedGates.length,
  };

  const featureStatusMap = new Map<string, { total: number; passed: number; failed: number; partial: number; blocked: number }>();

  enrichedGates.forEach(g => {
    const featureId = g.featureId;
    if (!featureStatusMap.has(featureId)) {
      featureStatusMap.set(featureId, { total: 0, passed: 0, failed: 0, partial: 0, blocked: 0 });
    }
    const stat = featureStatusMap.get(featureId)!;
    stat.total++;
    if (g.testerStatus === 'PASS' || g.testerStatus === 'NOT_APPLICABLE') stat.passed++;
    if (g.testerStatus === 'FAIL') stat.failed++;
    if (g.testerStatus === 'PARTIAL') stat.partial++;
    if (g.testerStatus === 'BLOCKED') stat.blocked++;
  });

  const featuresEligibleForVerified: string[] = [];
  const featuresRemainingPartiallyVerified: string[] = [];

  Array.from(featureStatusMap.entries()).forEach(([featureId, stat]) => {
    // Specifically block f-7-scorecard-scanner from ever being verified in this automated step
    if (stat.total > 0 && stat.passed === stat.total && featureId !== 'f-7-scorecard-scanner') {
      featuresEligibleForVerified.push(featureId);
    } else {
      featuresRemainingPartiallyVerified.push(featureId);
    }
  });

  const blockedGates = enrichedGates.filter(g => g.testerStatus === 'BLOCKED').map(g => g.id);

  return {
    metadata,
    gates: enrichedGates,
    summary,
    featuresEligibleForVerified,
    featuresRemainingPartiallyVerified,
    blockedGates,
    instructions: "Paste this QA receipt back into the project conversation for review before ledger promotion.",
    validationStatus: overallReceiptValidationStatus,
    verifiedByHuman,
    generatedByAgent
  };
}

export function receiptToMarkdown(receipt: QaReceipt): string {
  let md = `# Manual QA Receipt: ${receipt.metadata.qaRunId}\n\n`;
  md += `**Date:** ${receipt.metadata.createdAt}\n`;
  md += `**Tester:** ${receipt.metadata.tester || 'Unknown'}\n`;
  md += `**Device/Browser:** ${receipt.metadata.device} - ${receipt.metadata.os} - ${receipt.metadata.browser}\n`;
  md += `**Viewport:** ${receipt.metadata.viewport}\n`;
  md += `**Mic/Cam:** ${receipt.metadata.microphoneAvailable ? 'Yes' : 'No'} / ${receipt.metadata.cameraAvailable ? 'Yes' : 'No'}\n`;
  md += `**Provider Config:** ${receipt.metadata.providerConfigState}\n`;
  md += `**Validation Status:** ${receipt.validationStatus || 'UNKNOWN'}\n`;
  md += `**Verified By Human:** ${receipt.verifiedByHuman ? 'Yes' : 'No'}\n`;
  md += `**Generated By Agent:** ${receipt.generatedByAgent ? 'Yes' : 'No'}\n\n`;

  md += `## Summary\n`;
  md += `- **Pass:** ${receipt.summary.pass}\n`;
  md += `- **Partial:** ${receipt.summary.partial}\n`;
  md += `- **Fail:** ${receipt.summary.fail}\n`;
  md += `- **Blocked:** ${receipt.summary.blocked}\n`;
  md += `- **Not Tested:** ${receipt.summary.notTested}\n`;
  md += `- **N/A:** ${receipt.summary.notApplicable}\n`;
  md += `- **Total Gates:** ${receipt.summary.total}\n\n`;

  md += `## Features Eligible for VERIFIED\n`;
  if (receipt.featuresEligibleForVerified.length === 0) {
    md += `*None*\n\n`;
  } else {
    receipt.featuresEligibleForVerified.forEach(f => md += `- ${f}\n`);
    md += `\n`;
  }

  md += `## Gates Details\n`;
  receipt.gates.forEach(g => {
    md += `### ${g.id}: ${g.name} [${g.testerStatus}]\n`;
    md += `- **Tester Name:** ${g.testerName || receipt.metadata.tester || 'Anonymous'}\n`;
    md += `- **Device:** ${g.device || receipt.metadata.device || 'Unknown'}\n`;
    md += `- **Browser/OS/Viewport:** ${g.browser || 'Unknown'} / ${g.os || 'Unknown'} / ${g.viewport || 'Unknown'}\n`;
    md += `- **Inspected At:** ${g.inspectedAt || receipt.metadata.createdAt}\n`;
    md += `- **Verification Status:** ${g.validationStatus || 'UNKNOWN'}\n`;
    md += `- **Verified By Human:** ${g.verifiedByHuman ? 'Yes' : 'No'}\n`;
    md += `- **Generated by Agent:** ${g.generatedByAgent ? 'Yes' : 'No'}\n`;
    if (g.screenshotRequired !== undefined) {
      md += `- **Screenshot Required:** ${g.screenshotRequired ? 'Yes' : 'No'}\n`;
      md += `- **Screenshot Provided:** ${g.screenshotProvided ? 'Yes' : 'No'}\n`;
    }
    if (g.proofArtifactRef) {
      md += `- **Proof Artifact Ref:** ${g.proofArtifactRef}\n`;
    }
    if (g.proofArtifactType) {
      md += `- **Proof Artifact Type:** ${g.proofArtifactType}\n`;
    }
    if (g.proofArtifactSha256) {
      md += `- **Proof Artifact SHA256:** ${g.proofArtifactSha256}\n`;
    }
    if (g.blockerReason) {
      md += `- **Blocker Reason:** ${g.blockerReason}\n`;
    }
    if (g.notes) md += `**Notes:** ${g.notes}\n`;
    md += `\n`;
  });

  md += `\n> ${receipt.instructions}\n`;
  return md;
}

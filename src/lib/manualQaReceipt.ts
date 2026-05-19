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
}

export function generateReceipt(metadata: QaReceiptMetadata, gates: QaGate[]): QaReceipt {
  const summary = {
    pass: gates.filter(g => g.testerStatus === 'PASS').length,
    partial: gates.filter(g => g.testerStatus === 'PARTIAL').length,
    fail: gates.filter(g => g.testerStatus === 'FAIL').length,
    notTested: gates.filter(g => g.testerStatus === 'NOT_TESTED' || g.testerStatus === 'PENDING_REAL_DEVICE_QA').length,
    blocked: gates.filter(g => g.testerStatus === 'BLOCKED').length,
    notApplicable: gates.filter(g => g.testerStatus === 'NOT_APPLICABLE').length,
    total: gates.length,
  };

  const featureStatusMap = new Map<string, { total: number; passed: number; failed: number; partial: number; blocked: number }>();

  gates.forEach(g => {
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
    // If all required tests passed (or are N/A), it's eligible.
    if (stat.total > 0 && stat.passed === stat.total) {
      featuresEligibleForVerified.push(featureId);
    } else {
      featuresRemainingPartiallyVerified.push(featureId);
    }
  });

  const blockedGates = gates.filter(g => g.testerStatus === 'BLOCKED').map(g => g.id);

  return {
    metadata,
    gates,
    summary,
    featuresEligibleForVerified,
    featuresRemainingPartiallyVerified,
    blockedGates,
    instructions: "Paste this QA receipt back into the project conversation for review before ledger promotion."
  };
}

export function receiptToMarkdown(receipt: QaReceipt): string {
  let md = `# Manual QA Receipt: ${receipt.metadata.qaRunId}\n\n`;
  md += `**Date:** ${receipt.metadata.createdAt}\n`;
  md += `**Tester:** ${receipt.metadata.tester || 'Unknown'}\n`;
  md += `**Device/Browser:** ${receipt.metadata.device} - ${receipt.metadata.os} - ${receipt.metadata.browser}\n`;
  md += `**Viewport:** ${receipt.metadata.viewport}\n`;
  md += `**Mic/Cam:** ${receipt.metadata.microphoneAvailable ? 'Yes' : 'No'} / ${receipt.metadata.cameraAvailable ? 'Yes' : 'No'}\n`;
  md += `**Provider Config:** ${receipt.metadata.providerConfigState}\n\n`;

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
    if (g.notes) md += `**Notes:** ${g.notes}\n`;
  });

  md += `\n> ${receipt.instructions}\n`;
  return md;
}

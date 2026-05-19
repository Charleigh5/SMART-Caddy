import { INITIAL_QA_MATRIX } from '../src/lib/manualQaMatrix';
import { generateReceipt, receiptToMarkdown } from '../src/lib/manualQaReceipt';

const receipt = generateReceipt({
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
}, INITIAL_QA_MATRIX);

console.log("=== JSON ===");
console.log(JSON.stringify(receipt, null, 2));
console.log("=== MARKDOWN ===");
console.log(receiptToMarkdown(receipt));

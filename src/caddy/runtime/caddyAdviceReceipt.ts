import { CaddyAdviceReceipt } from './caddyTypes';

const receiptMemory: CaddyAdviceReceipt[] = [];

export function saveCaddyAdviceReceipt(receipt: CaddyAdviceReceipt) {
  receiptMemory.push(receipt);
}

export function getCaddyAdviceReceipts(): CaddyAdviceReceipt[] {
  return receiptMemory;
}

// PREIMAGE-SHA-256 crypto-conditions, the one condition type XRP Ledger escrow accepts.
// Condition:   A0 25 80 20 <sha256(preimage)> 81 01 20   (cost = 32, the preimage length)
// Fulfillment: A0 22 80 20 <preimage>

import { createHash, randomBytes } from 'node:crypto';

export function newPreimage() {
  return randomBytes(32);
}

export function conditionFor(preimage) {
  const fingerprint = createHash('sha256').update(preimage).digest('hex');
  return `A0258020${fingerprint}810120`.toUpperCase();
}

export function fulfillmentFor(preimage) {
  return `A0228020${Buffer.from(preimage).toString('hex')}`.toUpperCase();
}

// True when the fulfillment opens the condition.
export function fulfills(fulfillmentHex, conditionHex) {
  const m = /^A0228020([0-9A-F]{64})$/i.exec(fulfillmentHex ?? '');
  if (!m) return false;
  return conditionFor(Buffer.from(m[1], 'hex')) === String(conditionHex).toUpperCase();
}

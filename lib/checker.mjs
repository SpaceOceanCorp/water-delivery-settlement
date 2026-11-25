// The checker: verifies a water delivery from its signed records and, only if every
// check passes, reveals the fulfillment that lets the supplier finish the escrow.

import { conditionFor, fulfillmentFor, newPreimage } from './condition.mjs';
import { verifyRecord } from './records.mjs';

// Problems with one set of quality values against the order's limits.
export function qualityProblems(quality, limits) {
  const problems = [];
  for (const [name, { min, max }] of Object.entries(limits)) {
    const v = quality?.[name];
    if (!Number.isSafeInteger(v)) problems.push(`${name} missing`);
    else if (min !== undefined && v < min) problems.push(`${name} ${v} below min ${min}`);
    else if (max !== undefined && v > max) problems.push(`${name} ${v} above max ${max}`);
  }
  return problems;
}

// Checks the order, the meter readings and the receipt. Returns { ok, reasons, measuredGrams }.
export function checkDelivery({ order, readings, receipt }) {
  const reasons = [];
  if (!verifyRecord(order) || order.body.type !== 'water.order/1') {
    return { ok: false, reasons: ['order is not a valid signed water.order/1'] };
  }
  const o = order.body;
  if (order.signer !== o.buyer.key) reasons.push('order is not signed by the buyer it names');
  if (!Array.isArray(readings) || readings.length < 2) {
    return { ok: false, reasons: [...reasons, 'need at least two meter readings'] };
  }

  let prev = null;
  let qualityOk = true;
  readings.forEach((r, i) => {
    if (!verifyRecord(r)) reasons.push(`reading ${i}: edited after signing or signature invalid`);
    if (r.signer !== o.meterKey) reasons.push(`reading ${i}: not signed by the order's meter`);
    const b = r.body ?? {};
    if (b.type !== 'water.reading/1' || b.order !== order.id) reasons.push(`reading ${i}: not a reading for this order`);
    if (b.seq !== i) reasons.push(`reading ${i}: sequence ${b.seq}, expected ${i} (removed, reordered or replayed)`);
    if (b.prev !== (prev ? prev.id : null)) reasons.push(`reading ${i}: does not chain to the reading before it`);
    if (prev && !(b.totalGrams >= prev.body.totalGrams)) reasons.push(`reading ${i}: totalizer ran backwards`);
    const problems = qualityProblems(b.quality, o.limits);
    if (problems.length) {
      qualityOk = false;
      reasons.push(`reading ${i}: out of spec (${problems.join(', ')})`);
    }
    prev = r;
  });

  const first = readings[0].body;
  const last = readings.at(-1).body;
  const measuredGrams = last.totalGrams - first.totalGrams;

  if (!verifyRecord(receipt) || receipt.body.type !== 'water.receipt/1') {
    reasons.push('receipt is not a valid signed water.receipt/1');
    return { ok: false, reasons, measuredGrams };
  }
  const rc = receipt.body;
  if (receipt.signer !== o.buyer.key) reasons.push('receipt is not signed by the buyer');
  if (rc.order !== order.id) reasons.push('receipt is for a different order');
  if (rc.firstReading !== readings[0].id || rc.lastReading !== readings.at(-1).id) {
    reasons.push('receipt does not cover these meter readings');
  }
  if (rc.acceptedGrams !== measuredGrams) {
    reasons.push(`receipt books ${rc.acceptedGrams} g but the meter measured ${measuredGrams} g`);
  }
  if (measuredGrams < o.plannedGrams) {
    reasons.push(`short delivery: meter measured ${measuredGrams} g of ${o.plannedGrams} g ordered`);
  }
  if (rc.qualityPass && !qualityOk) reasons.push('receipt says quality passed but readings are out of spec');
  if (!rc.qualityPass) reasons.push('buyer marked quality as failed');

  return { ok: reasons.length === 0, reasons, measuredGrams };
}

// Checks that the escrow on the ledger is the one the order calls for.
export function checkEscrow(orderBody, escrow, condition) {
  const reasons = [];
  if (!escrow) return ['escrow not found on the ledger'];
  if (escrow.Account !== orderBody.buyer.account) reasons.push('escrow is not funded by the buyer');
  if (escrow.Destination !== orderBody.supplier.account) reasons.push('escrow does not pay the supplier');
  const a = escrow.Amount;
  const p = orderBody.payment;
  if (typeof a !== 'object' || a.currency !== p.currency || a.issuer !== p.issuer || Number(a.value) !== Number(p.value)) {
    reasons.push(`escrow holds ${JSON.stringify(a)}, order calls for ${p.value} ${p.currency}`);
  }
  if (String(escrow.Condition ?? '').toUpperCase() !== condition) reasons.push('escrow condition is not the one issued for this order');
  return reasons;
}

export class Checker {
  #preimages = new Map();

  // The condition the buyer puts on the escrow for this order.
  conditionFor(order) {
    if (!this.#preimages.has(order.id)) this.#preimages.set(order.id, newPreimage());
    return conditionFor(this.#preimages.get(order.id));
  }

  // Reveals the fulfillment only when the delivery and the escrow both check out.
  release({ order, readings, receipt, escrow }) {
    const preimage = this.#preimages.get(order?.id);
    if (!preimage) return { released: false, reasons: ['no condition was issued for this order'] };
    const delivery = checkDelivery({ order, readings, receipt });
    const reasons = [...delivery.reasons, ...checkEscrow(order.body, escrow, conditionFor(preimage))];
    if (reasons.length) return { released: false, reasons, measuredGrams: delivery.measuredGrams };
    return { released: true, fulfillment: fulfillmentFor(preimage), measuredGrams: delivery.measuredGrams };
  }
}

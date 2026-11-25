// Offline tests: records, conditions and the checker. No network.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Checker, checkDelivery } from './lib/checker.mjs';
import { conditionFor, fulfillmentFor, fulfills, newPreimage } from './lib/condition.mjs';
import { newParty, signRecord, verifyRecord } from './lib/records.mjs';
import { makeOrder, makeParties, meterRun, receiptFor } from './lib/scenario.mjs';

const BUYER = 'rBuyerAccountXXXXXXXXXXXXXXXXXXXX';
const SUPPLIER = 'rSupplierAccountXXXXXXXXXXXXXXXXX';
const PAYMENT = { currency: 'USD', issuer: 'rIssuerAccountXXXXXXXXXXXXXXXXXXX', value: '250' };

function delivery(opts = {}) {
  const { station, meter } = makeParties();
  const order = makeOrder({ station, meter, orderId: 'T-1', buyerAccount: BUYER, supplierAccount: SUPPLIER, payment: PAYMENT });
  const readings = opts.readings?.({ order, meter }) ?? meterRun({ order, meter, ...opts.run });
  const receipt = receiptFor({ order, readings, station, ...opts.receipt });
  return { station, meter, order, readings, receipt };
}

function escrowFor(order, condition, overrides = {}) {
  return { Account: BUYER, Destination: SUPPLIER, Amount: { ...PAYMENT }, Condition: condition, ...overrides };
}

const failsWith = (d, text) => {
  const r = checkDelivery(d);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes(text)), `expected "${text}" in ${JSON.stringify(r.reasons)}`);
};

test('condition and fulfillment match the XRP Ledger PREIMAGE-SHA-256 format', () => {
  const p = Buffer.alloc(32, 7);
  const fingerprint = createHash('sha256').update(p).digest('hex').toUpperCase();
  assert.equal(conditionFor(p), `A0258020${fingerprint}810120`);
  assert.equal(fulfillmentFor(p), `A0228020${'07'.repeat(32)}`);
  assert.ok(fulfills(fulfillmentFor(p), conditionFor(p)));
  assert.ok(!fulfills(fulfillmentFor(newPreimage()), conditionFor(p)));
});

test('a signed record verifies, and any edit breaks it', () => {
  const party = newParty('x');
  const rec = signRecord({ type: 't', n: 1 }, party);
  assert.ok(verifyRecord(rec));
  assert.ok(!verifyRecord({ ...rec, body: { type: 't', n: 2 } }));
  assert.ok(!verifyRecord({ ...rec, signer: newParty('y').key }));
});

test('an honest, full, in-spec delivery passes', () => {
  const r = checkDelivery(delivery());
  assert.deepEqual(r.reasons, []);
  assert.equal(r.measuredGrams, 25000);
});

test('a receipt that books more than the meter measured fails', () => {
  failsWith(delivery({ receipt: { acceptedGrams: 27500 } }), 'receipt books 27500 g but the meter measured 25000 g');
});

test('a short delivery fails', () => {
  failsWith(delivery({ run: { steps: [5000, 5000, 5000, 5000] } }), 'short delivery: meter measured 20000 g of 25000 g ordered');
});

test('quality out of spec while the receipt says it passed fails', () => {
  failsWith(delivery({ run: { quality: { 3: { conductivityUScm: 180 } } }, receipt: { qualityPass: true } }), 'receipt says quality passed');
});

test('a reading edited after signing fails', () => {
  const d = delivery();
  d.readings[2] = { ...d.readings[2], body: { ...d.readings[2].body, totalGrams: d.readings[2].body.totalGrams + 1 } };
  failsWith(d, 'reading 2: edited after signing');
});

test('a removed reading fails', () => {
  const d = delivery();
  d.readings.splice(2, 1);
  failsWith(d, 'reading 2: sequence 3, expected 2');
});

test('a replayed reading fails', () => {
  const d = delivery();
  d.readings.splice(3, 0, d.readings[2]);
  failsWith(d, 'reading 3: sequence 2, expected 3');
});

test('a reading signed by a different meter fails', () => {
  const d = delivery({ readings: ({ order }) => meterRun({ order, meter: newParty('other meter') }) });
  failsWith(d, "not signed by the order's meter");
});

test('a totalizer that runs backwards fails', () => {
  const d = delivery({ run: { steps: [5000, -2000, 11000, 6000, 5000] } });
  failsWith(d, 'reading 2: totalizer ran backwards');
});

test('a receipt signed by someone other than the buyer fails', () => {
  const d = delivery();
  d.receipt = signRecord(d.receipt.body, newParty('impostor'));
  failsWith(d, 'receipt is not signed by the buyer');
});

test('the checker reveals the fulfillment only for a good delivery and the right escrow', () => {
  const checker = new Checker();
  const d = delivery();
  const condition = checker.conditionFor(d.order);

  const good = checker.release({ ...d, escrow: escrowFor(d.order, condition) });
  assert.equal(good.released, true);
  assert.ok(fulfills(good.fulfillment, condition));

  const wrongPayee = checker.release({ ...d, escrow: escrowFor(d.order, condition, { Destination: 'rSomeoneElse' }) });
  assert.equal(wrongPayee.released, false);
  assert.ok(wrongPayee.reasons.includes('escrow does not pay the supplier'));

  const lessMoney = checker.release({ ...d, escrow: escrowFor(d.order, condition, { Amount: { ...PAYMENT, value: '1' } }) });
  assert.equal(lessMoney.released, false);

  const otherCondition = checker.release({ ...d, escrow: escrowFor(d.order, conditionFor(newPreimage())) });
  assert.equal(otherCondition.released, false);
});

test('the checker reveals nothing for a short delivery', () => {
  const checker = new Checker();
  const d = delivery({ run: { steps: [5000, 5000, 5000, 5000] } });
  const condition = checker.conditionFor(d.order);
  const r = checker.release({ ...d, escrow: escrowFor(d.order, condition) });
  assert.equal(r.released, false);
  assert.equal(r.fulfillment, undefined);
});

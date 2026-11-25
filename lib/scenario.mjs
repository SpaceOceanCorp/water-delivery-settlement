// Example deliveries used by the tests and the testnet demo.
// The limits, prices and amounts are made up for the demo. They are not a water standard.

import { qualityProblems } from './checker.mjs';
import { newParty, signRecord } from './records.mjs';

export const LIMITS = {
  conductivityUScm: { max: 50 },
  phX100: { min: 650, max: 850 },
  tocPpb: { max: 500 },
};

const GOOD_WATER = { conductivityUScm: 12, phX100: 720, tocPpb: 180 };

export function makeParties() {
  return { station: newParty('Station operator (buyer)'), meter: newParty('Transfer meter') };
}

export function makeOrder({ station, meter, orderId, buyerAccount, supplierAccount, payment, plannedGrams = 25000 }) {
  return signRecord(
    {
      type: 'water.order/1',
      orderId,
      buyer: { key: station.key, account: buyerAccount },
      supplier: { account: supplierAccount },
      meterKey: meter.key,
      plannedGrams,
      payment,
      limits: LIMITS,
    },
    station,
  );
}

// Cumulative meter readings: one before the transfer, then one per step.
export function meterRun({ order, meter, startTotal = 1_200_000, steps = [5000, 5000, 5000, 5000, 5000], quality = {} }) {
  const readings = [];
  let total = startTotal;
  for (let seq = 0; seq <= steps.length; seq++) {
    if (seq > 0) total += steps[seq - 1];
    const body = {
      type: 'water.reading/1',
      order: order.id,
      seq,
      totalGrams: total,
      quality: { ...GOOD_WATER, ...(quality[seq] ?? {}) },
      prev: seq === 0 ? null : readings[seq - 1].id,
    };
    readings.push(signRecord(body, meter));
  }
  return readings;
}

// The buyer's receipt. By default it books what the meter measured and states the quality result honestly.
export function receiptFor({ order, readings, station, acceptedGrams, qualityPass }) {
  const measured = readings.at(-1).body.totalGrams - readings[0].body.totalGrams;
  const honestPass = readings.every((r) => qualityProblems(r.body.quality, order.body.limits).length === 0);
  return signRecord(
    {
      type: 'water.receipt/1',
      order: order.id,
      firstReading: readings[0].id,
      lastReading: readings.at(-1).id,
      acceptedGrams: acceptedGrams ?? measured,
      qualityPass: qualityPass ?? honestPass,
    },
    station,
  );
}

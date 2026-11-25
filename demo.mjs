// Testnet demo: two water deliveries paid from XRP Ledger token escrows.
//   Delivery 1 is full and in spec: the checker reveals the fulfillment and the supplier is paid.
//   Delivery 2 is short: the checker reveals nothing, the escrow expires and the buyer cancels it.
// Accounts come from the testnet faucet. Nothing here touches mainnet or real money.

import { writeFileSync } from 'node:fs';
import { AccountSetAsfFlags, Client } from 'xrpl';
import { Checker } from './lib/checker.mjs';
import { makeOrder, makeParties, meterRun, receiptFor } from './lib/scenario.mjs';

const NETWORK = process.env.XRPL_NETWORK ?? 'wss://s.altnet.rippletest.net:51233';
const EXPLORER = 'https://testnet.xrpl.org/transactions/';
const CURRENCY = 'USD'; // issued by a demo issuer as a stand-in for RLUSD

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...a) => console.log(...a);
const run = { network: NETWORK, startedAt: new Date().toISOString(), accounts: {}, transactions: [], deliveries: [] };

async function submit(client, wallet, tx, label) {
  const prepared = await client.autofill(tx);
  const res = await client.submitAndWait(wallet.sign(prepared).tx_blob);
  const code = res.result.meta.TransactionResult;
  const hash = res.result.hash;
  run.transactions.push({ label, result: code, hash });
  log(`  ${label.padEnd(34)} ${code}  ${EXPLORER}${hash}`);
  if (code !== 'tesSUCCESS') throw new Error(`${label} failed: ${code}`);
  return { hash, sequence: prepared.Sequence };
}

async function ledgerTime(client) {
  const r = await client.request({ command: 'ledger', ledger_index: 'validated' });
  return r.result.ledger.close_time;
}

async function readEscrow(client, owner, seq) {
  const r = await client.request({ command: 'ledger_entry', escrow: { owner, seq }, ledger_index: 'validated' });
  return r.result.node;
}

async function usd(client, account, issuer) {
  const r = await client.request({ command: 'account_lines', account, peer: issuer, ledger_index: 'validated' });
  return Number(r.result.lines.find((l) => l.currency === CURRENCY)?.balance ?? 0);
}

async function main() {
  const client = new Client(NETWORK);
  await client.connect();
  try {
    log(`Network: ${NETWORK}\n\nFunding three testnet accounts from the faucet`);
    const issuer = (await client.fundWallet()).wallet;
    const station = (await client.fundWallet()).wallet; // buyer: a station operator
    const supplier = (await client.fundWallet()).wallet; // seller: Space Ocean, the water supplier
    run.accounts = { issuer: issuer.address, station: station.address, supplier: supplier.address };
    log(`  issuer   ${issuer.address}\n  station  ${station.address}\n  supplier ${supplier.address}`);

    log('\nSetting up the test dollar');
    await submit(client, issuer, { TransactionType: 'AccountSet', Account: issuer.address, SetFlag: AccountSetAsfFlags.asfDefaultRipple }, 'Issuer: allow rippling');
    await submit(client, issuer, { TransactionType: 'AccountSet', Account: issuer.address, SetFlag: AccountSetAsfFlags.asfAllowTrustLineLocking }, 'Issuer: allow trust line locking');
    for (const [name, w] of [['Station', station], ['Supplier', supplier]]) {
      await submit(client, w, { TransactionType: 'TrustSet', Account: w.address, LimitAmount: { currency: CURRENCY, issuer: issuer.address, value: '1000000' } }, `${name}: trust line`);
    }
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.address, Destination: station.address, Amount: { currency: CURRENCY, issuer: issuer.address, value: '1000' } }, 'Issuer: 1000 USD to station');

    const parties = makeParties();
    const checker = new Checker();
    const payment = { currency: CURRENCY, issuer: issuer.address, value: '250' };

    async function delivery({ label, orderId, steps, cancelAfterSeconds }) {
      log(`\n${label}`);
      const order = makeOrder({ station: parties.station, meter: parties.meter, orderId, buyerAccount: station.address, supplierAccount: supplier.address, payment });
      const condition = checker.conditionFor(order);
      const cancelAfter = (await ledgerTime(client)) + cancelAfterSeconds;
      const create = await submit(
        client,
        station,
        { TransactionType: 'EscrowCreate', Account: station.address, Destination: supplier.address, Amount: payment, Condition: condition, CancelAfter: cancelAfter },
        `Station locks ${payment.value} USD in escrow`,
      );

      // The water moves. The meter signs its readings and the station signs the receipt.
      const readings = meterRun({ order, meter: parties.meter, steps });
      const receipt = receiptFor({ order, readings, station: parties.station });
      const escrow = await readEscrow(client, station.address, create.sequence);
      const decision = checker.release({ order, readings, receipt, escrow });
      log(`  meter measured ${decision.measuredGrams} g of ${order.body.plannedGrams} g ordered`);

      const record = { label, orderId, recordId: order.id, measuredGrams: decision.measuredGrams, escrowSequence: create.sequence };
      if (decision.released) {
        log('  checker: every check passed, fulfillment revealed to the supplier');
        await submit(
          client,
          supplier,
          { TransactionType: 'EscrowFinish', Account: supplier.address, Owner: station.address, OfferSequence: create.sequence, Condition: condition, Fulfillment: decision.fulfillment },
          'Supplier finishes escrow (paid)',
        );
        record.outcome = 'paid';
      } else {
        log(`  checker: refused (${decision.reasons.join('; ')})`);
        log(`  waiting for the escrow to expire (about ${cancelAfterSeconds} s)`);
        while ((await ledgerTime(client)) <= escrow.CancelAfter) await sleep(3000);
        await submit(
          client,
          station,
          { TransactionType: 'EscrowCancel', Account: station.address, Owner: station.address, OfferSequence: create.sequence },
          'Station cancels expired escrow',
        );
        record.outcome = 'returned to buyer';
        record.reasons = decision.reasons;
      }
      record.balances = { station: await usd(client, station.address, issuer.address), supplier: await usd(client, supplier.address, issuer.address) };
      log(`  balances: station ${record.balances.station} USD, supplier ${record.balances.supplier} USD`);
      run.deliveries.push(record);
    }

    await delivery({ label: 'Delivery 1: 25,000 g, full and in spec', orderId: 'SO-DEMO-0001', steps: [5000, 5000, 5000, 5000, 5000], cancelAfterSeconds: 600 });
    await delivery({ label: 'Delivery 2: short, 20,000 g of 25,000 g', orderId: 'SO-DEMO-0002', steps: [5000, 5000, 5000, 5000], cancelAfterSeconds: 30 });

    run.finishedAt = new Date().toISOString();
    writeFileSync('last-run.json', `${JSON.stringify(run, null, 2)}\n`);
    log('\nDone. Transaction hashes saved to last-run.json');
  } finally {
    await client.disconnect();
  }
}

main().catch((err) => {
  console.error(`\nDemo stopped: ${err.message}`);
  process.exitCode = 1;
});

# water-delivery-settlement

Built by [SpaceOcean Finance Inc.](https://spaceoceanfinance.com/), the wholly owned finance subsidiary of Space Ocean Corp.

Pay for water delivered in space from an XRP Ledger escrow that opens only when the delivery checks out.

A station operator locks dollars in a token escrow to the water supplier. A transfer meter signs its
readings as the water moves, and the station signs a receipt for what the meter measured. A checker
verifies those records and, only if every check passes, reveals the secret that lets the supplier
collect. If the delivery falls short, the escrow expires and the dollars go back to the station.

## Live on testnet

Run on 25 November 2026 on the XRP Ledger testnet:

| Step | Result | Transaction |
|---|---|---|
| Delivery 1: station locks 250 USD in escrow | 25,000 g ordered | [328F4452](https://testnet.xrpl.org/transactions/328F44529B608E87F5EF2CC21EED7932FF4F8D0E85D6CFC827A4EC04133B767A) |
| Delivery 1: checker passes, supplier finishes the escrow | supplier paid 250 USD | [4C52ADA7](https://testnet.xrpl.org/transactions/4C52ADA75107D81E827ED97EEC1FC3B1A9CECFCC7C113B5B9BC5585D38CDD631) |
| Delivery 2: station locks 250 USD in escrow | 25,000 g ordered | [D05C1149](https://testnet.xrpl.org/transactions/D05C11498A5C59498B1C6366E0701C90A0F58AD442B6A2AF13FC335F1DA068AA) |
| Delivery 2: meter measures 20,000 g, checker refuses, escrow expires and is cancelled | 250 USD back to the station | [259E3CB2](https://testnet.xrpl.org/transactions/259E3CB258772096C8B4739D280DF3E9B1A21B7674945A39F447D470B52AA99C) |

## How it works

1. **Order.** The station signs a `water.order/1`: the amount, the supplier's account, the meter's key,
   the grams ordered and the quality limits.
2. **Escrow.** The checker issues a PREIMAGE-SHA-256 condition for that order. The station locks the
   payment in a token escrow (`EscrowCreate`) under that condition, with an expiry.
3. **Delivery.** The meter signs cumulative `water.reading/1` records, each chained to the one before.
4. **Receipt.** The station signs a `water.receipt/1` that books what the meter measured.
5. **Check.** The checker verifies every record and confirms the escrow on the ledger matches the order.
   Only then does it reveal the fulfillment.
6. **Settlement.** The supplier finishes the escrow with the fulfillment. Without one, the escrow expires
   and the station cancels it to get its dollars back.

## What the checker refuses

- a receipt that books more than the meter measured
- a short delivery
- quality out of spec while the receipt says it passed
- a meter reading edited after signing, removed, reordered or replayed
- a reading signed by a key that is not the order's meter
- a totalizer that runs backwards
- a receipt not signed by the buyer
- an escrow that pays someone else, holds less than the order, or uses a different condition

## Run it

Needs Node 18 or later.

```
npm install
npm test        # offline tests, no network
npm run demo    # live on the XRP Ledger testnet, about two minutes
```

The demo funds three fresh accounts from the testnet faucet, sets up a test dollar, runs both
deliveries and writes every transaction hash to `last-run.json`.

## Limits of this demo

- **The dollar is a test token** from a demo issuer, standing in for RLUSD. RLUSD can be held in a
  token escrow only if its issuer turns on Allow Trust Line Locking.
- **The checker is a trusted party** that holds the secret. XRP Ledger escrow accepts only
  PREIMAGE-SHA-256 conditions. Smart Escrows (XLS-100, in development) could run the check on the
  ledger and remove that trust.
- **One escrow pays for one whole delivery.** A delivery in tranches would use one escrow per tranche.
- **Keys live in memory** for the length of a run. A real meter would hold its key in hardware.
- **The quality limits, price and amounts are made up** for the demo. They are not a water standard.
- **Testnet only.** No real money and no real operator data.

## Records

Every record is plain JSON, identified by the SHA-256 of its canonical form (keys sorted) and signed
with Ed25519 from Node's built-in crypto. The repository holds business records only: amounts,
hashes, signatures and pass or fail results. Do not add engineering or technical data.

## Export control

Self-assessed as not subject to the ITAR, and EAR99 while private (not subject to the EAR once
published). Cryptography is used only for signatures, hashing and escrow conditions. The repository
holds no engineering, flight hardware or controlled technical data, and must not be given any. See
[EXPORT-CONTROL.md](EXPORT-CONTROL.md) for the reasoning and the rules that keep it this way.

## License

Apache-2.0, see [LICENSE](LICENSE). Copyright 2026 SpaceOcean Finance Inc.

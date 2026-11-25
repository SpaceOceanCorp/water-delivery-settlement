# Export-control self-assessment: water-delivery-settlement

**DRAFT for review.** Self-assessment by SpaceOcean Finance Inc., 25 November 2026, against 22 CFR parts
120 and 121 (ITAR) and 15 CFR parts 734, 742, 772 and 774 (EAR). Check every citation against the
current eCFR before sign-off. This is not a legal opinion or a government determination. Re-check it
whenever the code, the data in it, or its users change.

## What this repository is

Business records and payment settlement for water deliveries: signed meter totals, quality values
checked against a buyer's own limits, a signed receipt, and an XRP Ledger token escrow that pays the
supplier only when those records check out. It does not control a pump, valve, meter, vehicle or
transfer. The same pattern applies to deliveries on Earth, such as bulk water, fuel or cold-chain
goods. The quality limits, prices and amounts in the repository are made up for the demo and are not
a water standard. Records carry numbers, keys, account addresses and hashes; the only free-text field
is an order id.

## ITAR (22 CFR 120 to 130)

- **Not a defense article.** Nothing here is a spacecraft or spacecraft part described in USML
  Category XV, and the software does not operate one.
- **Not technical data (22 CFR 120.33).** It contains no information required for the design,
  development, production, operation, repair, testing or modification of a defense article. The
  descriptions of water delivery in the README and code are general system descriptions, which
  120.33(b) excludes.
- **Software is not "specially designed" (22 CFR 120.41).** It was developed as general-purpose
  payment and record software for commercial deliveries, in space and on Earth, with no knowledge of
  use in or with a particular defense article, so 120.41(b)(4) and (b)(5) apply. This file, the
  README and the commit history are the contemporaneous records that Note 2 to 120.41(b) asks for.
- **No defense services.** Using or sharing this software does not by itself give anyone assistance
  with a defense article.

## EAR (15 CFR 730 to 774)

- **Not 9D515 or 9E515.** It is not software or technology specially designed or required for the
  development, production, operation, installation, maintenance or repair of a 9A515 spacecraft. The
  "specially designed" releases in 15 CFR 772.1(b)(4), (b)(5) and (b)(6) apply for the reasons above.
- **Encryption: not 5A002 or 5D002.** The repository uses cryptography only for digital signatures
  (Ed25519), hashing (SHA-256 record ids) and hash-based escrow conditions (PREIMAGE-SHA-256), all
  through Node's built-in crypto and the xrpl.js library's transaction signing. The Technical Note to
  5A002.a excludes authentication, digital signature and data integrity from "cryptography for data
  confidentiality". The repository encrypts no data. Network connections to the XRP Ledger use TLS
  provided by the Node.js runtime; the repository adds no encryption of its own.
- **Classification while private: EAR99.** Subject to the EAR, on no ECCN.
- **If published:** software made publicly available without restriction is "published" under
  15 CFR 734.7(a) and is no longer subject to the EAR. Publication is a separate decision by SpaceOcean
  Finance Inc., made after this assessment is signed off.

## Sharing with outside parties

- Sharing this repository or its documents with a company such as Ripple, including staff who are
  foreign persons or work outside the United States, is not an export of controlled technology
  while the rules below are kept, because the content is EAR99 and holds no technical data.
- That conclusion covers only this repository. It does not cover anything said or shown in meetings,
  so keep calls and demos to what is in the repository.

## Rules that keep it this way

- **Never add** interface geometry, tolerances, loads, flow rates, pressures, valve, seal or meter
  designs, docking or capture procedures, guidance, navigation or proximity-operations algorithms,
  test procedures, or anomaly and failure analysis. Not in code, examples, issues, commits or demos.
- **Never add data from a controlled program:** any ITAR-marked or export-controlled document, any
  government contract or proposal material, or any company's proprietary interface documents.
- **Quality limits stay example values.** Real station or customer specifications do not go in the
  repository.
- **Records stay code-based.** Do not add free-text fields that could carry technical detail.
- **Contributors and access.** While private, confirm each collaborator is cleared for the content.
  With the content above that is anyone. If these rules are ever broken, access becomes US persons
  only and the content leaves GitHub until it is reviewed.

## Re-review before

- adding a new record type or data field, or real (not example) limits
- adding a delay-tolerant networking (Bundle Protocol) transport. Keep it general-purpose, not built
  for a particular spacecraft or program. If it adds encryption for confidentiality (for example
  BPSec confidentiality), review it against 5A002 and 5D002, and check whether publishing it needs a
  notification under 15 CFR 742.15(b)
- using mainnet or real customers. Sanctions screening of counterparties is a separate check
- making the repository public

## Sign-off

| Role | Name | Date |
|---|---|---|
| Prepared by | | |
| Reviewed by (counsel or export-control officer) | | |
| Decision to publish | | |

// Signed records: plain JSON, identified by the SHA-256 of their canonical form,
// signed with Ed25519 from Node's built-in crypto.

import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

// Canonical JSON: object keys sorted at every level, no whitespace.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`numbers must be safe integers, got ${value}`);
  }
  return JSON.stringify(value);
}

export function recordId(body) {
  return createHash('sha256').update(canonical(body)).digest('hex');
}

// A signing party: a name for display and an Ed25519 key pair.
export function newParty(name) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { name, key: raw.toString('hex'), privateKey };
}

export function signRecord(body, party) {
  const id = recordId(body);
  const sig = sign(null, Buffer.from(id, 'hex'), party.privateKey).toString('hex');
  return { body, id, signer: party.key, sig };
}

// True when the id matches the body and the signature is valid for the stated signer.
export function verifyRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const { body, id, signer, sig } = record;
  if (!body || typeof id !== 'string' || typeof signer !== 'string' || typeof sig !== 'string') return false;
  if (recordId(body) !== id) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(signer, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(id, 'hex'), publicKey, Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

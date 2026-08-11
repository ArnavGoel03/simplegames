// The roll and shuffle derivations the games actually use, reimplemented here
// so the demonstration on the home page is the real thing rather than a
// picture of it.
//
// This file is deliberately a mirror of two files in the Chaupal repository:
// packages/fairness/src/rng.ts and packages/fairness/src/shuffle.ts. If either
// of those changes, this one is wrong, and the home page starts quietly lying
// about how the games work. That is the worst failure this site can have, so
// they are checked against each other by eye at every release until they share
// a package.
//
// Scheme: a random 32 byte seed is committed to by publishing SHA-256 of it.
// Each roll is derived independently as HMAC-SHA256(seed, index) with
// rejection sampling for an unbiased 1 to 6. Rolls are keyed by index rather
// than consumed off a stream, so any single roll can be recomputed and checked
// without replaying the whole game. A deal comes off the same seed through a
// Fisher-Yates shuffle under a different message label, so one seed serves the
// dice games and the card game without either telling you anything about the
// other.

export const SEED_BYTES = 32;

/**
 * Largest multiple of 6 that fits in a byte.
 *
 * Bytes at or above it are thrown away. 256 is not divisible by 6, so taking
 * the remainder without rejecting would make faces 1 to 4 come up 43 times in
 * 256 against 42 for faces 5 and 6. That is a 0.4 percentage point skew: far
 * too small for a player to notice, and far too large for a site that claims
 * the dice are honest.
 */
export const REJECTION_CEILING = 252;

export function generateSeed(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SEED_BYTES));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

/** The commitment: what gets published before anything is rolled. */
export async function commitSeed(seed: Uint8Array): Promise<string> {
  return sha256Hex(seed);
}

export async function verifyCommitment(seed: Uint8Array, commitment: string): Promise<boolean> {
  return (await commitSeed(seed)) === commitment;
}

// Eight bytes: the roll's index, then a retry counter, both big-endian uint32.
// The retry counter keeps the result deterministic in the vanishingly rare case
// that a whole digest misses the rejection window, while guaranteeing the loop
// terminates.
function encodeMessage(index: number, retry: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, index, false);
  view.setUint32(4, retry, false);
  return buffer;
}

async function importKey(seed: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toBuffer(seed), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

export async function rollDie(seed: Uint8Array, index: number): Promise<number> {
  const key = await importKey(seed);
  let retry = 0;
  // Loops only if 32 HMAC outputs in a row miss the rejection window, which is
  // a (4/256)^32 chance.
  for (;;) {
    const digest = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encodeMessage(index, retry)),
    );
    for (const byte of digest) {
      if (byte < REJECTION_CEILING) return (byte % 6) + 1;
    }
    retry++;
  }
}

export async function rollSeries(seed: Uint8Array, count: number): Promise<number[]> {
  const rolls: number[] = [];
  for (let index = 0; index < count; index++) {
    rolls.push(await rollDie(seed, index));
  }
  return rolls;
}

// ---------- the deal ----------
//
// Fisher-Yates driven by the same HMAC, with the same rejection sampling, so
// the permutation is uniform rather than merely scrambled. A biased shuffle is
// exactly the accusation this project exists to answer, and the bias a naive
// modulo introduces is far too small for a player to notice and far too large
// for a site that claims the deal is honest.
//
// Domain separation from rollDie is structural, not conventional. rollDie
// signs an 8 byte message; every message below is 16 bytes and begins with the
// ASCII bytes "deal", so no preimage here can ever equal a preimage there, and
// a hand therefore tells an observer nothing about the dice drawn from the
// same seed.

const DEAL_DOMAIN = new Uint8Array([0x64, 0x65, 0x61, 0x6c]); // "deal"

// Sixteen bytes: the domain prefix, then the nonce, the draw counter and the
// retry counter as big-endian uint32.
function encodeDealMessage(nonce: number, draw: number, retry: number): ArrayBuffer {
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);
  bytes.set(DEAL_DOMAIN, 0);
  const view = new DataView(buffer);
  view.setUint32(4, nonce, false);
  view.setUint32(8, draw, false);
  view.setUint32(12, retry, false);
  return buffer;
}

/**
 * A uniform integer in [0, bound), by rejection.
 *
 * Bytes at or above the largest multiple of `bound` that fits in a byte are
 * discarded, for the same reason REJECTION_CEILING exists above: 256 is not
 * generally divisible by `bound`, and taking the remainder without rejecting
 * would favour the low values.
 */
async function uniformBelow(
  key: CryptoKey,
  nonce: number,
  draw: number,
  bound: number,
): Promise<number> {
  const ceiling = Math.floor(256 / bound) * bound;
  let retry = 0;
  for (;;) {
    const digest = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encodeDealMessage(nonce, draw, retry)),
    );
    for (const byte of digest) {
      if (byte < ceiling) return byte % bound;
    }
    retry++;
  }
}

/**
 * A permutation of 0..count-1, reproducible from the seed and nonce alone.
 *
 * The nonce separates deals drawn from one seed, so a thirteen round match
 * uses the round number and every round is independent while the whole match
 * still verifies from the single seed revealed at the end.
 */
export async function shuffleIndices(
  seed: Uint8Array,
  nonce: number,
  count: number,
): Promise<number[]> {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`shuffleIndices: count must be a non-negative integer, got ${count}`);
  }
  const order = Array.from({ length: count }, (_, index) => index);
  if (count < 2) return order;

  const key = await importKey(seed);
  // Walks downward so each step chooses uniformly from the unplaced tail,
  // which is the only ordering of Fisher-Yates that is actually unbiased.
  let draw = 0;
  for (let i = count - 1; i > 0; i--) {
    const j = await uniformBelow(key, nonce, draw, i + 1);
    draw++;
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

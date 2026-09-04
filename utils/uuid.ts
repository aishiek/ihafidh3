/**
 * Lightweight, dependency-free UUID v4 generator.
 *
 * Uses expo-crypto's getRandomValues when available (falls back to Math.random,
 * which is fine here — these IDs are only used to correlate analytics events
 * within a single session, never as security tokens).
 */

function fillRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoCrypto = require('expo-crypto');
    if (expoCrypto && typeof expoCrypto.getRandomValues === 'function') {
      expoCrypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {
    /* expo-crypto not available — fall through to Math.random */
  }
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function generateUUID(): string {
  const bytes = fillRandomBytes(16);
  // Per RFC 4122: set version (4) and variant (10xxxxxx) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] + 0x100).toString(16).substring(1));
  }

  return (
    hex[0] + hex[1] + hex[2] + hex[3] + '-' +
    hex[4] + hex[5] + '-' +
    hex[6] + hex[7] + '-' +
    hex[8] + hex[9] + '-' +
    hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
  );
}

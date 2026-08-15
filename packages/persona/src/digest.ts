/**
 * FNV-1a, 32 bit, base36.
 *
 * This is a deliberate, documented COPY of the private `scopeDigest` in
 * `layers/base/composables/useCookieConsent.ts` (lines 72-84), reproduced
 * byte-for-byte rather than lifted out of it.
 *
 * Section 14.4: lifting it would edit the live cookie-consent composable, and
 * any drift there changes the cookie scope digest, which silently invalidates
 * every stored consent on all three instances and forces a global re-prompt.
 * That risk is not worth deduplicating eight lines of FNV-1a. What keeps the two
 * copies honest instead is a test in this package pinning the exact same digest
 * values, so a future edit to either implementation fails red.
 *
 * Deterministic and dependency-free, and it must produce the identical value
 * during SSR and again on hydration, so it is a pure string function with no
 * Date, no randomness and no platform APIs.
 */
export function fnv1a32(parts: string[]): string {
  let h = 0x811c9dc5;
  for (const s of parts) {
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(36);
}

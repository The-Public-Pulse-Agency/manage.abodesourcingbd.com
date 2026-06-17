import { timingSafeEqual } from "node:crypto";

/** True iff a secret is configured AND the header carries exactly `Bearer <secret>`.
 * Uses a constant-time comparison so the secret can't be recovered via timing. */
export function isAuthorized(
  headerValue: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !headerValue) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(headerValue);
  // timingSafeEqual throws on length mismatch; the length itself isn't secret.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

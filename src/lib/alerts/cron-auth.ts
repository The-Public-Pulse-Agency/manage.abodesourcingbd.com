/** True iff a secret is configured AND the header carries exactly `Bearer <secret>`. */
export function isAuthorized(
  headerValue: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  return headerValue === `Bearer ${secret}`;
}

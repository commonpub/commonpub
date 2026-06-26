// Referral carrier cookie codec (session 229). The cookie carries the public
// referral code plus the click time, encoded as `code.issuedAtMs`. The click
// time lets claimReferral apply the new-user guard precisely (attribute only an
// account created at/after the click), which is what stops an existing logged-in
// user from being attributed just for clicking a /r link. The code charset
// (letters/numbers/hyphens) never contains a dot, so splitting on the last dot
// is unambiguous. Auto-imported by Nitro (server/utils).

export const REFERRAL_COOKIE = 'cpub_ref';

export function encodeReferralCookie(code: string, issuedAtMs: number): string {
  return `${code}.${issuedAtMs}`;
}

export function decodeReferralCookie(value: string | undefined | null): { code: string; clickedAt?: Date } | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot === -1) return value.length ? { code: value } : null;
  const code = value.slice(0, dot);
  if (!code) return null;
  const ts = Number(value.slice(dot + 1));
  return { code, clickedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts) : undefined };
}

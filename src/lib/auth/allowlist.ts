/**
 * Access allowlist. Set ALLOWED_EMAILS (comma-separated, case-insensitive)
 * in the environment — it is deliberately not committed, since the repo is
 * public. With the variable unset, nobody is authorized.
 */
const allowed = new Set(
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && allowed.has(email.toLowerCase());
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed voter links: `base64url({p, e}).hmac`. The voter flow
 * needs no account — possession of an unexpired signed link is the
 * credential. Links expire; nothing is stored server-side.
 */

function secret(): string {
  const s = process.env.VOTER_LINK_SECRET;
  if (!s) throw new Error("VOTER_LINK_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createVoterToken(personId: string, days = 14): string {
  const payload = Buffer.from(
    JSON.stringify({ p: personId, e: Date.now() + days * 86_400_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the person id for a valid, unexpired token; null otherwise. */
export function verifyVoterToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const { p, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      p: string;
      e: number;
    };
    if (typeof p !== "string" || typeof e !== "number" || Date.now() > e)
      return null;
    return p;
  } catch {
    return null;
  }
}

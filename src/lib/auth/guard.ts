import { NextResponse } from "next/server";
import { auth } from "./server";
import { isAllowedEmail } from "./allowlist";

/**
 * Returns an error response unless there is a signed-in, verified session
 * whose email is on the campaign allowlist; null when access is granted.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAllowedEmail(session.user.email)) {
    return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  }
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "unverified" }, { status: 403 });
  }
  return null;
}

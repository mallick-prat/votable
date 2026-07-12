import { NextResponse } from "next/server";
import { auth } from "./server";

/** Returns a 401 response if there is no signed-in session, else null. */
export async function requireSession(): Promise<NextResponse | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

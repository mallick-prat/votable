import { NextResponse } from "next/server";
import { auth } from "./server";
import { getStaffByEmail } from "@/lib/db";
import type { Role, Staff } from "@/lib/types";

/**
 * Resolves the signed-in staff member, or an error response:
 * 401 signed out, 403 not invited / email unverified / wrong role.
 * Authorization lives here and in the db layer — never in the client.
 */
export async function requireStaff(
  ...roles: Role[]
): Promise<Staff | NextResponse> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const staff = await getStaffByEmail(session.user.email ?? "");
  if (!staff) {
    return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  }
  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "unverified" }, { status: 403 });
  }
  if (roles.length > 0 && !roles.includes(staff.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return staff;
}

export function isDenied(result: Staff | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

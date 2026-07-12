import { NextResponse } from "next/server";
import { requireStaff, isDenied } from "@/lib/auth/guard";
import { createVoterToken } from "@/lib/voter-link";
import { getPersonById } from "@/lib/db";

/** Any staff role may generate a voter self-service link (tabling included). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;

  const { id } = await params;
  if (!(await getPersonById(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = createVoterToken(id);
  const url = new URL(`/v/${token}`, request.url).toString();
  return NextResponse.json({ url });
}

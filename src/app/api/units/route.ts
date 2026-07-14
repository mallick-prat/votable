import { NextResponse } from "next/server";
import { listUnits, updateUnitMailStreet } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

/** Units and mail-center streets are public reference data (no PII). */
export async function GET() {
  return NextResponse.json({ units: await listUnits() });
}

export async function PATCH(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;
  const { id, mailStreet } = (await request.json()) as {
    id?: string;
    mailStreet?: string;
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const result = await updateUnitMailStreet(staff, id, mailStreet ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

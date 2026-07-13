import { NextResponse } from "next/server";
import { importPeople } from "@/lib/db";
import { buildPerson, type PersonInput } from "@/lib/roster";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function POST(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as { rows?: PersonInput[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  }
  if (body.rows.length > 5000) {
    return NextResponse.json({ error: "Import in batches of 5000 or fewer" }, { status: 400 });
  }

  const valid = body.rows.filter(
    (r) => r.email?.includes("@") && r.firstName?.trim() && r.lastName?.trim(),
  );
  const result = await importPeople(valid.map(buildPerson));
  return NextResponse.json({ ...result, invalid: body.rows.length - valid.length });
}

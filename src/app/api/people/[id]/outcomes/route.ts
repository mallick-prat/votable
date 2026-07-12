import { NextResponse } from "next/server";
import { addOutcome, undoOutcome } from "@/lib/db";
import { OUTCOME_LABEL, type ContactOutcome } from "@/lib/types";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;

  const { id } = await params;
  const { outcome } = (await request.json()) as { outcome?: string };
  if (!outcome || !(outcome in OUTCOME_LABEL)) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  const ok = await addOutcome(staff, id, outcome as ContactOutcome);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff("admin", "captain", "organizer");
  if (isDenied(staff)) return staff;

  const { id } = await params;
  const ok = await undoOutcome(staff, id);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}

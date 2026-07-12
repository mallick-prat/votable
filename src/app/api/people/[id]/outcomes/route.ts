import { NextResponse } from "next/server";
import { addOutcome, undoOutcome } from "@/lib/db";
import { OUTCOME_LABEL, type ContactOutcome } from "@/lib/types";
import { requireSession } from "@/lib/auth/guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const { outcome } = (await request.json()) as { outcome?: string };
  if (!outcome || !(outcome in OUTCOME_LABEL)) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  await addOutcome(id, outcome as ContactOutcome);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  await undoOutcome(id);
  return NextResponse.json({ ok: true });
}

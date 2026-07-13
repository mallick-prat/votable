import { NextResponse } from "next/server";
import { mergePeople } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

/** Merge this person (duplicate) into targetId; history moves, source is removed. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const { id } = await params;
  const { targetId } = (await request.json()) as { targetId?: string };
  if (!targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }
  const result = await mergePeople(staff, id, targetId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

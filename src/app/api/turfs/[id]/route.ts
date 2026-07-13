import { NextResponse } from "next/server";
import { deleteTurf, mergeTurfs, splitTurf, updateTurf } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff("admin", "captain");
  if (isDenied(staff)) return staff;
  const { id } = await params;
  const patch = (await request.json()) as {
    name?: string;
    captainEmail?: string | null;
    organizerEmail?: string | null;
  };
  const result = await updateTurf(staff, id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

/** action: "split" or "merge" (with targetId). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;
  const { id } = await params;
  const body = (await request.json()) as { action?: string; targetId?: string };

  if (body.action === "split") {
    const result = await splitTurf(staff, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, newId: result.newId });
  }
  if (body.action === "merge" && body.targetId) {
    const result = await mergeTurfs(staff, id, body.targetId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;
  const { id } = await params;
  const result = await deleteTurf(staff, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

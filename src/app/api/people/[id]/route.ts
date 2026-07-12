import { NextResponse } from "next/server";
import { updatePerson } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSession();
  if (denied) return denied;

  const { id } = await params;
  const patch = (await request.json()) as Record<string, unknown>;
  const updated = await updatePerson(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Nothing updated" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

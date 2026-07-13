import { NextResponse } from "next/server";
import { addDeadline, deleteDeadline, listDeadlines } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function GET() {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;
  return NextResponse.json({ deadlines: await listDeadlines() });
}

export async function POST(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;
  const body = (await request.json()) as {
    jurisdiction?: string;
    type?: string;
    date?: string;
    sourceUrl?: string;
    note?: string;
  };
  if (!body.jurisdiction || !body.type || !body.date || !body.sourceUrl) {
    return NextResponse.json(
      { error: "jurisdiction, type, date, and sourceUrl are required" },
      { status: 400 },
    );
  }
  const result = await addDeadline(staff, {
    jurisdiction: body.jurisdiction,
    type: body.type,
    date: body.date,
    sourceUrl: body.sourceUrl,
    note: body.note,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;
  const { id } = (await request.json()) as { id?: number };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const result = await deleteDeadline(staff, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { listStaff, upsertStaff, deleteStaff } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";
import type { Role } from "@/lib/types";

export async function GET() {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;
  return NextResponse.json({ staff: await listStaff(staff) });
}

export async function POST(request: Request) {
  const staff = await requireStaff("admin", "captain");
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as {
    email?: string;
    role?: Role;
    scope?: string | null;
    displayName?: string;
  };
  if (!body.email || !body.role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 });
  }
  const result = await upsertStaff(staff, {
    email: body.email,
    role: body.role,
    scope: body.scope,
    displayName: body.displayName,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const { email } = (await request.json()) as { email?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const result = await deleteStaff(staff, email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

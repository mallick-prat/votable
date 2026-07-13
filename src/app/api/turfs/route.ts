import { NextResponse } from "next/server";
import { createTurfs, listTurfs, organizerWorkload } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function GET() {
  const staff = await requireStaff("admin", "captain", "organizer");
  if (isDenied(staff)) return staff;
  const [turfs, workload] = await Promise.all([
    listTurfs(staff),
    staff.role === "admin" || staff.role === "captain"
      ? organizerWorkload()
      : Promise.resolve([]),
  ]);
  return NextResponse.json({ turfs, workload });
}

export async function POST(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as {
    baseName?: string;
    unitId?: string;
    building?: string;
    onlyUnassigned?: boolean;
    targetSize?: number;
    captainEmail?: string | null;
    organizerEmail?: string | null;
  };
  if (!body.baseName?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const result = await createTurfs(staff, {
    baseName: body.baseName.trim(),
    unitId: body.unitId || undefined,
    building: body.building || undefined,
    onlyUnassigned: body.onlyUnassigned ?? true,
    targetSize: body.targetSize,
    captainEmail: body.captainEmail,
    organizerEmail: body.organizerEmail,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ created: result.created });
}

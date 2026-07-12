import { NextResponse } from "next/server";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function GET() {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;
  return NextResponse.json({ me: staff });
}

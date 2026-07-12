import { NextResponse } from "next/server";
import { getPeople } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const people = await getPeople();
  return NextResponse.json({ people });
}

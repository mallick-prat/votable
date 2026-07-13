import { NextResponse } from "next/server";
import { getPeople, importPeople } from "@/lib/db";
import { buildPerson, type PersonInput } from "@/lib/roster";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function GET() {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;
  const people = await getPeople(staff);
  return NextResponse.json({ people });
}

/** Manually add a single person (admin). */
export async function POST(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const input = (await request.json()) as PersonInput;
  if (!input.email?.includes("@") || !input.firstName?.trim() || !input.lastName?.trim()) {
    return NextResponse.json(
      { error: "First name, last name, and a valid email are required" },
      { status: 400 },
    );
  }
  const person = buildPerson(input);
  const { added } = await importPeople([person]);
  return NextResponse.json({ id: person.id, existed: added === 0 });
}

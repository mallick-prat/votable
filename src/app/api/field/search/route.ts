import { NextResponse } from "next/server";
import { fieldSearch, insertPeople } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";
import { rowToPerson } from "@/lib/roster";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;

  const { q } = (await request.json()) as { q?: string };
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }
  // Deliberately residence-free results — field mode never exposes rooms.
  return NextResponse.json({ results: await fieldSearch(q) });
}

/** Create a walk-up participant not in the imported universe. */
export async function PUT(request: Request) {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.email?.includes("@")) {
    return NextResponse.json(
      { error: "First name, last name, and a valid email are required" },
      { status: 400 },
    );
  }
  const person = rowToPerson({
    year: "",
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email.trim(),
    suite: "Field signup",
    phone: "",
    city: "",
    state: "",
    zip: "",
  });
  const added = await insertPeople([person]);
  return NextResponse.json({ id: person.id, existed: added === 0 });
}

import { NextResponse } from "next/server";
import { insertPeople } from "@/lib/db";
import { parseRosterText, rowToPerson } from "@/lib/roster";
import { requireStaff, isDenied } from "@/lib/auth/guard";

export async function POST(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as { text?: string };
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "No roster text" }, { status: 400 });
  }
  const { rows, errors } = parseRosterText(body.text);
  const added = await insertPeople(rows.map(rowToPerson));
  return NextResponse.json({ added, skipped: rows.length - added, errors });
}

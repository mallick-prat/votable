import { NextResponse } from "next/server";
import { getPersonById, recordRegistrationCheck, updatePerson } from "@/lib/db";
import { getAdapter } from "@/lib/jurisdictions";
import { requireStaff, isDenied } from "@/lib/auth/guard";

/**
 * Start or record a registration check for a person.
 * Without `result`: returns the jurisdiction's official workflow (there is
 * no national registration database — checks go through the official state
 * lookup). With `result`: records the confirmed outcome.
 */
export async function POST(request: Request) {
  const staff = await requireStaff();
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as { personId?: string; result?: string };
  if (!body.personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }
  const person = await getPersonById(body.personId);
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jurisdiction = person.jurisdiction === "ma" ? "MA" : person.homeState;
  if (!jurisdiction) {
    return NextResponse.json(
      { error: "No voting state on file — set home state or choose Massachusetts first" },
      { status: 400 },
    );
  }

  if (body.result) {
    const ok = await recordRegistrationCheck(
      person.id,
      jurisdiction,
      body.result,
      "organizer_recorded",
    );
    if (!ok) return NextResponse.json({ error: "Unknown result" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Starting a check: surface the official workflow and mark the person.
  const adapter = getAdapter(jurisdiction);
  if (person.registrationStatus === "unknown") {
    await updatePerson(staff, person.id, { registrationStatus: "lookup_required" });
  }
  return NextResponse.json({ adapter });
}

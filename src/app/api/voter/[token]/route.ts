import { NextResponse } from "next/server";
import { verifyVoterToken } from "@/lib/voter-link";
import { getPersonById, updatePersonAsVoter } from "@/lib/db";
import { VOTER_PATCHABLE, type Person } from "@/lib/types";

/** What a voter sees about themselves — no organizer or campaign fields. */
function voterView(p: Person) {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    classYear: p.classYear,
    house: p.house,
    homeState: p.homeState,
    jurisdiction: p.jurisdiction,
    method: p.method,
    mailbox: p.mailbox,
    ballotAddress: p.ballotAddress,
    registrationStatus: p.registrationStatus,
    ballotStatus: p.ballotStatus,
    planStatus: p.planStatus,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const personId = verifyVoterToken(token);
  if (!personId) {
    return NextResponse.json({ error: "invalid_link" }, { status: 401 });
  }
  const person = await getPersonById(personId);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ person: voterView(person) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const personId = verifyVoterToken(token);
  if (!personId) {
    return NextResponse.json({ error: "invalid_link" }, { status: 401 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const ALLOWED_VALUES: Record<string, string[] | null> = {
    jurisdiction: ["home", "ma"],
    method: ["mail", "in_person"],
    mailbox: null, // free text
    ballotAddress: null,
    registrationStatus: [
      "unknown", "voter_confirmed", "pending", "no_match", "needs_registration",
      "registration_started", "application_submitted", "lookup_required", "manual_help",
    ],
    ballotStatus: [
      "not_started", "not_needed", "request_needed", "requested", "mailed",
      "carrier_delivered", "notice_received", "picked_up", "missing", "returned",
    ],
    planStatus: ["none", "started", "complete"],
  };
  const patch: Record<string, unknown> = {};
  for (const field of VOTER_PATCHABLE) {
    if (!(field in body)) continue;
    const allowed = ALLOWED_VALUES[field];
    const value = body[field];
    if (allowed === null) {
      const cap = field === "ballotAddress" ? 300 : 40;
      if (typeof value === "string" && value.length <= cap) patch[field] = value;
    } else if (typeof value === "string" && allowed?.includes(value)) {
      patch[field] = value;
    }
  }
  const ok = await updatePersonAsVoter(personId, patch);
  if (!ok) return NextResponse.json({ error: "Nothing updated" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

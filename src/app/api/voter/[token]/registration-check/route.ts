import { NextResponse } from "next/server";
import { verifyVoterToken } from "@/lib/voter-link";
import { getPersonById, recordRegistrationCheck } from "@/lib/db";
import { getAdapter } from "@/lib/jurisdictions";

/** Voter-performed official lookup: GET the workflow, POST the confirmed result. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const personId = verifyVoterToken(token);
  if (!personId) return NextResponse.json({ error: "invalid_link" }, { status: 401 });
  const person = await getPersonById(personId);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const jurisdiction = person.jurisdiction === "ma" ? "MA" : person.homeState;
  if (!jurisdiction) {
    return NextResponse.json({ error: "no_jurisdiction" }, { status: 400 });
  }
  return NextResponse.json({ adapter: getAdapter(jurisdiction) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const personId = verifyVoterToken(token);
  if (!personId) return NextResponse.json({ error: "invalid_link" }, { status: 401 });
  const person = await getPersonById(personId);
  if (!person) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { result } = (await request.json()) as { result?: string };
  const jurisdiction = person.jurisdiction === "ma" ? "MA" : person.homeState;
  if (!result || !jurisdiction) {
    return NextResponse.json({ error: "result required" }, { status: 400 });
  }
  const ok = await recordRegistrationCheck(personId, jurisdiction, result, "voter_confirmed");
  if (!ok) return NextResponse.json({ error: "Unknown result" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { listStateRules, saveStateRule } from "@/lib/db";
import { requireStaff, isDenied } from "@/lib/auth/guard";

/**
 * Published rules are public reference data (voter pages read them without
 * an account). Drafts are admin-only via ?all=1.
 */
export async function GET(request: Request) {
  const all = new URL(request.url).searchParams.get("all") === "1";
  if (all) {
    const staff = await requireStaff("admin");
    if (isDenied(staff)) return staff;
    return NextResponse.json({ rules: await listStateRules(false) });
  }
  return NextResponse.json({ rules: await listStateRules(true) });
}

export async function PUT(request: Request) {
  const staff = await requireStaff("admin");
  if (isDenied(staff)) return staff;

  const body = (await request.json()) as {
    jurisdiction?: string;
    patch?: Record<string, unknown>;
    publish?: boolean;
  };
  if (!body.jurisdiction || !body.patch) {
    return NextResponse.json({ error: "jurisdiction and patch required" }, { status: 400 });
  }
  const result = await saveStateRule(
    staff,
    body.jurisdiction,
    body.patch,
    body.publish ?? false,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

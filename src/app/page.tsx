"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { StatTile, SectionTitle, ContactTag, RegistrationTag } from "@/components/ui";
import { JURISDICTIONS } from "@/lib/jurisdictions";

export default function Dashboard() {
  const { people, ready } = useStore();
  if (!ready) return null;

  const total = people.length;
  const active = people.filter((p) => p.contactStatus !== "opted_out");
  const contacted = people.filter((p) => p.contactStatus === "contacted").length;
  const followUps = people.filter((p) => p.contactStatus === "follow_up");
  const regConfirmed = people.filter(
    (p) => p.registrationStatus === "voter_confirmed",
  ).length;
  const regUnresolved = active.filter(
    (p) =>
      p.registrationStatus === "unknown" ||
      p.registrationStatus === "lookup_required" ||
      p.registrationStatus === "needs_registration",
  );
  const ballotOutstanding = active.filter(
    (p) => p.ballotStatus === "request_needed" || p.ballotStatus === "requested",
  );
  const plansComplete = people.filter((p) => p.planStatus === "complete").length;

  const byState = new Map<string, number>();
  for (const p of people) byState.set(p.homeState, (byState.get(p.homeState) ?? 0) + 1);
  const states = [...byState.entries()].sort((a, b) => b[1] - a[1]);
  const maxState = states[0]?.[1] ?? 1;

  const needsAttention = [
    ...followUps.map((p) => ({ p, why: "Follow-up requested" })),
    ...active
      .filter((p) => p.ballotStatus === "request_needed")
      .map((p) => ({ p, why: "Ballot request needed" })),
    ...active
      .filter(
        (p) =>
          p.registrationStatus === "needs_registration" ||
          p.registrationStatus === "lookup_required",
      )
      .map((p) => ({ p, why: "Registration unresolved" })),
  ];

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Campaign overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline mt-6">
        <StatTile label="Universe" value={total} />
        <StatTile
          label="Contacted"
          value={contacted}
          hint={total ? `${Math.round((contacted / total) * 100)}% of universe` : undefined}
        />
        <StatTile
          label="Registration confirmed"
          value={regConfirmed}
          hint={`${regUnresolved.length} unresolved`}
        />
        <StatTile
          label="Plans complete"
          value={plansComplete}
          hint={`${ballotOutstanding.length} ballots outstanding`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <SectionTitle>Needs attention</SectionTitle>
          {needsAttention.length === 0 ? (
            <p className="text-ink-muted">Nothing in the queue.</p>
          ) : (
            <ul className="border-t border-hairline">
              {needsAttention.slice(0, 12).map(({ p, why }, i) => (
                <li key={p.id + i} className="border-b border-hairline">
                  <Link
                    href={`/people/${p.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-1 px-2 -mx-2"
                  >
                    <span>
                      {p.firstName} {p.lastName}
                      <span className="text-ink-subtle"> · {p.building} {p.room}</span>
                    </span>
                    <span className="text-ink-muted text-[12px]">{why}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <SectionTitle>Home states</SectionTitle>
          <ul className="space-y-2">
            {states.map(([code, n]) => (
              <li key={code} className="flex items-center gap-3">
                <span className="w-8 text-ink-muted text-[12px]">{code}</span>
                <span
                  className="h-4 bg-primary"
                  style={{ width: `${(n / maxState) * 70}%`, minWidth: 4 }}
                />
                <span className="text-[12px] text-ink-muted">
                  {n} · {JURISDICTIONS[code]?.name ?? code}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ink-subtle text-[12px] mt-4">
            Election rules and deadlines are never shown from memory — every
            workflow links to the official source for the voter&apos;s state.
          </p>
        </div>
      </div>

      <SectionTitle>Pipeline</SectionTitle>
      <div className="border border-hairline divide-y divide-hairline">
        {people.slice(0, 8).map((p) => (
          <Link
            key={p.id}
            href={`/people/${p.id}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-1"
          >
            <span className="min-w-0 truncate">
              {p.firstName} {p.lastName}
            </span>
            <span className="flex gap-2 shrink-0">
              <ContactTag s={p.contactStatus} />
              <RegistrationTag s={p.registrationStatus} />
            </span>
          </Link>
        ))}
      </div>
      <Link href="/people" className="inline-block mt-3 text-primary hover:underline">
        View all people →
      </Link>
    </div>
  );
}

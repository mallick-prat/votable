"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { StatTile, SectionTitle, ContactTag, RegistrationTag } from "@/components/ui";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { UNITS } from "@/lib/units";
import {
  BALLOT_STATUS_LABEL,
  Deadline,
  DEADLINE_TYPE_LABEL,
  DeadlineType,
  Person,
  REGISTRATION_STATUS_LABEL,
  Staff,
  Turf,
} from "@/lib/types";

/** The state a student's election rules follow, given their plan. */
function effectiveState(p: Person): string {
  return p.jurisdiction === "ma" ? "MA" : p.homeState;
}

/** Organizers see their own assignment list, not campaign totals. */
function OrganizerDashboard() {
  const people = useStore().people.filter((p) => p.active);
  const followUps = people.filter((p) => p.contactStatus === "follow_up");
  const uncontacted = people.filter((p) => p.contactStatus === "uncontacted");

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">My people</h1>
      {people.length === 0 ? (
        <p className="text-ink-muted mt-4">
          No one is assigned to you yet — ask your captain for an assignment.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline mt-6 max-w-xl">
            <StatTile label="Assigned" value={people.length} />
            <StatTile label="Uncontacted" value={uncontacted.length} />
            <StatTile label="Follow-ups" value={followUps.length} />
          </div>
          <Link
            href="/canvass"
            className="inline-block mt-4 bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
          >
            Start canvassing
          </Link>
          <SectionTitle>Follow-ups due</SectionTitle>
          {followUps.length === 0 ? (
            <p className="text-ink-muted">None — nice.</p>
          ) : (
            <ul className="border-t border-hairline max-w-xl">
              {followUps.map((p) => (
                <li key={p.id} className="border-b border-hairline">
                  <Link
                    href={`/people/${p.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-1 px-2 -mx-2"
                  >
                    <span>
                      {p.firstName} {p.lastName}
                      <span className="text-ink-subtle"> · {p.building} {p.room}</span>
                    </span>
                    <ContactTag s={p.contactStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_FILTERS = {
  unit: "",
  organizer: "",
  captain: "",
  classYear: "",
  state: "",
  registration: "",
  ballot: "",
};

const EMPTY_DEADLINE = {
  jurisdiction: "",
  type: "registration" as DeadlineType,
  date: "",
  sourceUrl: "",
  note: "",
};

export default function Dashboard() {
  const { me, people: allPeople, ready } = useStore();
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [addingDeadline, setAddingDeadline] = useState(false);
  const [deadlineForm, setDeadlineForm] = useState(EMPTY_DEADLINE);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);

  const isManager = me?.role === "admin" || me?.role === "captain";

  const loadExtras = useCallback(async () => {
    const [sr, tr, dr] = await Promise.all([
      fetch("/api/staff"),
      fetch("/api/turfs"),
      fetch("/api/deadlines"),
    ]);
    if (sr.ok) setStaffList(((await sr.json()) as { staff: Staff[] }).staff);
    if (tr.ok) setTurfs(((await tr.json()) as { turfs: Turf[] }).turfs);
    if (dr.ok) setDeadlines(((await dr.json()) as { deadlines: Deadline[] }).deadlines);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data can only arrive after mount
    loadExtras();
  }, [isManager, loadExtras]);

  // Field volunteers have exactly one workflow.
  useEffect(() => {
    if (ready && me?.role === "field") router.replace("/field");
  }, [ready, me, router]);

  const active = useMemo(() => allPeople.filter((p) => p.active), [allPeople]);
  const turfCaptainById = useMemo(
    () => new Map(turfs.map((t) => [t.id, t.captainEmail])),
    [turfs],
  );

  const people = useMemo(
    () =>
      active.filter((p) => {
        if (filters.unit && p.unitId !== filters.unit) return false;
        if (filters.organizer && p.assignedTo !== filters.organizer) return false;
        if (
          filters.captain &&
          (p.turfId ? turfCaptainById.get(p.turfId) : null) !== filters.captain
        )
          return false;
        if (filters.classYear && p.classYear !== filters.classYear) return false;
        if (filters.state && effectiveState(p) !== filters.state) return false;
        if (filters.registration && p.registrationStatus !== filters.registration)
          return false;
        if (filters.ballot && p.ballotStatus !== filters.ballot) return false;
        return true;
      }),
    [active, filters, turfCaptainById],
  );

  if (!ready || !me) return null;
  if (me.role === "field") return null;
  if (me.role === "organizer") return <OrganizerDashboard />;

  const notOptedOut = people.filter((p) => p.contactStatus !== "opted_out");
  const stats = {
    total: people.length,
    assigned: people.filter((p) => p.assignedTo).length,
    unassigned: people.filter((p) => !p.assignedTo).length,
    contacted: people.filter((p) => p.contactStatus === "contacted").length,
    regConfirmed: people.filter((p) =>
      ["voter_confirmed"].includes(p.registrationStatus),
    ).length,
    regUnresolved: notOptedOut.filter((p) =>
      ["unknown", "lookup_required", "needs_registration"].includes(p.registrationStatus),
    ).length,
    ballotRequestsNeeded: notOptedOut.filter((p) => p.ballotStatus === "request_needed")
      .length,
    ballotsExpected: notOptedOut.filter((p) =>
      ["requested", "mailed", "carrier_delivered", "notice_received"].includes(p.ballotStatus),
    ).length,
    plansComplete: people.filter((p) => p.planStatus === "complete").length,
    unresolved: notOptedOut.filter(
      (p) =>
        p.contactStatus === "follow_up" ||
        p.ballotStatus === "request_needed" ||
        p.ballotStatus === "missing",
    ).length,
    optedOut: people.filter((p) => p.contactStatus === "opted_out").length,
  };

  const classYears = [...new Set(active.map((p) => p.classYear).filter(Boolean))].sort();
  const states = [...new Set(active.map(effectiveState).filter(Boolean))].sort();
  const organizers = staffList.filter((s) => s.role !== "field");
  const captains = staffList.filter((s) => s.role === "captain" || s.role === "admin");

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = deadlines.filter((d) => d.date >= today);
  const affectedCount = (d: Deadline) =>
    d.jurisdiction === "US"
      ? notOptedOut.length
      : notOptedOut.filter((p) => effectiveState(p) === d.jurisdiction).length;

  async function submitDeadline() {
    setDeadlineError(null);
    const res = await fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deadlineForm),
    });
    if (!res.ok) {
      setDeadlineError(((await res.json()) as { error: string }).error);
      return;
    }
    setDeadlineForm(EMPTY_DEADLINE);
    setAddingDeadline(false);
    loadExtras();
  }

  const drillUnit = filters.unit ? UNITS.find((u) => u.id === filters.unit) : null;
  const rooms = drillUnit
    ? [...people]
        .sort(
          (a, b) =>
            a.building.localeCompare(b.building) ||
            a.entryway.localeCompare(b.entryway) ||
            a.room.localeCompare(b.room, undefined, { numeric: true }),
        )
        .reduce((map, p) => {
          const key = `${p.building} ${p.entryway} ${p.room}`.trim();
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(p);
          return map;
        }, new Map<string, Person[]>())
    : null;

  const selectClass =
    "bg-surface-1 border-b border-ink px-2 py-2 text-[12px] focus:outline-none";

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">
        {me.role === "captain" ? `${me.scope ?? "Team"} overview` : "Campaign overview"}
      </h1>

      <div className="flex flex-wrap gap-2 mt-4">
        <select
          value={filters.unit}
          onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
          className={selectClass}
        >
          <option value="">All Houses/Yards</option>
          {UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={filters.organizer}
          onChange={(e) => setFilters({ ...filters, organizer: e.target.value })}
          className={selectClass}
        >
          <option value="">All organizers</option>
          {organizers.map((s) => (
            <option key={s.email} value={s.email}>
              {s.displayName || s.email}
            </option>
          ))}
        </select>
        <select
          value={filters.captain}
          onChange={(e) => setFilters({ ...filters, captain: e.target.value })}
          className={selectClass}
        >
          <option value="">All captains</option>
          {captains.map((s) => (
            <option key={s.email} value={s.email}>
              {s.displayName || s.email}
            </option>
          ))}
        </select>
        <select
          value={filters.classYear}
          onChange={(e) => setFilters({ ...filters, classYear: e.target.value })}
          className={selectClass}
        >
          <option value="">All class years</option>
          {classYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          className={selectClass}
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.registration}
          onChange={(e) => setFilters({ ...filters, registration: e.target.value })}
          className={selectClass}
        >
          <option value="">Any registration</option>
          {Object.entries(REGISTRATION_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filters.ballot}
          onChange={(e) => setFilters({ ...filters, ballot: e.target.value })}
          className={selectClass}
        >
          <option value="">Any ballot status</option>
          {Object.entries(BALLOT_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-[12px] text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline mt-4">
        <StatTile label="Students" value={stats.total} />
        <StatTile
          label="Assigned"
          value={stats.assigned}
          hint={`${stats.unassigned} unassigned`}
        />
        <StatTile
          label="Contacted"
          value={stats.contacted}
          hint={
            stats.total ? `${Math.round((stats.contacted / stats.total) * 100)}%` : undefined
          }
        />
        <StatTile label="Opted out" value={stats.optedOut} />
        <StatTile
          label="Registration confirmed"
          value={stats.regConfirmed}
          hint={`${stats.regUnresolved} unresolved`}
        />
        <StatTile
          label="Ballot requests needed"
          value={stats.ballotRequestsNeeded}
          hint={`${stats.ballotsExpected} ballots expected`}
        />
        <StatTile label="Plans complete" value={stats.plansComplete} />
        <StatTile label="Unresolved issues" value={stats.unresolved} />
      </div>

      {drillUnit && rooms && (
        <>
          <SectionTitle>{drillUnit.name}</SectionTitle>
          <div className="flex flex-wrap gap-6 text-[12px] text-ink-muted mb-3">
            <span>
              Completion:{" "}
              {stats.total
                ? Math.round(
                    (people.filter((p) => p.contactStatus !== "uncontacted").length /
                      stats.total) *
                      100,
                  )
                : 0}
              % reached
            </span>
            <span>
              Organizers:{" "}
              {[...new Set(people.map((p) => p.assignedTo).filter(Boolean))]
                .map(
                  (e) => staffList.find((s) => s.email === e)?.displayName || e,
                )
                .join(", ") || "none assigned"}
            </span>
            <span>{stats.unresolved} outstanding cases</span>
          </div>
          <div className="border border-hairline divide-y divide-hairline max-h-96 overflow-y-auto">
            {[...rooms.entries()].map(([room, members]) => (
              <div key={room} className="px-4 py-2 flex flex-wrap items-center gap-3">
                <span className="w-44 shrink-0 font-semibold text-[12px]">{room}</span>
                {members.map((p) => (
                  <Link
                    key={p.id}
                    href={`/people/${p.id}`}
                    className="flex items-center gap-2 text-[12px] text-primary hover:underline"
                  >
                    {p.firstName} {p.lastName[0]}.
                    <ContactTag s={p.contactStatus} />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Deadlines</SectionTitle>
      <p className="text-ink-subtle text-[12px] -mt-1 mb-3">
        Entered manually from official sources — Voteable never generates
        election dates. Counts reflect students whose plan follows that state.
      </p>
      {upcoming.length === 0 ? (
        <p className="text-ink-muted">No upcoming deadlines entered.</p>
      ) : (
        <div className="border border-hairline divide-y divide-hairline max-w-3xl">
          {upcoming.map((d) => (
            <div key={d.id} className="px-4 py-2.5 flex flex-wrap items-center gap-3">
              <span className="w-24 font-semibold">{d.date}</span>
              <span className="w-10">{d.jurisdiction}</span>
              <span className="flex-1 min-w-40">
                {DEADLINE_TYPE_LABEL[d.type]}
                {d.note && <span className="text-ink-subtle"> · {d.note}</span>}
              </span>
              <span className="text-ink-muted text-[12px]">
                {affectedCount(d)} students
              </span>
              <a
                href={d.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-[12px] hover:underline"
              >
                source
              </a>
              {me.role === "admin" && (
                <button
                  onClick={async () => {
                    await fetch("/api/deadlines", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: d.id }),
                    });
                    loadExtras();
                  }}
                  className="text-error text-[12px] hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {me.role === "admin" && !addingDeadline && (
        <button
          onClick={() => setAddingDeadline(true)}
          className="mt-3 border border-hairline px-4 py-2 hover:border-primary hover:text-primary"
        >
          Add deadline
        </button>
      )}
      {addingDeadline && (
        <div className="border border-hairline bg-surface-1 p-4 mt-3 max-w-3xl">
          <div className="grid md:grid-cols-4 gap-3">
            <input
              value={deadlineForm.jurisdiction}
              onChange={(e) =>
                setDeadlineForm({
                  ...deadlineForm,
                  jurisdiction: e.target.value.toUpperCase().slice(0, 2),
                })
              }
              placeholder="State (MA) or US"
              className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
            <select
              value={deadlineForm.type}
              onChange={(e) =>
                setDeadlineForm({ ...deadlineForm, type: e.target.value as DeadlineType })
              }
              className="bg-canvas border-b border-ink px-3 py-2.5"
            >
              {Object.entries(DEADLINE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={deadlineForm.date}
              onChange={(e) => setDeadlineForm({ ...deadlineForm, date: e.target.value })}
              className="bg-canvas border-b border-ink px-3 py-2.5"
            />
            <input
              value={deadlineForm.sourceUrl}
              onChange={(e) =>
                setDeadlineForm({ ...deadlineForm, sourceUrl: e.target.value })
              }
              placeholder="Official source URL"
              className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </div>
          {deadlineError && <p className="text-error text-[12px] mt-2">{deadlineError}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={submitDeadline}
              disabled={!deadlineForm.jurisdiction || !deadlineForm.date || !deadlineForm.sourceUrl}
              className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
            >
              Save
            </button>
            <button
              onClick={() => setAddingDeadline(false)}
              className="px-4 py-2 text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <SectionTitle>Needs attention</SectionTitle>
          {(() => {
            const needsAttention = [
              ...people
                .filter((p) => p.contactStatus === "follow_up")
                .map((p) => ({ p, why: "Follow-up requested" })),
              ...notOptedOut
                .filter((p) => p.ballotStatus === "missing")
                .map((p) => ({ p, why: "Ballot missing" })),
              ...notOptedOut
                .filter((p) => p.ballotStatus === "request_needed")
                .map((p) => ({ p, why: "Ballot request needed" })),
              ...notOptedOut
                .filter((p) =>
                  ["needs_registration", "lookup_required"].includes(p.registrationStatus),
                )
                .map((p) => ({ p, why: "Registration unresolved" })),
            ];
            return needsAttention.length === 0 ? (
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
            );
          })()}
        </div>

        <div>
          <SectionTitle>Home states</SectionTitle>
          <ul className="space-y-2">
            {(() => {
              const byState = new Map<string, number>();
              for (const p of people) {
                const s = effectiveState(p);
                if (s) byState.set(s, (byState.get(s) ?? 0) + 1);
              }
              const sorted = [...byState.entries()].sort((a, b) => b[1] - a[1]);
              const max = sorted[0]?.[1] ?? 1;
              return sorted.map(([code, n]) => (
                <li key={code} className="flex items-center gap-3">
                  <span className="w-8 text-ink-muted text-[12px]">{code}</span>
                  <span
                    className="h-4 bg-primary"
                    style={{ width: `${(n / max) * 70}%`, minWidth: 4 }}
                  />
                  <span className="text-[12px] text-ink-muted">
                    {n} · {JURISDICTIONS[code]?.name ?? code}
                  </span>
                </li>
              ));
            })()}
          </ul>
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

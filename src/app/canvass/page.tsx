"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Person, ContactOutcome, OUTCOME_LABEL, Turf } from "@/lib/types";
import { ContactTag } from "@/components/ui";
import { VotePlan } from "@/components/vote-plan";
import { RegistrationCheck } from "@/components/registration-check";
import { VoterQr } from "@/components/voter-qr";

const QUICK: ContactOutcome[] = [
  "no_answer",
  "contacted",
  "come_back",
  "wrong_room",
  "moved",
  "already_completed",
  "opted_out",
  "needs_help",
];

interface Door {
  key: string;
  building: string;
  room: string;
  people: Person[];
  done: boolean;
}

/** Post-"Contacted" mini-script: the four questions, one screen. */
function ContactedSheet({
  person: p,
  onHandOff,
  onSendPlan,
  onClose,
}: {
  person: Person;
  onHandOff: () => void;
  onSendPlan: () => void;
  onClose: () => void;
}) {
  const { update } = useStore();
  return (
    <div className="fixed inset-0 z-40 bg-ink/40 flex items-end md:items-center justify-center">
      <div className="bg-canvas w-full md:max-w-md max-h-[90vh] overflow-y-auto p-5 border-t md:border border-hairline">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[20px]">
            {p.firstName} {p.lastName[0]}. — contacted
          </h2>
          <button onClick={onClose} className="text-ink-muted px-2 py-1">
            Done
          </button>
        </div>

        <div className="mt-4">
          <span className="text-[12px] text-ink-muted">Where do they plan to vote?</span>
          <div className="flex gap-px bg-hairline border border-hairline mt-1">
            {(
              [
                { key: "home", label: `Home (${p.homeState || "?"})` },
                { key: "ma", label: "Massachusetts" },
              ] as const
            ).map((j) => (
              <button
                key={j.key}
                disabled={j.key === "home" && !p.homeState}
                onClick={() => update(p.id, { jurisdiction: j.key })}
                className={`flex-1 px-3 py-3 disabled:text-ink-subtle ${
                  p.jurisdiction === j.key
                    ? "bg-ink text-white"
                    : "bg-canvas text-ink-muted"
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="text-[12px] text-ink-muted">By mail or in person?</span>
          <div className="flex gap-px bg-hairline border border-hairline mt-1">
            {(
              [
                { key: "mail", label: "By mail" },
                { key: "in_person", label: "In person" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() =>
                  update(p.id, {
                    method: m.key,
                    ...(p.planStatus === "none" ? { planStatus: "started" as const } : {}),
                  })
                }
                className={`flex-1 px-3 py-3 ${
                  p.method === m.key ? "bg-ink text-white" : "bg-canvas text-ink-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={onHandOff}
            className="w-full bg-primary text-white px-4 py-3 hover:bg-primary-hover"
          >
            Check registration — hand phone to student
          </button>
          <button
            onClick={onSendPlan}
            className="w-full border border-primary text-primary px-4 py-3 hover:bg-primary hover:text-white"
          >
            Send their voting-plan link
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Privacy handoff: full-screen voter view with organizer chrome hidden.
 * The student checks registration and their plan, then hands back.
 */
function HandoffOverlay({ person: p, onDone }: { person: Person; onDone: () => void }) {
  const { update, refresh } = useStore();
  return (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <p className="text-[12px] text-ink-muted border border-hairline bg-surface-1 px-3 py-2">
          This screen is for {p.firstName}. Your organizer can&apos;t see what you
          enter until you hand the phone back.
        </p>
        <h1 className="text-[28px] font-light mt-4">
          Hi {p.firstName} — check your registration
        </h1>
        <div className="mt-4">
          <RegistrationCheck
            jurisdiction={p.jurisdiction === "ma" ? "MA" : p.homeState}
            status={p.registrationStatus}
            onResult={async (result) => {
              await fetch("/api/registration-checks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ personId: p.id, result }),
              });
              refresh();
            }}
          />
        </div>
        <h2 className="text-[20px] mt-8 mb-3">Your voting plan</h2>
        <VotePlan
          person={p}
          onUpdate={(patch) =>
            update(p.id, {
              ...patch,
              ...(p.planStatus === "none" && (patch.jurisdiction || patch.method)
                ? { planStatus: "started" as const }
                : {}),
            })
          }
        />
        <div className="sticky bottom-4 mt-8">
          <button
            onClick={onDone}
            className="w-full bg-ink text-white px-4 py-3.5 hover:bg-primary"
          >
            I&apos;m done — hand back to the organizer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CanvassPage() {
  const { me, people, ready, pendingSync, recordOutcome, undoOutcome } = useStore();
  const [lastAction, setLastAction] = useState<{
    personId: string;
    name: string;
    outcome: ContactOutcome;
  } | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [handoffFor, setHandoffFor] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [turfs, setTurfs] = useState<Turf[]>([]);

  useEffect(() => {
    fetch("/api/turfs").then(async (r) => {
       
      if (r.ok) setTurfs(((await r.json()) as { turfs: Turf[] }).turfs);
    });
  }, []);

  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction(null), 6000);
    return () => clearTimeout(t);
  }, [lastAction]);

  const buildings = useMemo(() => {
    const doors = new Map<string, Door>();
    for (const p of people) {
      if (p.contactStatus === "opted_out" || !p.active) continue;
      const key = `${p.building}|${p.room}`;
      if (!doors.has(key))
        doors.set(key, { key, building: p.building, room: p.room, people: [], done: true });
      const d = doors.get(key)!;
      d.people.push(p);
      if (p.contactStatus === "uncontacted" || p.contactStatus === "follow_up")
        d.done = false;
    }
    const byBuilding = new Map<string, Door[]>();
    for (const d of doors.values()) {
      if (!byBuilding.has(d.building)) byBuilding.set(d.building, []);
      byBuilding.get(d.building)!.push(d);
    }
    for (const list of byBuilding.values())
      list.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
    return [...byBuilding.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [people]);

  if (!ready) return null;

  const myTurfs =
    me?.role === "organizer"
      ? turfs.filter((t) => t.organizerEmail === me.email)
      : turfs;
  const allDoors = buildings.flatMap(([, ds]) => ds);
  const remaining = allDoors.filter((d) => !d.done).length;
  const followUpsDue = people.filter(
    (p) => p.active && p.contactStatus === "follow_up",
  ).length;

  const sheetPerson = sheetFor ? people.find((p) => p.id === sheetFor) : null;
  const handoffPerson = handoffFor ? people.find((p) => p.id === handoffFor) : null;

  function tap(p: Person, outcome: ContactOutcome) {
    recordOutcome(p.id, outcome);
    setLastAction({ personId: p.id, name: `${p.firstName} ${p.lastName[0]}.`, outcome });
    if (outcome === "contacted") setSheetFor(p.id);
  }

  return (
    <div>
      <div className="sticky top-12 z-10 bg-canvas border-b border-hairline -mx-4 md:-mx-8 px-4 md:px-8 py-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[24px] font-light">Canvass</h1>
          <span className="text-ink-muted text-[12px]">
            {myTurfs.length > 0 && (
              <>Turf: {myTurfs.map((t) => t.name).join(", ")} · </>
            )}
            {allDoors.length - remaining}/{allDoors.length} doors done · {followUpsDue}{" "}
            follow-ups due
          </span>
          {pendingSync > 0 && (
            <span className="text-[12px] bg-warning/20 px-2 py-0.5 ml-auto">
              {pendingSync} waiting to sync
            </span>
          )}
        </div>
      </div>

      {allDoors.length === 0 && (
        <p className="text-ink-muted mt-6">
          No doors to knock — ask your captain for an assignment.
        </p>
      )}

      {buildings.map(([building, doors]) => (
        <section key={building} className="mt-6">
          <h2 className="text-[20px] border-b border-hairline pb-2">
            {building}
            <span className="text-ink-subtle text-[12px] ml-2">
              {doors.filter((d) => !d.done).length} remaining
            </span>
          </h2>
          <div className="divide-y divide-hairline">
            {doors.map((door) => (
              <div key={door.key} className={`py-3 ${door.done ? "opacity-50" : ""}`}>
                <div className="font-semibold">{door.room}</div>
                {door.people.map((p) => (
                  <div key={p.id} className="mt-2">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/people/${p.id}`}
                        className="text-primary hover:underline"
                      >
                        {p.firstName} {p.lastName[0]}.
                      </Link>
                      <ContactTag s={p.contactStatus} />
                    </div>
                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-1.5 mt-2">
                      {QUICK.map((o) => (
                        <button
                          key={o}
                          onClick={() => tap(p, o)}
                          className="border border-hairline px-2.5 py-2.5 text-[12px] hover:border-primary hover:text-primary active:bg-primary active:text-white"
                        >
                          {OUTCOME_LABEL[o]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}

      {sheetPerson && !handoffFor && !qrFor && (
        <ContactedSheet
          person={sheetPerson}
          onHandOff={() => setHandoffFor(sheetPerson.id)}
          onSendPlan={() => setQrFor(sheetPerson.id)}
          onClose={() => setSheetFor(null)}
        />
      )}

      {handoffPerson && (
        <HandoffOverlay
          person={handoffPerson}
          onDone={() => {
            setHandoffFor(null);
            setSheetFor(null);
          }}
        />
      )}

      {qrFor && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4">
          <VoterQr
            personId={qrFor}
            doneLabel="Back to canvassing"
            onDone={() => {
              setQrFor(null);
              setSheetFor(null);
            }}
          />
        </div>
      )}

      {lastAction && !sheetFor && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-3 flex items-center gap-4 z-30">
          <span>
            {lastAction.name}: {OUTCOME_LABEL[lastAction.outcome]}
          </span>
          <button
            onClick={() => {
              undoOutcome(lastAction.personId);
              setLastAction(null);
            }}
            className="text-[#78a9ff] hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

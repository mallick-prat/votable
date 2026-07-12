"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Person, ContactOutcome, OUTCOME_LABEL } from "@/lib/types";
import { ContactTag } from "@/components/ui";

const QUICK: ContactOutcome[] = [
  "no_answer",
  "contacted",
  "come_back",
  "wrong_room",
  "moved",
  "opted_out",
];

interface Door {
  key: string;
  building: string;
  room: string;
  people: Person[];
  done: boolean;
}

export default function CanvassPage() {
  const { people, ready, recordOutcome, undoOutcome } = useStore();
  const [lastAction, setLastAction] = useState<{
    personId: string;
    name: string;
    outcome: ContactOutcome;
  } | null>(null);

  // Auto-dismiss the undo bar
  useEffect(() => {
    if (!lastAction) return;
    const t = setTimeout(() => setLastAction(null), 6000);
    return () => clearTimeout(t);
  }, [lastAction]);

  const buildings = useMemo(() => {
    const doors = new Map<string, Door>();
    for (const p of people) {
      if (p.contactStatus === "opted_out") continue;
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

  const allDoors = buildings.flatMap(([, ds]) => ds);
  const remaining = allDoors.filter((d) => !d.done).length;

  function tap(p: Person, outcome: ContactOutcome) {
    recordOutcome(p.id, outcome);
    setLastAction({ personId: p.id, name: `${p.firstName} ${p.lastName[0]}.`, outcome });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mt-2">
        <h1 className="text-[32px] font-light">Canvass</h1>
        <span className="text-ink-muted">
          {allDoors.length - remaining}/{allDoors.length} doors done
        </span>
      </div>

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
                  <div
                    key={p.id}
                    className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2"
                  >
                    <Link
                      href={`/people/${p.id}`}
                      className="w-32 shrink-0 text-primary hover:underline"
                    >
                      {p.firstName} {p.lastName[0]}.
                    </Link>
                    <ContactTag s={p.contactStatus} />
                    <div className="flex flex-wrap gap-1">
                      {QUICK.map((o) => (
                        <button
                          key={o}
                          onClick={() => tap(p, o)}
                          className="border border-hairline px-2.5 py-1.5 text-[12px] hover:border-primary hover:text-primary"
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

      {lastAction && (
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

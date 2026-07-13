"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Person, POPULATION_LABEL, Population } from "@/lib/types";
import { UNITS } from "@/lib/units";

/** Admin-only editor: identity, residence (move), group, deactivate, merge. */
export function AdminDetails({
  person: p,
  people,
  onUpdate,
}: {
  person: Person;
  people: Person[];
  onUpdate: (patch: Partial<Person>) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    firstName: p.firstName,
    lastName: p.lastName,
    classYear: p.classYear,
    unitId: p.unitId ?? "",
    building: p.building,
    entryway: p.entryway,
    room: p.room,
    population: p.population,
  });
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);

  const dirty =
    draft.firstName !== p.firstName ||
    draft.lastName !== p.lastName ||
    draft.classYear !== p.classYear ||
    draft.unitId !== (p.unitId ?? "") ||
    draft.building !== p.building ||
    draft.entryway !== p.entryway ||
    draft.room !== p.room ||
    draft.population !== p.population;

  function save() {
    const unit = UNITS.find((u) => u.id === draft.unitId) ?? null;
    onUpdate({
      firstName: draft.firstName,
      lastName: draft.lastName,
      classYear: draft.classYear,
      unitId: unit?.id ?? null,
      house: unit?.type === "house" ? unit.name.replace(" House", "") : null,
      building: draft.building,
      entryway: draft.entryway,
      room: draft.room,
      suiteRaw: [draft.building, draft.entryway, draft.room]
        .filter((s) => s && s !== "—")
        .join(" "),
      population: draft.population as Population,
    });
  }

  async function merge() {
    setMergeError(null);
    const target = people.find(
      (x) => x.email === mergeTarget.trim().toLowerCase() && x.id !== p.id,
    );
    if (!target) {
      setMergeError("No other person found with that email.");
      return;
    }
    const res = await fetch(`/api/people/${p.id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: target.id }),
    });
    if (!res.ok) {
      setMergeError(((await res.json()) as { error: string }).error);
      return;
    }
    router.push(`/people/${target.id}`);
    window.location.reload();
  }

  return (
    <div className="border border-hairline p-4 max-w-3xl">
      <div className="grid md:grid-cols-4 gap-3">
        {(
          [
            ["firstName", "First name"],
            ["lastName", "Last name"],
            ["classYear", "Class year"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-[12px] text-ink-muted">{label}</span>
            <input
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[12px] text-ink-muted">House / Yard</span>
          <select
            value={draft.unitId}
            onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}
            className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2"
          >
            <option value="">None</option>
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["building", "Building"],
            ["entryway", "Entryway"],
            ["room", "Room / suite"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-[12px] text-ink-muted">{label}</span>
            <input
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[12px] text-ink-muted">Group</span>
          <select
            value={draft.population}
            onChange={(e) =>
              setDraft({ ...draft, population: e.target.value as Population })
            }
            className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2"
          >
            {Object.entries(POPULATION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={!dirty}
          className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
        >
          Save details
        </button>
        <button
          onClick={() => onUpdate({ active: !p.active })}
          className={`px-4 py-2 border ${
            p.active
              ? "border-error text-error hover:bg-error hover:text-white"
              : "border-hairline text-ink-muted hover:border-primary hover:text-primary"
          }`}
        >
          {p.active ? "Deactivate" : "Reactivate"}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-hairline">
        <span className="text-[12px] text-ink-muted">
          Merge this record into another person (moves contact history, then
          removes this record)
        </span>
        <div className="flex flex-wrap gap-2 mt-1">
          <input
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            placeholder="Target person's email"
            className="bg-surface-1 border-b border-ink px-3 py-2 w-72 focus:outline-none focus:border-b-2 focus:border-b-primary"
          />
          <button
            onClick={merge}
            disabled={!mergeTarget.includes("@")}
            className="border border-error text-error px-4 py-2 hover:bg-error hover:text-white disabled:border-hairline disabled:text-ink-subtle"
          >
            Merge
          </button>
        </div>
        {mergeError && <p className="text-error text-[12px] mt-2">{mergeError}</p>}
      </div>
    </div>
  );
}

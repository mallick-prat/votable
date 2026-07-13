"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ContactTag, RegistrationTag, BallotTag, PlanTag, Tag } from "@/components/ui";
import { UNITS } from "@/lib/units";
import { POPULATION_LABEL, type Population } from "@/lib/types";

type Filter = "all" | "uncontacted" | "follow_up" | "reg_unresolved" | "ballot_open" | "inactive";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "uncontacted", label: "Uncontacted" },
  { key: "follow_up", label: "Follow-ups" },
  { key: "reg_unresolved", label: "Registration unresolved" },
  { key: "ballot_open", label: "Ballot open" },
  { key: "inactive", label: "Inactive" },
];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  classYear: "",
  unit: "",
  building: "",
  entryway: "",
  room: "",
  population: "college" as Population,
};

export default function PeoplePage() {
  const { me, people, ready } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
      .filter((p) => (filter === "inactive" ? !p.active : p.active))
      .filter((p) => {
        if (filter === "uncontacted") return p.contactStatus === "uncontacted";
        if (filter === "follow_up") return p.contactStatus === "follow_up";
        if (filter === "reg_unresolved")
          return (
            p.contactStatus !== "opted_out" &&
            ["unknown", "lookup_required", "needs_registration"].includes(
              p.registrationStatus,
            )
          );
        if (filter === "ballot_open")
          return ["request_needed", "requested"].includes(p.ballotStatus);
        return true;
      })
      .filter(
        (p) =>
          !needle ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle) ||
          p.email.includes(needle) ||
          p.building.toLowerCase().includes(needle) ||
          (p.unitId ?? "").includes(needle) ||
          p.homeState.toLowerCase() === needle,
      )
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [people, q, filter]);

  if (!ready) return null;

  async function addPerson() {
    setAddError(null);
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setAddError(((await res.json()) as { error: string }).error);
      return;
    }
    setForm(EMPTY_FORM);
    setAdding(false);
    window.location.reload();
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mt-2">
        <h1 className="text-[32px] font-light">People</h1>
        {me?.role === "admin" && (
          <div className="flex gap-2">
            <button
              onClick={() => setAdding((v) => !v)}
              className="border border-hairline px-4 py-2 hover:border-primary hover:text-primary"
            >
              {adding ? "Cancel" : "Add person"}
            </button>
            <Link
              href="/import"
              className="border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-white"
            >
              Import roster
            </Link>
          </div>
        )}
      </div>

      {adding && (
        <div className="border border-hairline bg-surface-1 p-4 mt-4 max-w-3xl">
          <div className="grid md:grid-cols-3 gap-3">
            {(
              [
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Harvard email"],
                ["classYear", "Class year"],
                ["building", "Building"],
                ["entryway", "Entryway"],
                ["room", "Room"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={label}
                className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
              />
            ))}
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="bg-canvas border-b border-ink px-3 py-2.5"
            >
              <option value="">House / Yard…</option>
              {UNITS.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={form.population}
              onChange={(e) =>
                setForm({ ...form, population: e.target.value as Population })
              }
              className="bg-canvas border-b border-ink px-3 py-2.5"
            >
              {Object.entries(POPULATION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {addError && <p className="text-error text-[12px] mt-2">{addError}</p>}
          <button
            onClick={addPerson}
            disabled={!form.email.includes("@") || !form.firstName || !form.lastName}
            className="mt-3 bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, building, or state"
          className="bg-surface-1 border-b border-ink px-4 py-2.5 w-full md:w-80 focus:outline-none focus:border-b-2 focus:border-b-primary"
        />
        <div className="flex flex-wrap gap-px bg-hairline border border-hairline">
          {FILTERS.filter((f) => f.key !== "inactive" || me?.role === "admin").map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 text-[12px] ${
                filter === f.key
                  ? "bg-ink text-white"
                  : "bg-canvas text-ink-muted hover:bg-surface-1"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-ink-subtle text-[12px] ml-auto">{shown.length} shown</span>
      </div>

      <div className="mt-4 border border-hairline overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-1 text-[12px] text-ink-muted">
              <th className="px-4 py-2 font-normal">Name</th>
              <th className="px-4 py-2 font-normal">Residence</th>
              <th className="px-4 py-2 font-normal">State</th>
              <th className="px-4 py-2 font-normal">Contact</th>
              <th className="px-4 py-2 font-normal">Registration</th>
              <th className="px-4 py-2 font-normal">Ballot</th>
              <th className="px-4 py-2 font-normal">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {shown.map((p) => (
              <tr key={p.id} className="hover:bg-surface-1">
                <td className="px-4 py-2.5">
                  <Link href={`/people/${p.id}`} className="text-primary hover:underline">
                    {p.lastName}, {p.firstName}
                  </Link>
                  {p.population !== "college" && (
                    <span className="ml-2">
                      <Tag>{POPULATION_LABEL[p.population]}</Tag>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {p.building} {p.entryway && `${p.entryway} `}
                  {p.room}
                </td>
                <td className="px-4 py-2.5">{p.homeState}</td>
                <td className="px-4 py-2.5"><ContactTag s={p.contactStatus} /></td>
                <td className="px-4 py-2.5"><RegistrationTag s={p.registrationStatus} /></td>
                <td className="px-4 py-2.5"><BallotTag s={p.ballotStatus} /></td>
                <td className="px-4 py-2.5"><PlanTag s={p.planStatus} /></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No people match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

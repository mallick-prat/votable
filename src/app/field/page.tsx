"use client";

import { useState } from "react";
import { RegistrationCheck } from "@/components/registration-check";
import { VoterQr } from "@/components/voter-qr";
import { RegistrationTag } from "@/components/ui";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import type { RegistrationStatus, VotingMethod } from "@/lib/types";

interface Result {
  id: string;
  name: string;
  classYear: string;
  contactStatus: string;
  homeState: string;
  jurisdiction: string | null;
  registrationStatus: string;
}

const AFFILIATIONS = [
  { value: "college", label: "Harvard College" },
  { value: "affiliate", label: "Other Harvard affiliate" },
  { value: "visiting", label: "Visiting student" },
  { value: "off_campus", label: "Off-campus" },
] as const;

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  state: "",
  population: "college",
};

/** One student's guided flow: registration → method → plan → send. */
function FieldFlow({ person, onDone }: { person: Result; onDone: () => void }) {
  const [reg, setReg] = useState(person.registrationStatus as RegistrationStatus);
  const [method, setMethod] = useState<VotingMethod | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const jurisdiction =
    person.jurisdiction === "ma" ? "MA" : person.homeState;

  if (showPlan) {
    return <VoterQr personId={person.id} onDone={onDone} />;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[24px] font-light">{person.name}</h2>
        <span className="text-ink-muted text-[12px]">
          {person.classYear || "—"} · voting in {jurisdiction || "?"}
          {jurisdiction && JURISDICTIONS[jurisdiction]
            ? ` (${JURISDICTIONS[jurisdiction].name})`
            : ""}
        </span>
        <RegistrationTag s={reg} />
      </div>

      <h3 className="text-[16px] font-semibold mt-5 mb-2">1 · Check registration</h3>
      <RegistrationCheck
        jurisdiction={jurisdiction}
        status={reg}
        onResult={async (result) => {
          const res = await fetch("/api/registration-checks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personId: person.id, result }),
          });
          if (res.ok) {
            const map: Record<string, RegistrationStatus> = {
              confirmed: "voter_confirmed",
              pending: "pending",
              no_match: "no_match",
              needs_registration: "needs_registration",
              manual_help: "manual_help",
            };
            setReg(map[result] ?? reg);
          }
        }}
      />

      <h3 className="text-[16px] font-semibold mt-5 mb-2">2 · How will they vote?</h3>
      <div className="flex gap-px bg-hairline border border-hairline max-w-sm">
        {(
          [
            { key: "mail", label: "By mail" },
            { key: "in_person", label: "In person" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            onClick={async () => {
              setMethod(m.key);
              await fetch(`/api/people/${person.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method: m.key, planStatus: "started" }),
              });
            }}
            className={`flex-1 px-3 py-3 ${
              method === m.key ? "bg-ink text-white" : "bg-canvas text-ink-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <h3 className="text-[16px] font-semibold mt-5 mb-2">3 · Send their voting plan</h3>
      <p className="text-ink-muted text-[12px] mb-2">
        Opens their private plan link as a QR code, with email and text options.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setShowPlan(true)}
          className="bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
        >
          Create plan link
        </button>
        <button onClick={onDone} className="px-4 py-2.5 text-ink-muted hover:text-ink">
          Done — next student
        </button>
      </div>
    </div>
  );
}

export default function FieldPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [active, setActive] = useState<Result | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  // Reset everything between students so no one's info lingers on the device.
  function reset() {
    setQ("");
    setResults(null);
    setActive(null);
    setCreating(false);
    setForm({ ...EMPTY_FORM });
    setError(null);
  }

  async function search() {
    setError(null);
    const res = await fetch("/api/field/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) {
      setError("Enter at least 3 characters.");
      return;
    }
    setResults(((await res.json()) as { results: Result[] }).results);
  }

  async function start(person: Result) {
    await fetch(`/api/people/${person.id}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "contacted" }),
    });
    setActive(person);
  }

  async function create() {
    setError(null);
    const res = await fetch("/api/field/search", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error: string }).error);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    await start({
      id,
      name: `${form.firstName} ${form.lastName}`,
      classYear: "",
      contactStatus: "contacted",
      homeState: form.state.toUpperCase(),
      jurisdiction: form.state.toUpperCase() === "MA" ? "ma" : form.state ? "home" : null,
      registrationStatus: "unknown",
    });
  }

  if (active) {
    return (
      <div>
        <h1 className="text-[32px] font-light mt-2">Field mode</h1>
        <div className="mt-6">
          <FieldFlow person={active} onDone={reset} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Field mode</h1>
      <p className="text-ink-muted mt-1">
        Find a student by name or Harvard email, or add a walk-up. The flow:
        check registration, pick a method, send their plan.
      </p>

      {!creating && (
        <>
          <div className="flex gap-2 mt-6 max-w-xl">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Name or email"
              className="flex-1 bg-surface-1 border-b border-ink px-4 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
            <button
              onClick={search}
              className="bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
            >
              Search
            </button>
          </div>
          {error && <p className="text-error text-[12px] mt-2">{error}</p>}

          {results && (
            <ul className="border-t border-hairline mt-4 max-w-xl">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="border-b border-hairline flex items-center justify-between gap-3 py-3"
                >
                  <span>
                    {r.name}
                    <span className="text-ink-subtle"> · {r.classYear || "—"}</span>
                  </span>
                  <button
                    onClick={() => start(r)}
                    className="border border-primary text-primary px-3 py-1.5 text-[12px] hover:bg-primary hover:text-white"
                  >
                    Start
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="py-3 text-ink-muted">No match found.</li>
              )}
            </ul>
          )}

          <button
            onClick={() => setCreating(true)}
            className="mt-6 border border-hairline px-4 py-2.5 hover:border-primary hover:text-primary"
          >
            Add a walk-up student
          </button>
        </>
      )}

      {creating && (
        <div className="mt-6 max-w-sm space-y-3">
          {(
            [
              ["firstName", "First name"],
              ["lastName", "Last name"],
              ["email", "Email"],
            ] as const
          ).map(([f, label]) => (
            <input
              key={f}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              placeholder={label}
              className="block w-full bg-surface-1 border-b border-ink px-4 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          ))}
          <select
            value={form.population}
            onChange={(e) => setForm({ ...form, population: e.target.value })}
            className="block w-full bg-surface-1 border-b border-ink px-4 py-2.5"
          >
            {AFFILIATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="block w-full bg-surface-1 border-b border-ink px-4 py-2.5"
          >
            <option value="">Where do they plan to vote?</option>
            {Object.values(JURISDICTIONS).map((j) => (
              <option key={j.code} value={j.code}>
                {j.name}
              </option>
            ))}
          </select>
          {error && <p className="text-error text-[12px]">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={!form.email.includes("@") || !form.firstName || !form.lastName}
              className="bg-primary text-white px-6 py-2.5 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
            >
              Create and start
            </button>
            <button onClick={reset} className="px-4 py-2.5 text-ink-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

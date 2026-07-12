"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ContactTag, RegistrationTag, BallotTag, PlanTag } from "@/components/ui";

type Filter = "all" | "uncontacted" | "follow_up" | "reg_unresolved" | "ballot_open";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "uncontacted", label: "Uncontacted" },
  { key: "follow_up", label: "Follow-ups" },
  { key: "reg_unresolved", label: "Registration unresolved" },
  { key: "ballot_open", label: "Ballot open" },
];

export default function PeoplePage() {
  const { people, ready, importRoster } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
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
          p.homeState.toLowerCase() === needle,
      )
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [people, q, filter]);

  if (!ready) return null;

  async function runImport() {
    setImportResult("Importing…");
    const res = await importRoster(importText);
    setImportResult(
      `${res.added} added, ${res.skipped} duplicates skipped` +
        (res.errors.length ? `, ${res.errors.length} rows with errors` : ""),
    );
    if (res.added > 0) setImportText("");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mt-2">
        <h1 className="text-[32px] font-light">People</h1>
        <button
          onClick={() => {
            setImporting((v) => !v);
            setImportResult(null);
          }}
          className="border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-white"
        >
          {importing ? "Close import" : "Import roster"}
        </button>
      </div>

      {importing && (
        <div className="border border-hairline bg-surface-1 p-4 mt-4">
          <p className="text-ink-muted mb-2">
            Paste rows from the roster spreadsheet (tab- or comma-separated:
            Class Years, Year, first name, last name, email, suite, phone, city,
            state, zip). Duplicates are matched by email and skipped.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            className="w-full bg-canvas border border-hairline p-3 font-mono text-[12px] focus:outline-none focus:border-b-2 focus:border-b-primary"
            placeholder="Sophomore	2025	Jane	Harvard	jharvard@college.harvard.edu	Adams B-12	617-555-0100	Cambridge	MA	02138"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={runImport}
              disabled={!importText.trim()}
              className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
            >
              Import
            </button>
            {importResult && <span className="text-ink-muted">{importResult}</span>}
          </div>
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
          {FILTERS.map((f) => (
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
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {p.building} {p.room}
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

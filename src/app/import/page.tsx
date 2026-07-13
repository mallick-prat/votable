"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import {
  buildPreview,
  guessField,
  IMPORT_FIELDS,
  parseDelimited,
  type ImportField,
  type PreviewRow,
} from "@/lib/import";
import { Tag } from "@/components/ui";

const DISPOSITION_TONE = {
  new: "good",
  update: "info",
  unchanged: "neutral",
  invalid: "bad",
} as const;

const DISPOSITION_LABEL = {
  new: "New",
  update: "Room change",
  unchanged: "Unchanged",
  invalid: "Invalid",
} as const;

export default function ImportPage() {
  const { me, people, ready } = useStore();
  const [raw, setRaw] = useState("");
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const dataRows = useMemo(
    () => (grid ? (hasHeader ? grid.slice(1) : grid) : []),
    [grid, hasHeader],
  );
  const preview: PreviewRow[] = useMemo(
    () => (grid && mapping.includes("email") ? buildPreview(dataRows, mapping, people) : []),
    [grid, dataRows, mapping, people],
  );

  if (!ready) return null;
  if (me?.role !== "admin") {
    return <p className="mt-8 text-ink-muted">Roster import is for admins.</p>;
  }

  function loadText(text: string) {
    const parsed = parseDelimited(text);
    if (parsed.length === 0) return;
    setGrid(parsed);
    const header = parsed[0];
    const used = new Set<ImportField>();
    setMapping(
      header.map((h) => {
        const guess = guessField(h);
        if (!guess || used.has(guess)) return null;
        used.add(guess);
        return guess;
      }),
    );
    setResult(null);
  }

  async function commit() {
    setCommitting(true);
    const rows = preview
      .filter((r) => r.disposition === "new" || r.disposition === "update")
      .map((r) => r.input);
    const res = await fetch("/api/people/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    setCommitting(false);
    if (!res.ok) {
      setResult("Import failed — check the rows and try again.");
      return;
    }
    const r = (await res.json()) as { added: number; updated: number };
    setResult(`Done: ${r.added} added, ${r.updated} updated.`);
    setGrid(null);
    setRaw("");
    window.location.reload(); // refresh store with new roster
  }

  const counts = {
    new: preview.filter((r) => r.disposition === "new").length,
    update: preview.filter((r) => r.disposition === "update").length,
    unchanged: preview.filter((r) => r.disposition === "unchanged").length,
    invalid: preview.filter((r) => r.disposition === "invalid").length,
    warnings: preview.filter((r) => r.warnings.length > 0).length,
  };

  return (
    <div>
      <Link href="/people" className="text-primary text-[12px] hover:underline">
        ← People
      </Link>
      <h1 className="text-[32px] font-light mt-1">Import roster</h1>

      {!grid && (
        <div className="mt-4 max-w-3xl">
          <p className="text-ink-muted mb-3">
            Upload a CSV file or paste spreadsheet rows. You&apos;ll map columns and
            review every row before anything is saved. Supported columns: name,
            Harvard email, class year, House or Yard, building, entryway,
            suite, room.
          </p>
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) loadText(await f.text());
            }}
            className="block mb-3"
          />
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder="…or paste rows here (first line may be a header)"
            className="w-full bg-surface-1 border border-hairline p-3 font-mono text-[12px] focus:outline-none focus:border-b-2 focus:border-b-primary"
          />
          <button
            onClick={() => loadText(raw)}
            disabled={!raw.trim()}
            className="mt-2 bg-primary text-white px-6 py-2.5 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
          >
            Continue
          </button>
          {result && <p className="mt-3 text-ink-muted">{result}</p>}
        </div>
      )}

      {grid && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />
              First row is a header
            </label>
            <button
              onClick={() => setGrid(null)}
              className="text-ink-muted hover:text-ink text-[12px]"
            >
              Start over
            </button>
          </div>

          <h2 className="text-[20px] mt-6 mb-2">Map columns</h2>
          <div className="overflow-x-auto border border-hairline">
            <table className="text-[12px]">
              <thead>
                <tr className="bg-surface-1">
                  {grid[0].map((h, col) => (
                    <th key={col} className="px-3 py-2 font-normal text-left min-w-36">
                      <div className="text-ink-subtle truncate max-w-40">
                        {hasHeader ? h || `Column ${col + 1}` : `Column ${col + 1}`}
                      </div>
                      <select
                        value={mapping[col] ?? ""}
                        onChange={(e) =>
                          setMapping((m) =>
                            m.map((v, i) =>
                              i === col ? ((e.target.value || null) as ImportField | null) : v,
                            ),
                          )
                        }
                        className="mt-1 w-full bg-canvas border-b border-ink px-2 py-1.5"
                      >
                        <option value="">Ignore</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-t border-hairline">
                    {grid[0].map((_, col) => (
                      <td key={col} className="px-3 py-1.5 text-ink-muted truncate max-w-40">
                        {r[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!mapping.includes("email") && (
            <p className="text-error text-[12px] mt-2">
              Map a column to Harvard email to continue.
            </p>
          )}
          {!mapping.includes("firstName") && !mapping.includes("fullName") && (
            <p className="text-error text-[12px] mt-2">
              Map a name column (Full name, or First + Last).
            </p>
          )}

          {preview.length > 0 && (
            <>
              <h2 className="text-[20px] mt-8 mb-2">
                Preview{" "}
                <span className="text-ink-subtle text-[14px]">
                  {counts.new} new · {counts.update} room changes · {counts.unchanged} unchanged
                  · {counts.invalid} invalid · {counts.warnings} with warnings
                </span>
              </h2>
              <div className="border border-hairline max-h-96 overflow-y-auto divide-y divide-hairline">
                {preview.map((r) => (
                  <div key={r.index} className="px-4 py-2 flex flex-wrap items-center gap-3">
                    <Tag tone={DISPOSITION_TONE[r.disposition]}>
                      {DISPOSITION_LABEL[r.disposition]}
                    </Tag>
                    <span className="min-w-48">
                      {r.input.firstName} {r.input.lastName}
                      <span className="text-ink-subtle text-[12px]"> · {r.input.email}</span>
                    </span>
                    {r.error && <span className="text-error text-[12px]">{r.error}</span>}
                    {r.warnings.map((w) => (
                      <span key={w} className="text-[12px] bg-warning/20 px-2 py-0.5">
                        {w}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-ink-subtle text-[12px] mt-2">
                Invalid rows are skipped — fix them in the file and re-import, or add
                them manually. Warnings import anyway.
              </p>
              <button
                onClick={commit}
                disabled={committing || counts.new + counts.update === 0}
                className="mt-4 bg-primary text-white px-6 py-2.5 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
              >
                {committing
                  ? "Importing…"
                  : `Import ${counts.new} new, update ${counts.update}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

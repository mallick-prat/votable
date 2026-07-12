"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Result {
  id: string;
  name: string;
  classYear: string;
  contactStatus: string;
}

function VoterQr({ personId, onDone }: { personId: string; onDone: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/people/${personId}/link`, { method: "POST" }).then(async (r) => {
      if (!r.ok) return;
      const { url } = (await r.json()) as { url: string };
      setUrl(url);
      setQr(await QRCode.toDataURL(url, { width: 260, margin: 1 }));
    });
  }, [personId]);

  return (
    <div className="border border-hairline p-6 text-center max-w-sm">
      <p className="mb-3">Have the student scan this to open their private voting plan:</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Voter link QR code" className="mx-auto border border-hairline" />
      ) : (
        <p className="text-ink-muted py-16">Generating…</p>
      )}
      {url && (
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="mt-3 text-primary text-[12px] hover:underline"
        >
          Copy link instead
        </button>
      )}
      <div>
        <button
          onClick={onDone}
          className="mt-4 bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
        >
          Done — next student
        </button>
      </div>
    </div>
  );
}

export default function FieldPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  // Reset everything between students so no one's info lingers on the device.
  function reset() {
    setQ("");
    setResults(null);
    setActiveId(null);
    setCreating(false);
    setForm({ firstName: "", lastName: "", email: "" });
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
    await fetch(`/api/people/${id}/outcomes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "contacted" }),
    });
    setActiveId(id);
  }

  if (activeId) {
    return (
      <div>
        <h1 className="text-[32px] font-light mt-2">Field mode</h1>
        <div className="mt-6">
          <VoterQr personId={activeId} onDone={reset} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Field mode</h1>
      <p className="text-ink-muted mt-1">
        Find a student by name or email, or add a walk-up. Hand them a QR code
        to their private voting plan — their information stays on their phone.
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
                    onClick={async () => {
                      await fetch(`/api/people/${r.id}/outcomes`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ outcome: "contacted" }),
                      });
                      setActiveId(r.id);
                    }}
                    className="border border-primary text-primary px-3 py-1.5 text-[12px] hover:bg-primary hover:text-white"
                  >
                    Start voter link
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
          {(["firstName", "lastName", "email"] as const).map((f) => (
            <input
              key={f}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              placeholder={
                f === "firstName" ? "First name" : f === "lastName" ? "Last name" : "Email"
              }
              className="block w-full bg-surface-1 border-b border-ink px-4 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          ))}
          {error && <p className="text-error text-[12px]">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={create}
              className="bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
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

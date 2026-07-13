"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Staff, Turf } from "@/lib/types";
import { UNITS } from "@/lib/units";
import { SectionTitle, StatTile } from "@/components/ui";

interface Workload {
  email: string;
  assigned: number;
  followUps: number;
  uncontacted: number;
}

function staffName(staffList: Staff[], email: string | null): string {
  if (!email) return "—";
  const s = staffList.find((x) => x.email === email);
  return s?.displayName || email;
}

export default function TurfsPage() {
  const { me, people, ready } = useStore();
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [workload, setWorkload] = useState<Workload[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [form, setForm] = useState({
    baseName: "",
    unitId: "",
    building: "",
    targetSize: "",
    onlyUnassigned: true,
  });

  const load = useCallback(async () => {
    const [tr, sr] = await Promise.all([fetch("/api/turfs"), fetch("/api/staff")]);
    if (tr.ok) {
      const data = (await tr.json()) as { turfs: Turf[]; workload: Workload[] };
      setTurfs(data.turfs);
      setWorkload(data.workload);
    }
    if (sr.ok) setStaffList(((await sr.json()) as { staff: Staff[] }).staff);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data can only arrive after mount
    load();
  }, [load]);

  const unassigned = useMemo(
    () => people.filter((p) => p.active && !p.turfId && p.population !== "affiliate"),
    [people],
  );
  const buildings = useMemo(
    () => [...new Set(people.filter((p) => p.active).map((p) => p.building))].sort(),
    [people],
  );

  if (!ready || !me) return null;
  if (me.role !== "admin" && me.role !== "captain") {
    return <p className="mt-8 text-ink-muted">Turf management is for admins and captains.</p>;
  }

  const organizers = staffList.filter((s) => s.role === "organizer" || s.role === "captain");
  const captains = staffList.filter((s) => s.role === "captain" || s.role === "admin");

  async function act(path: string, init: RequestInit) {
    setError(null);
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      setError(((await res.json()) as { error: string }).error);
      return false;
    }
    await load();
    return true;
  }

  async function createTurf() {
    const ok = await act("/api/turfs", {
      method: "POST",
      body: JSON.stringify({
        baseName: form.baseName,
        unitId: form.unitId || undefined,
        building: form.building || undefined,
        onlyUnassigned: form.onlyUnassigned,
        targetSize: form.targetSize ? Number(form.targetSize) : undefined,
      }),
    });
    if (ok) {
      setForm({ baseName: "", unitId: "", building: "", targetSize: "", onlyUnassigned: true });
      window.location.reload(); // people store needs fresh turf ids
    }
  }

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Turfs</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline mt-6">
        <StatTile label="Turfs" value={turfs.length} />
        <StatTile
          label="Students in turfs"
          value={turfs.reduce((n, t) => n + t.members, 0)}
        />
        <StatTile label="Unassigned to a turf" value={unassigned.length} />
        <StatTile
          label="Incomplete turfs"
          value={turfs.filter((t) => t.uncontacted + t.followUps > 0).length}
          hint="with uncontacted people or open follow-ups"
        />
      </div>

      {me.role === "admin" && (
        <>
          <SectionTitle>Create turfs</SectionTitle>
          <div className="border border-hairline bg-surface-1 p-4 max-w-3xl">
            <p className="text-ink-muted text-[12px] mb-3">
              Pick a slice of the residential hierarchy. Set a target size to
              auto-divide it into several turfs in residential order (building →
              entryway → room); leave it empty for one turf.
            </p>
            <div className="grid md:grid-cols-5 gap-3">
              <input
                value={form.baseName}
                onChange={(e) => setForm({ ...form, baseName: e.target.value })}
                placeholder="Name (e.g. Mather)"
                className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary md:col-span-2"
              />
              <select
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                className="bg-canvas border-b border-ink px-3 py-2.5"
              >
                <option value="">Any House/Yard</option>
                {UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
                className="bg-canvas border-b border-ink px-3 py-2.5"
              >
                <option value="">Any building</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <input
                value={form.targetSize}
                onChange={(e) =>
                  setForm({ ...form, targetSize: e.target.value.replace(/\D/g, "") })
                }
                placeholder="Target size"
                inputMode="numeric"
                className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={form.onlyUnassigned}
                  onChange={(e) => setForm({ ...form, onlyUnassigned: e.target.checked })}
                />
                Only students not already in a turf
              </label>
              <button
                onClick={createTurf}
                disabled={!form.baseName.trim()}
                className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}
      {error && <p className="text-error text-[12px] mt-3">{error}</p>}

      <SectionTitle>All turfs</SectionTitle>
      {turfs.length === 0 ? (
        <p className="text-ink-muted">No turfs yet.</p>
      ) : (
        <div className="border border-hairline divide-y divide-hairline">
          {turfs.map((t) => (
            <div key={t.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-semibold min-w-40">{t.name}</span>
                <span className="text-ink-muted text-[12px]">
                  {t.members} people · {t.contacted} contacted · {t.uncontacted}{" "}
                  uncontacted · {t.followUps} follow-ups
                </span>
                <span className="ml-auto flex h-2 w-40 bg-surface-2" aria-hidden>
                  <span
                    className="bg-success h-2"
                    style={{
                      width: `${t.members ? (t.contacted / t.members) * 100 : 0}%`,
                    }}
                  />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <label className="text-[12px] text-ink-muted flex items-center gap-2">
                  Captain
                  <select
                    value={t.captainEmail ?? ""}
                    disabled={me.role !== "admin"}
                    onChange={(e) =>
                      act(`/api/turfs/${t.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ captainEmail: e.target.value || null }),
                      })
                    }
                    className="bg-surface-1 border-b border-ink px-2 py-1.5 text-ink"
                  >
                    <option value="">—</option>
                    {captains.map((s) => (
                      <option key={s.email} value={s.email}>
                        {s.displayName || s.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px] text-ink-muted flex items-center gap-2">
                  Organizer
                  <select
                    value={t.organizerEmail ?? ""}
                    onChange={(e) =>
                      act(`/api/turfs/${t.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ organizerEmail: e.target.value || null }),
                      })
                    }
                    className="bg-surface-1 border-b border-ink px-2 py-1.5 text-ink"
                  >
                    <option value="">—</option>
                    {organizers.map((s) => (
                      <option key={s.email} value={s.email}>
                        {s.displayName || s.email}
                      </option>
                    ))}
                  </select>
                </label>
                {me.role === "admin" && (
                  <span className="flex gap-2 ml-auto text-[12px]">
                    <button
                      onClick={() =>
                        act(`/api/turfs/${t.id}`, {
                          method: "POST",
                          body: JSON.stringify({ action: "split" }),
                        })
                      }
                      className="text-primary hover:underline"
                    >
                      Split
                    </button>
                    {mergeFrom === t.id ? (
                      <span className="text-ink-muted">merge into… pick a turf</span>
                    ) : mergeFrom ? (
                      <button
                        onClick={async () => {
                          const ok = await act(`/api/turfs/${mergeFrom}`, {
                            method: "POST",
                            body: JSON.stringify({ action: "merge", targetId: t.id }),
                          });
                          if (ok) setMergeFrom(null);
                        }}
                        className="text-primary hover:underline"
                      >
                        Merge here
                      </button>
                    ) : (
                      <button
                        onClick={() => setMergeFrom(t.id)}
                        className="text-primary hover:underline"
                      >
                        Merge…
                      </button>
                    )}
                    <button
                      onClick={() => act(`/api/turfs/${t.id}`, { method: "DELETE" })}
                      className="text-error hover:underline"
                    >
                      Dissolve
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {mergeFrom && (
        <button
          onClick={() => setMergeFrom(null)}
          className="mt-2 text-[12px] text-ink-muted hover:text-ink"
        >
          Cancel merge
        </button>
      )}

      <SectionTitle>Organizer workload</SectionTitle>
      {workload.length === 0 ? (
        <p className="text-ink-muted">No one has assignments yet.</p>
      ) : (
        <div className="border border-hairline divide-y divide-hairline max-w-2xl">
          {workload.map((w) => (
            <div key={w.email} className="flex items-center gap-4 px-4 py-2.5">
              <span className="flex-1 min-w-48">{staffName(staffList, w.email)}</span>
              <span className="text-ink-muted text-[12px]">
                {w.assigned} assigned · {w.uncontacted} uncontacted · {w.followUps}{" "}
                follow-ups
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

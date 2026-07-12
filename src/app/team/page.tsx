"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, Role, Staff } from "@/lib/types";
import { Tag } from "@/components/ui";

export default function TeamPage() {
  const { me, ready } = useStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({ email: "", role: "organizer" as Role, scope: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/staff");
    if (res.ok) setStaff(((await res.json()) as { staff: Staff[] }).staff);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data can only arrive after mount
    load();
  }, [load]);

  if (!ready || !me) return null;
  if (me.role !== "admin" && me.role !== "captain") {
    return <p className="mt-8 text-ink-muted">Team management is for admins and captains.</p>;
  }

  async function invite() {
    setError(null);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        role: form.role,
        scope: form.scope.trim() || null,
      }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error: string }).error);
      return;
    }
    setForm({ email: "", role: "organizer", scope: "" });
    load();
  }

  const roleOptions: Role[] =
    me.role === "admin"
      ? ["admin", "captain", "organizer", "field"]
      : ["organizer", "field"];

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Team</h1>
      <p className="text-ink-muted mt-1">
        Access is invite-only: sign-in works only for emails listed here.
        {me.role === "captain" && ` You manage staff for ${me.scope ?? "your scope"}.`}
      </p>

      <div className="border border-hairline bg-surface-1 p-4 mt-6 max-w-3xl">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@college.harvard.edu"
            className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary md:col-span-2"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {me.role === "admin" && form.role === "captain" ? (
            <input
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="Scope (e.g. Mather)"
              className="bg-canvas border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          ) : (
            <button
              onClick={invite}
              disabled={!form.email.includes("@")}
              className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
            >
              Invite
            </button>
          )}
        </div>
        {me.role === "admin" && form.role === "captain" && (
          <button
            onClick={invite}
            disabled={!form.email.includes("@")}
            className="mt-3 bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
          >
            Invite
          </button>
        )}
        {error && <p className="text-error text-[12px] mt-2">{error}</p>}
      </div>

      <div className="mt-6 border border-hairline max-w-3xl divide-y divide-hairline">
        {staff.map((s) => (
          <div key={s.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex-1 min-w-48">
              {s.displayName || s.email}
              {s.displayName && (
                <span className="text-ink-subtle text-[12px]"> · {s.email}</span>
              )}
            </span>
            <Tag tone={s.role === "admin" ? "info" : "neutral"}>{ROLE_LABEL[s.role]}</Tag>
            {s.scope && <Tag>{s.scope}</Tag>}
            {me.role === "admin" && s.email !== me.email && (
              <button
                onClick={async () => {
                  await fetch("/api/staff", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: s.email }),
                  });
                  load();
                }}
                className="text-error text-[12px] hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

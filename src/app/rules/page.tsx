"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { StateRule } from "@/lib/types";
import { Tag } from "@/components/ui";

interface Unit {
  id: string;
  name: string;
  type: string;
  mailStreet: string | null;
}

const DATE_FIELDS: [keyof StateRule, string][] = [
  ["electionDate", "Next election"],
  ["registrationDeadline", "Registration deadline"],
  ["mailRequestDeadline", "Ballot request deadline"],
  ["ballotReturnDeadline", "Ballot return deadline"],
  ["earlyVotingStart", "Early voting starts"],
  ["earlyVotingEnd", "Early voting ends"],
];

const BOOL_FIELDS: [keyof StateRule, string][] = [
  ["onlineRegistration", "Online registration"],
  ["sameDayRegistration", "Same-day registration"],
  ["mailRequestRequired", "Mail request required"],
  ["witnessRequired", "Witness required"],
  ["notaryRequired", "Notary required"],
  ["idRequired", "ID required"],
  ["postageRequired", "Postage required"],
];

const URL_FIELDS: [keyof StateRule, string][] = [
  ["pollingPlaceUrl", "Polling place source"],
  ["ballotTrackingUrl", "Ballot tracking source"],
  ["sampleBallotUrl", "Sample ballot source"],
  ["sourceUrl", "Official source URL (required to publish)"],
];

function RuleEditor({
  rule,
  onSaved,
}: {
  rule: StateRule;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<StateRule>({ ...rule });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    const patch: Record<string, unknown> = {};
    for (const [k] of [...DATE_FIELDS, ...BOOL_FIELDS, ...URL_FIELDS]) {
      patch[k] = draft[k];
    }
    patch.returnDeadlineBasis = draft.returnDeadlineBasis;
    const res = await fetch("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jurisdiction: rule.jurisdiction, patch, publish }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(((await res.json()) as { error: string }).error);
      return;
    }
    onSaved();
  }

  const boolSelect = (k: keyof StateRule, label: string) => (
    <label key={k} className="block">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <select
        value={draft[k] === null ? "" : draft[k] ? "yes" : "no"}
        onChange={(e) =>
          setDraft({
            ...draft,
            [k]: e.target.value === "" ? null : e.target.value === "yes",
          })
        }
        className="block w-full mt-1 bg-canvas border-b border-ink px-2 py-2 text-[13px]"
      >
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );

  return (
    <div className="border border-hairline bg-surface-1 p-4 mt-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DATE_FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className="text-[12px] text-ink-muted">{label}</span>
            <input
              type="date"
              value={(draft[k] as string | null) ?? ""}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value || null })}
              className="block w-full mt-1 bg-canvas border-b border-ink px-2 py-2 text-[13px]"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[12px] text-ink-muted">Return deadline basis</span>
          <select
            value={draft.returnDeadlineBasis ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                returnDeadlineBasis:
                  (e.target.value || null) as StateRule["returnDeadlineBasis"],
              })
            }
            className="block w-full mt-1 bg-canvas border-b border-ink px-2 py-2 text-[13px]"
          >
            <option value="">Unknown</option>
            <option value="postmark">Postmarked by</option>
            <option value="receipt">Received by</option>
          </select>
        </label>
        {BOOL_FIELDS.map(([k, label]) => boolSelect(k, label))}
        {URL_FIELDS.map(([k, label]) => (
          <label key={k} className="block md:col-span-3">
            <span className="text-[12px] text-ink-muted">{label}</span>
            <input
              value={(draft[k] as string | null) ?? ""}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value || null })}
              placeholder="https://…"
              className="block w-full mt-1 bg-canvas border-b border-ink px-2 py-2 text-[13px] focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-error text-[12px] mt-3">{error}</p>}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => save(true)}
          disabled={saving}
          className="bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:bg-surface-2"
        >
          Publish (stamps review date)
        </button>
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="border border-hairline px-4 py-2 hover:border-primary hover:text-primary"
        >
          Save as unpublished draft
        </button>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const { me, ready } = useStore();
  const [rules, setRules] = useState<StateRule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rr, ur] = await Promise.all([fetch("/api/rules?all=1"), fetch("/api/units")]);
    if (rr.ok) setRules(((await rr.json()) as { rules: StateRule[] }).rules);
    if (ur.ok) setUnits(((await ur.json()) as { units: Unit[] }).units);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data can only arrive after mount
    load();
  }, [load]);

  if (!ready) return null;
  if (me?.role !== "admin") {
    return <p className="mt-8 text-ink-muted">Election rules are managed by admins.</p>;
  }

  const published = rules.filter((r) => r.published).length;

  return (
    <div>
      <h1 className="text-[32px] font-light mt-2">Election rules</h1>
      <p className="text-ink-muted mt-1 max-w-3xl">
        One entry per state, D.C., and territory ({rules.length} total,{" "}
        {published} published). Enter each fact from the official state or
        local election source — licensed data providers only as a fallback —
        and publish with the source URL. Voters see only published rules.
      </p>

      <div className="border border-hairline divide-y divide-hairline mt-4">
        {rules.map((r) => (
          <div key={r.jurisdiction}>
            <button
              onClick={() => setOpen(open === r.jurisdiction ? null : r.jurisdiction)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-1 flex flex-wrap items-center gap-3"
            >
              <span className="w-10 font-semibold">{r.jurisdiction}</span>
              <span className="flex-1 min-w-32">{r.name}</span>
              {r.published ? <Tag tone="good">Published</Tag> : <Tag>Draft</Tag>}
              <span className="text-ink-subtle text-[12px]">
                {r.reviewedAt
                  ? `reviewed ${r.reviewedAt.slice(0, 10)}`
                  : "never reviewed"}
              </span>
            </button>
            {open === r.jurisdiction && (
              <div className="px-4 pb-4">
                <RuleEditor
                  rule={r}
                  onSaved={() => {
                    setOpen(null);
                    load();
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-[20px] font-normal mt-10 mb-2">Harvard mail centers</h2>
      <p className="text-ink-muted text-[12px] mb-3 max-w-3xl">
        Street addresses used by the ballot-address generator. Update here if
        Harvard changes its mail system — no code change needed.
      </p>
      <div className="border border-hairline divide-y divide-hairline max-w-2xl">
        {units
          .filter((u) => u.type === "house")
          .map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-40">{u.name}</span>
              <input
                defaultValue={u.mailStreet ?? ""}
                onBlur={async (e) => {
                  if (e.target.value !== (u.mailStreet ?? "")) {
                    await fetch("/api/units", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: u.id, mailStreet: e.target.value }),
                    });
                    load();
                  }
                }}
                placeholder="Street address"
                className="flex-1 bg-surface-1 border-b border-ink px-3 py-1.5 text-[13px] focus:outline-none focus:border-b-2 focus:border-b-primary"
              />
            </div>
          ))}
      </div>
    </div>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useStore } from "@/lib/store";
import {
  BALLOT_STATUS_LABEL,
  BallotStatus,
  ContactOutcome,
  OUTCOME_LABEL,
  PLAN_STATUS_LABEL,
  PlanStatus,
  REGISTRATION_STATUS_LABEL,
  RegistrationStatus,
  Staff,
} from "@/lib/types";
import { ContactTag, SectionTitle, Tag } from "@/components/ui";
import { VotePlan } from "@/components/vote-plan";
import { AdminDetails } from "@/components/admin-details";
import { POPULATION_LABEL } from "@/lib/types";

const OUTCOMES: ContactOutcome[] = [
  "no_answer",
  "contacted",
  "come_back",
  "wrong_room",
  "moved",
  "opted_out",
];

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<string, string>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

function VoterLink({ personId }: { personId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr);
  }, [url]);

  if (!url) {
    return (
      <button
        onClick={async () => {
          const res = await fetch(`/api/people/${personId}/link`, { method: "POST" });
          if (res.ok) setUrl(((await res.json()) as { url: string }).url);
        }}
        className="border border-primary text-primary px-4 py-2 hover:bg-primary hover:text-white"
      >
        Create voter link
      </button>
    );
  }
  return (
    <div className="border border-hairline p-4 max-w-3xl">
      <p className="text-ink-muted text-[12px] mb-2">
        Private self-service link — the student can open it on their own phone.
        It expires in 14 days.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          readOnly
          value={url}
          className="flex-1 min-w-64 bg-surface-1 border-b border-ink px-3 py-2 text-[12px]"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
          }}
          className="bg-primary text-white px-4 py-2 hover:bg-primary-hover"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code for voter link" className="mt-3 border border-hairline" />
      )}
    </div>
  );
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, people, ready, update, recordOutcome, undoOutcome } = useStore();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const canAssign = me?.role === "admin" || me?.role === "captain";

  useEffect(() => {
    if (!canAssign) return;
    fetch("/api/staff").then(async (r) => {
      if (r.ok) setStaffList(((await r.json()) as { staff: Staff[] }).staff);
    });
  }, [canAssign]);

  if (!ready) return null;

  const p = people.find((x) => x.id === id);
  if (!p) {
    return (
      <p className="mt-8">
        Person not found or outside your assignment.{" "}
        <Link className="text-primary" href="/people">Back to people</Link>
      </p>
    );
  }

  const organizers = staffList.filter(
    (s) => s.role === "organizer" || s.role === "captain",
  );

  return (
    <div>
      <Link href="/people" className="text-primary text-[12px] hover:underline">
        ← People
      </Link>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-1">
        <h1 className="text-[32px] font-light">
          {p.firstName} {p.lastName}
        </h1>
        <ContactTag s={p.contactStatus} />
        {p.population !== "college" && <Tag>{POPULATION_LABEL[p.population]}</Tag>}
        {!p.active && <Tag tone="bad">Deactivated</Tag>}
      </div>
      <p className="text-ink-muted mt-1">
        {p.building} {p.entryway && `${p.entryway} `}
        {p.room} · {p.classYear} · {p.email} · {p.phone} · Home: {p.homeCity},{" "}
        {p.homeState}
      </p>

      <SectionTitle>Record an outcome</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={() => recordOutcome(p.id, o)}
            className="border border-hairline px-4 py-2.5 hover:border-primary hover:text-primary"
          >
            {OUTCOME_LABEL[o]}
          </button>
        ))}
        {p.history.length > 0 && (
          <button
            onClick={() => undoOutcome(p.id)}
            className="px-4 py-2.5 text-ink-muted hover:text-error"
          >
            Undo last
          </button>
        )}
      </div>
      {p.history.length > 0 && (
        <p className="text-ink-subtle text-[12px] mt-2">
          {p.history.length} attempt{p.history.length === 1 ? "" : "s"} · last:{" "}
          {OUTCOME_LABEL[p.history[p.history.length - 1].outcome]} on{" "}
          {new Date(p.history[p.history.length - 1].at).toLocaleString()}
        </p>
      )}

      <SectionTitle>Status</SectionTitle>
      <div className="grid md:grid-cols-3 gap-4 max-w-3xl">
        <Select<RegistrationStatus>
          label="Registration"
          value={p.registrationStatus}
          options={REGISTRATION_STATUS_LABEL}
          onChange={(v) => update(p.id, { registrationStatus: v })}
        />
        <Select<BallotStatus>
          label="Ballot"
          value={p.ballotStatus}
          options={BALLOT_STATUS_LABEL}
          onChange={(v) => update(p.id, { ballotStatus: v })}
        />
        <Select<PlanStatus>
          label="Plan"
          value={p.planStatus}
          options={PLAN_STATUS_LABEL}
          onChange={(v) => update(p.id, { planStatus: v })}
        />
      </div>
      <p className="text-ink-subtle text-[12px] mt-2">
        Registration marked here is voter-confirmed, not an official record —
        verify through the official lookup in the vote plan.
      </p>

      {canAssign && (
        <>
          <SectionTitle>Assignment</SectionTitle>
          <label className="block max-w-xs">
            <span className="text-[12px] text-ink-muted">Primary organizer</span>
            <select
              value={p.assignedTo ?? ""}
              onChange={(e) => update(p.id, { assignedTo: e.target.value || null })}
              className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            >
              <option value="">Unassigned</option>
              {organizers.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.displayName || s.email}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {me?.role === "admin" && (
        <>
          <SectionTitle>Details</SectionTitle>
          <AdminDetails person={p} people={people} onUpdate={(patch) => update(p.id, patch)} />
        </>
      )}

      <SectionTitle>Voter self-service link</SectionTitle>
      <VoterLink personId={p.id} />

      <SectionTitle>Vote plan</SectionTitle>
      <VotePlan
        person={p}
        onUpdate={(patch) =>
          update(p.id, {
            ...patch,
            ...(p.planStatus === "none" && (patch.jurisdiction || patch.method)
              ? { planStatus: "started" as const }
              : {}),
          })
        }
      />
    </div>
  );
}

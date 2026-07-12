"use client";

import { use } from "react";
import Link from "next/link";
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
} from "@/lib/types";
import {
  checkRegistrationUrl,
  JURISDICTIONS,
  MAIL_MODEL_LABEL,
  registerUrl,
} from "@/lib/jurisdictions";
import { ballotMailAddress } from "@/lib/mail";
import { ContactTag, SectionTitle } from "@/components/ui";

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

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { people, ready, update, recordOutcome, undoOutcome } = useStore();
  if (!ready) return null;

  const p = people.find((x) => x.id === id);
  if (!p) {
    return (
      <p className="mt-8">
        Person not found. <Link className="text-primary" href="/people">Back to people</Link>
      </p>
    );
  }

  const jurisdictionCode = p.jurisdiction === "ma" ? "MA" : p.homeState;
  const info = JURISDICTIONS[jurisdictionCode];
  const votingByMail = p.method === "mail";
  const address = ballotMailAddress({
    fullName: `${p.firstName} ${p.lastName}`,
    house: p.house,
    isFirstYear: /first/i.test(p.classYear) || /freshman/i.test(p.classYear),
    mailbox: p.mailbox,
  });

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
      </div>
      <p className="text-ink-muted mt-1">
        {p.building} {p.room} · {p.classYear} · {p.email} · {p.phone} · Home:{" "}
        {p.homeCity}, {p.homeState}
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
        verify through the official lookup below.
      </p>

      <SectionTitle>Vote plan</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <label className="block">
          <span className="text-[12px] text-ink-muted">Where they plan to vote</span>
          <div className="flex gap-px bg-hairline border border-hairline mt-1">
            {(
              [
                { key: "home", label: `Home state (${p.homeState})` },
                { key: "ma", label: "Massachusetts" },
              ] as const
            ).map((j) => (
              <button
                key={j.key}
                onClick={() => update(p.id, { jurisdiction: j.key })}
                className={`flex-1 px-3 py-2.5 ${
                  p.jurisdiction === j.key
                    ? "bg-ink text-white"
                    : "bg-canvas text-ink-muted hover:bg-surface-1"
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-[12px] text-ink-muted">Voting method</span>
          <div className="flex gap-px bg-hairline border border-hairline mt-1">
            {(
              [
                { key: "mail", label: "By mail" },
                { key: "in_person", label: "In person" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() =>
                  update(p.id, {
                    method: m.key,
                    planStatus: p.planStatus === "none" ? "started" : p.planStatus,
                  })
                }
                className={`flex-1 px-3 py-2.5 ${
                  p.method === m.key
                    ? "bg-ink text-white"
                    : "bg-canvas text-ink-muted hover:bg-surface-1"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      {p.jurisdiction && info && (
        <div className="border border-hairline mt-4 max-w-3xl">
          <div className="px-4 py-3 bg-surface-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{info.name}</span>
            <span className="text-ink-muted text-[12px]">
              {MAIL_MODEL_LABEL[info.mailModel]}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {info.flags && (
              <p className="text-[12px] bg-warning/20 px-3 py-2">
                {info.flags} — verify for this election on the official site.
              </p>
            )}
            <ol className="list-decimal ml-5 space-y-2">
              {info.mailModel !== "NO_REGISTRATION" && (
                <li>
                  Check registration on the{" "}
                  <a
                    href={checkRegistrationUrl(jurisdictionCode)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    official lookup
                  </a>
                  , then mark the result above.
                </li>
              )}
              {info.mailModel === "NO_REGISTRATION" ? (
                <li>
                  North Dakota has no voter registration — confirm ID and
                  residency requirements on the official state site.
                </li>
              ) : (
                <li>
                  If not registered:{" "}
                  <a
                    href={registerUrl(jurisdictionCode)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    register via vote.gov
                  </a>{" "}
                  (routes to the official state process).
                </li>
              )}
              {votingByMail && info.mailModel === "REQUEST" && (
                <li>Request a mail ballot through the official state process.</li>
              )}
              {votingByMail && info.mailModel === "EXCUSE" && (
                <li>
                  This state requires an excuse for absentee voting — being away
                  at college commonly qualifies, but confirm on the official
                  site before requesting.
                </li>
              )}
              {votingByMail && info.mailModel === "ALL_MAIL" && (
                <li>
                  Ballots are mailed automatically — confirm the mailing address
                  on file is the Harvard address below, not a home address.
                </li>
              )}
              {votingByMail && <li>Confirm the ballot mailing address (below).</li>}
              {!votingByMail && p.jurisdiction === "home" && (
                <li>
                  Voting in person in {p.homeState} means being there during the
                  voting period — otherwise switch to a mail ballot.
                </li>
              )}
              <li>
                When each step is done, update the ballot and plan status above.
              </li>
            </ol>
          </div>
        </div>
      )}

      {votingByMail && (
        <div className="mt-4 max-w-3xl">
          <label className="block max-w-xs">
            <span className="text-[12px] text-ink-muted">
              Harvard mailbox number (voter-confirmed — never a room number)
            </span>
            <input
              value={p.mailbox}
              onChange={(e) => update(p.id, { mailbox: e.target.value })}
              placeholder="e.g. 287"
              className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </label>
          <div className="mt-3 border border-hairline p-4">
            <div className="text-[12px] text-ink-muted mb-2">Ballot mailing address</div>
            {address.blocked ? (
              <p className="text-ink-muted">{address.blocked}</p>
            ) : (
              <pre className="font-sans whitespace-pre-wrap">
                {address.lines.join("\n")}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

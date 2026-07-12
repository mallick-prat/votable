"use client";

import type { Jurisdiction, Person, VotingMethod } from "@/lib/types";
import {
  checkRegistrationUrl,
  JURISDICTIONS,
  MAIL_MODEL_LABEL,
  registerUrl,
} from "@/lib/jurisdictions";
import { ballotMailAddress } from "@/lib/mail";

export type PlanPerson = Pick<
  Person,
  | "firstName"
  | "lastName"
  | "classYear"
  | "house"
  | "homeState"
  | "jurisdiction"
  | "method"
  | "mailbox"
>;

interface Props {
  person: PlanPerson;
  onUpdate: (
    patch: Partial<{
      jurisdiction: Jurisdiction;
      method: VotingMethod;
      mailbox: string;
    }>,
  ) => void;
}

export function VotePlan({ person: p, onUpdate }: Props) {
  const jurisdictionCode = p.jurisdiction === "ma" ? "MA" : p.homeState;
  const info = JURISDICTIONS[jurisdictionCode];
  const votingByMail = p.method === "mail";
  const address = ballotMailAddress({
    fullName: `${p.firstName} ${p.lastName}`,
    house: p.house,
    isFirstYear: /first|freshman/i.test(p.classYear),
    mailbox: p.mailbox,
  });

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <label className="block">
          <span className="text-[12px] text-ink-muted">Where to vote</span>
          <div className="flex gap-px bg-hairline border border-hairline mt-1">
            {(
              [
                { key: "home", label: `Home state (${p.homeState || "—"})` },
                { key: "ma", label: "Massachusetts" },
              ] as const
            ).map((j) => (
              <button
                key={j.key}
                disabled={j.key === "home" && !p.homeState}
                onClick={() => onUpdate({ jurisdiction: j.key })}
                className={`flex-1 px-3 py-2.5 disabled:text-ink-subtle ${
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
                onClick={() => onUpdate({ method: m.key })}
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
                  , then record the result.
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
            </ol>
          </div>
        </div>
      )}

      {votingByMail && (
        <div className="mt-4 max-w-3xl">
          <label className="block max-w-xs">
            <span className="text-[12px] text-ink-muted">
              Harvard mailbox number (confirm in Harvard&apos;s mail system —
              never a room number)
            </span>
            <input
              value={p.mailbox}
              onChange={(e) => onUpdate({ mailbox: e.target.value })}
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

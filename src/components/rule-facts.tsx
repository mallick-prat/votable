"use client";

import type { StateRule } from "@/lib/types";

const fmt = (v: boolean | null) => (v === null ? "Check official site" : v ? "Yes" : "No");

/** Published, admin-reviewed election rules for one jurisdiction. */
export function RuleFacts({ rule }: { rule: StateRule }) {
  const rows: [string, string | null][] = [
    ["Next election", rule.electionDate],
    ["Registration deadline", rule.registrationDeadline],
    ["Online registration", fmt(rule.onlineRegistration)],
    ["Same-day registration", fmt(rule.sameDayRegistration)],
    ["Mail ballot must be requested", fmt(rule.mailRequestRequired)],
    ["Ballot request deadline", rule.mailRequestDeadline],
    [
      "Ballot return deadline",
      rule.ballotReturnDeadline
        ? `${rule.ballotReturnDeadline} (${
            rule.returnDeadlineBasis === "postmark"
              ? "postmarked by"
              : rule.returnDeadlineBasis === "receipt"
                ? "must be received by"
                : "basis: check official site"
          })`
        : null,
    ],
    ["Witness required", fmt(rule.witnessRequired)],
    ["Notary required", fmt(rule.notaryRequired)],
    ["ID required", fmt(rule.idRequired)],
    ["Postage required", fmt(rule.postageRequired)],
    [
      "Early voting",
      rule.earlyVotingStart
        ? `${rule.earlyVotingStart} – ${rule.earlyVotingEnd ?? "?"}`
        : null,
    ],
  ];

  return (
    <div className="border border-hairline">
      <div className="px-4 py-2 bg-surface-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{rule.name} election rules</span>
        <span className="text-ink-subtle text-[12px]">
          reviewed {rule.reviewedAt?.slice(0, 10) ?? "—"}
        </span>
      </div>
      <dl className="divide-y divide-hairline">
        {rows
          .filter(([, v]) => v !== null)
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 px-4 py-1.5 text-[12px]">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="px-4 py-2 border-t border-hairline flex flex-wrap gap-4 text-[12px]">
        {rule.pollingPlaceUrl && (
          <a href={rule.pollingPlaceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Polling places
          </a>
        )}
        {rule.ballotTrackingUrl && (
          <a href={rule.ballotTrackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Track your ballot
          </a>
        )}
        {rule.sampleBallotUrl && (
          <a href={rule.sampleBallotUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            Sample ballot
          </a>
        )}
        {rule.sourceUrl && (
          <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-auto">
            Official source
          </a>
        )}
      </div>
    </div>
  );
}

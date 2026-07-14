"use client";

import { useEffect, useMemo, useState } from "react";
import type { Jurisdiction, Person, StateRule, VotingMethod } from "@/lib/types";
import {
  checkRegistrationUrl,
  JURISDICTIONS,
  MAIL_MODEL_LABEL,
  registerUrl,
} from "@/lib/jurisdictions";
import { ballotMailAddress, HOUSES, HOUSE_MAIL_CENTERS } from "@/lib/mail";
import { RuleFacts } from "@/components/rule-facts";

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
  | "ballotAddress"
>;

interface Props {
  person: PlanPerson;
  onUpdate: (
    patch: Partial<{
      jurisdiction: Jurisdiction;
      method: VotingMethod;
      mailbox: string;
      ballotAddress: string;
    }>,
  ) => void;
}

/** Published rules + mail centers, fetched once per mount (public data). */
function useReference() {
  const [rules, setRules] = useState<Map<string, StateRule>>(new Map());
  const [centers, setCenters] = useState<Record<string, string>>(HOUSE_MAIL_CENTERS);
  useEffect(() => {
    fetch("/api/rules").then(async (r) => {
      if (!r.ok) return;
      const { rules } = (await r.json()) as { rules: StateRule[] };
      setRules(new Map(rules.map((x) => [x.jurisdiction, x])));
    });
    fetch("/api/units").then(async (r) => {
      if (!r.ok) return;
      const { units } = (await r.json()) as {
        units: { name: string; type: string; mailStreet: string | null }[];
      };
      const map: Record<string, string> = {};
      for (const u of units) {
        if (u.type === "house" && u.mailStreet)
          map[u.name.replace(" House", "")] = u.mailStreet;
      }
      if (Object.keys(map).length > 0) setCenters(map);
    });
  }, []);
  return { rules, centers };
}

/**
 * Harvard ballot-address tool. The REGISTRATION address is where the voter
 * is registered (home or Cambridge residence); the DELIVERY address is
 * where the physical ballot should arrive — a Harvard mail center, never a
 * dorm room. First-years use the Yard Mail Center; upperclass students pick
 * their House; Dudley and off-campus enter an address manually.
 */
function MailAddressTool({
  person: p,
  centers,
  onUpdate,
}: {
  person: PlanPerson;
  centers: Record<string, string>;
  onUpdate: Props["onUpdate"];
}) {
  const isFirstYear = /first|freshman/i.test(p.classYear);
  const [houseChoice, setHouseChoice] = useState(p.house ?? "");
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [editing, setEditing] = useState(!p.ballotAddress);

  const preview = useMemo(
    () =>
      ballotMailAddress(
        {
          fullName: `${p.firstName} ${p.lastName}`,
          house: isFirstYear ? null : houseChoice || null,
          isFirstYear,
          mailbox: p.mailbox,
        },
        centers,
      ),
    [p.firstName, p.lastName, p.mailbox, houseChoice, isFirstYear, centers],
  );

  if (!editing && p.ballotAddress) {
    return (
      <div className="border border-hairline p-4">
        <div className="text-[12px] text-ink-muted mb-2">
          Confirmed ballot delivery address
        </div>
        <pre className="font-sans whitespace-pre-wrap">{p.ballotAddress}</pre>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 text-primary text-[12px] hover:underline"
        >
          Change address
        </button>
      </div>
    );
  }

  return (
    <div className="border border-hairline p-4 space-y-3">
      <p className="text-[12px] text-ink-muted">
        Your <span className="text-ink">registration address</span> is where
        you&apos;re registered to vote (home or your Cambridge residence). This is
        different: the <span className="text-ink">delivery address</span> below
        is only where the physical ballot envelope arrives.
      </p>

      {!manual && (
        <>
          {isFirstYear ? (
            <p className="text-[12px]">
              First-years: mail goes through the{" "}
              <span className="font-semibold">Harvard Yard Mail Center</span>,
              not your dorm room. Enter your Yard mailbox number.
            </p>
          ) : (
            <label className="block max-w-xs">
              <span className="text-[12px] text-ink-muted">Your House</span>
              <select
                value={houseChoice}
                onChange={(e) => setHouseChoice(e.target.value)}
                className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2.5"
              >
                <option value="">Choose…</option>
                {HOUSES.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block max-w-xs">
            <span className="text-[12px] text-ink-muted">
              Mailbox number (from Harvard&apos;s mail system — never a room number)
            </span>
            <input
              value={p.mailbox}
              onChange={(e) => onUpdate({ mailbox: e.target.value })}
              placeholder="e.g. 287"
              className="block w-full mt-1 bg-surface-1 border-b border-ink px-3 py-2.5 focus:outline-none focus:border-b-2 focus:border-b-primary"
            />
          </label>
          <div className="border border-hairline p-3 bg-surface-1">
            <div className="text-[12px] text-ink-muted mb-1">Generated address</div>
            {preview.blocked ? (
              <p className="text-ink-muted text-[12px]">{preview.blocked}</p>
            ) : (
              <pre className="font-sans whitespace-pre-wrap">
                {preview.lines.join("\n")}
              </pre>
            )}
          </div>
          {!preview.blocked && (
            <button
              onClick={() => {
                onUpdate({ ballotAddress: preview.lines.join("\n") });
                setEditing(false);
              }}
              className="bg-primary text-white px-4 py-2.5 hover:bg-primary-hover"
            >
              Use this address
            </button>
          )}
          <button
            onClick={() => setManual(true)}
            className="block text-primary text-[12px] hover:underline"
          >
            Dudley or off-campus? Enter an address manually
          </button>
        </>
      )}

      {manual && (
        <>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={4}
            placeholder={"Full name\nStreet address\nCity, State ZIP"}
            className="w-full bg-surface-1 border border-hairline p-3 focus:outline-none focus:border-b-2 focus:border-b-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onUpdate({ ballotAddress: manualText.trim() });
                setEditing(false);
                setManual(false);
              }}
              disabled={manualText.trim().split("\n").length < 2}
              className="bg-primary text-white px-4 py-2.5 hover:bg-primary-hover disabled:bg-surface-2 disabled:text-ink-subtle"
            >
              Use this address
            </button>
            <button
              onClick={() => setManual(false)}
              className="px-3 py-2.5 text-ink-muted hover:text-ink"
            >
              Back
            </button>
          </div>
        </>
      )}

      <ul className="text-[12px] text-ink-muted list-disc ml-5 space-y-1">
        <li>Confirm your mailbox is active in Harvard&apos;s mail system before using it.</li>
        <li>Never use last year&apos;s House or dorm address.</li>
        <li>
          Don&apos;t rely on Harvard forwarding for election mail — update the
          address with your election office instead.
        </li>
      </ul>
    </div>
  );
}

export function VotePlan({ person: p, onUpdate }: Props) {
  const { rules, centers } = useReference();
  const jurisdictionCode = p.jurisdiction === "ma" ? "MA" : p.homeState;
  const info = JURISDICTIONS[jurisdictionCode];
  const rule = rules.get(jurisdictionCode);
  const votingByMail = p.method === "mail";

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-4">
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

      {p.jurisdiction && rule?.published && <RuleFacts rule={rule} />}

      {p.jurisdiction && info && (
        <div className="border border-hairline">
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
              {info.mailModel !== "NO_REGISTRATION" && info.mailModel !== "TERRITORY" && (
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
              {info.mailModel === "NO_REGISTRATION" && (
                <li>
                  North Dakota has no voter registration — confirm ID and
                  residency requirements on the official state site.
                </li>
              )}
              {info.mailModel === "TERRITORY" && (
                <li>
                  Territorial election rules require manual review — contact the
                  local election office, and ask the campaign help desk for
                  support.
                </li>
              )}
              {info.mailModel !== "NO_REGISTRATION" && info.mailModel !== "TERRITORY" && (
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
                  on file is the Harvard delivery address below, not a home
                  address.
                </li>
              )}
              {votingByMail && <li>Confirm the ballot delivery address (below).</li>}
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
        <MailAddressTool person={p} centers={centers} onUpdate={onUpdate} />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Jurisdiction, RegistrationStatus, StateRule } from "@/lib/types";
import { JURISDICTIONS, MAIL_MODEL_LABEL, registerUrl } from "@/lib/jurisdictions";

/** Official, stable federal resources — no invented links or facts. */
const EAC_FORM_URL =
  "https://www.eac.gov/voters/national-mail-voter-registration-form";
const FVAP_URL = "https://www.fvap.gov";

interface PathPerson {
  homeState: string;
  jurisdiction: Jurisdiction | null;
  registrationStatus: RegistrationStatus;
}

function CompareCell({
  rule,
  code,
}: {
  rule: StateRule | undefined;
  code: string;
}) {
  const info = JURISDICTIONS[code];
  const yn = (v: boolean | null | undefined) =>
    v == null ? "check official site" : v ? "yes" : "no";
  return (
    <ul className="text-[12px] space-y-1.5 text-ink-muted">
      <li>
        <span className="text-ink">Registration deadline:</span>{" "}
        {rule?.registrationDeadline ?? "check official site"}
      </li>
      <li>
        <span className="text-ink">Online registration:</span>{" "}
        {yn(rule?.onlineRegistration)}
      </li>
      <li>
        <span className="text-ink">Same-day registration:</span>{" "}
        {yn(rule?.sameDayRegistration)}
      </li>
      <li>
        <span className="text-ink">Mail voting:</span>{" "}
        {info ? MAIL_MODEL_LABEL[info.mailModel] : "—"}
      </li>
      <li>
        <span className="text-ink">Ballot return:</span>{" "}
        {rule?.ballotReturnDeadline
          ? `${rule.ballotReturnDeadline} (${rule.returnDeadlineBasis ?? "basis unverified"})`
          : "check official site"}
      </li>
      <li>
        <span className="text-ink">Witness/notary/ID:</span>{" "}
        {info?.flags ?? "no special flags on file"}
      </li>
    </ul>
  );
}

/**
 * Voter-facing registration workflow: a neutral home-state vs Massachusetts
 * comparison (never based on political competitiveness), the registration
 * paths for the chosen state, progress tracking, and special situations.
 */
export function RegistrationPaths({
  person,
  rules,
  onUpdate,
}: {
  person: PathPerson;
  rules: Map<string, StateRule>;
  onUpdate: (patch: {
    jurisdiction?: Jurisdiction;
    registrationStatus?: RegistrationStatus;
  }) => void;
}) {
  const [compare, setCompare] = useState(person.jurisdiction === null);
  const [special, setSpecial] = useState<string | null>(null);
  const code = person.jurisdiction === "ma" ? "MA" : person.homeState;
  const rule = rules.get(code);
  const status = person.registrationStatus;

  return (
    <div className="space-y-4 max-w-3xl">
      {compare && (
        <div className="border border-hairline p-4">
          <p className="mb-3">
            You can vote where you consider home, or in Massachusetts using your
            Cambridge residence. Both are legitimate — the choice is yours, and
            it depends on which elections matter to you and which process fits
            your plans. Compare:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { code: person.homeState, label: `Home state (${person.homeState || "—"})`, key: "home" as const },
              { code: "MA", label: "Massachusetts (Cambridge)", key: "ma" as const },
            ].map((side) => (
              <div key={side.key} className="border border-hairline p-3">
                <div className="font-semibold mb-2">{side.label}</div>
                {side.code ? (
                  <CompareCell rule={rules.get(side.code)} code={side.code} />
                ) : (
                  <p className="text-[12px] text-ink-muted">No home state on file.</p>
                )}
                <button
                  onClick={() => {
                    onUpdate({ jurisdiction: side.key });
                    setCompare(false);
                  }}
                  disabled={!side.code}
                  className="mt-3 w-full border border-primary text-primary px-3 py-2 hover:bg-primary hover:text-white disabled:border-hairline disabled:text-ink-subtle"
                >
                  Vote in {side.code || "—"}
                </button>
              </div>
            ))}
          </div>
          <p className="text-ink-subtle text-[12px] mt-3">
            Deadlines shown only where the campaign has verified them against the
            official source — always confirm on your state&apos;s site.
          </p>
        </div>
      )}
      {!compare && (
        <button
          onClick={() => setCompare(true)}
          className="text-primary text-[12px] hover:underline"
        >
          Compare home state vs. Massachusetts
        </button>
      )}

      {person.jurisdiction && code && (
        <div className="border border-hairline p-4">
          <div className="font-semibold mb-2">
            Register or update your registration in {code}
          </div>
          <ul className="space-y-3">
            {rule?.onlineRegistration !== false && (
              <li>
                <a
                  href={registerUrl(code)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Register or update online via vote.gov
                </a>{" "}
                <span className="text-ink-muted text-[12px]">
                  — also the path for address and name updates.
                </span>
              </li>
            )}
            <li>
              <span className="font-semibold text-[14px]">Paper form:</span>{" "}
              <a
                href={EAC_FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                National Mail Voter Registration Form (official)
              </a>
              <ul className="list-disc ml-5 mt-1 text-[12px] text-ink-muted space-y-1">
                <li>
                  Complete the name, address, date of birth, and ID-number boxes,
                  and <span className="text-ink">sign the form yourself</span>.
                </li>
                <li>
                  The form&apos;s state instructions list where to send it for {code}{" "}
                  and whether it must be mailed or may be delivered in person —
                  most states require mail or in-person delivery.
                </li>
                <li>Some states are not covered by this form — the instructions say so.</li>
              </ul>
            </li>
            {rule?.sameDayRegistration && (
              <li className="text-[12px]">
                {code} offers same-day registration — you can register and vote
                in one trip during the official period. Bring proof of identity
                and residence (check the official site for exactly what counts).
              </li>
            )}
          </ul>

          <div className="mt-4 pt-3 border-t border-hairline">
            <span className="text-[12px] text-ink-muted">Where are you in the process?</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => onUpdate({ registrationStatus: "registration_started" })}
                className={`border px-3 py-2 text-[12px] ${
                  status === "registration_started"
                    ? "border-primary text-primary"
                    : "border-hairline hover:border-primary hover:text-primary"
                }`}
              >
                I started
              </button>
              <button
                onClick={() => onUpdate({ registrationStatus: "application_submitted" })}
                className={`border px-3 py-2 text-[12px] ${
                  status === "application_submitted"
                    ? "border-primary text-primary"
                    : "border-hairline hover:border-primary hover:text-primary"
                }`}
              >
                I submitted my application
              </button>
              <button
                onClick={() => onUpdate({ registrationStatus: "voter_confirmed" })}
                className={`border px-3 py-2 text-[12px] ${
                  status === "voter_confirmed"
                    ? "border-success text-success"
                    : "border-hairline hover:border-success hover:text-success"
                }`}
              >
                I confirmed it went through
              </button>
            </div>
            <p className="text-ink-subtle text-[12px] mt-2">
              After submitting, re-check the official lookup in a week or two to
              confirm it was processed.
            </p>
          </div>
        </div>
      )}

      <div className="border border-hairline">
        <div className="px-4 py-2 bg-surface-1 font-semibold text-[14px]">
          Special situations
        </div>
        {[
          {
            key: "abroad",
            label: "I'm studying abroad",
            body: (
              <>
                You vote absentee under UOCAVA using the Federal Post Card
                Application. Start at{" "}
                <a href={FVAP_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  FVAP.gov
                </a>{" "}
                (the official federal program) — it covers registration, ballot
                request, and the emergency write-in ballot if yours arrives late.
              </>
            ),
          },
          {
            key: "military",
            label: "I'm a service member or military dependent",
            body: (
              <>
                Use the military voter path at{" "}
                <a href={FVAP_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  FVAP.gov
                </a>{" "}
                — deadlines and delivery options differ from the civilian process.
              </>
            ),
          },
          {
            key: "under18",
            label: "I'm under 18",
            body: (
              <>
                Many states let you preregister at 16 or 17, and some let you
                vote in a primary if you turn 18 by the general election. Check
                your state&apos;s official site via{" "}
                <a href="https://vote.gov" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  vote.gov
                </a>{" "}
                for the exact rule.
              </>
            ),
          },
          {
            key: "firsttime",
            label: "This is my first time voting",
            body: (
              <>
                If you registered by mail and are voting for the first time,
                federal law may require ID with your first ballot (a copy of a
                photo ID or a document with your name and address). Your
                state&apos;s official instructions say exactly what counts — don&apos;t
                let this surprise you at the last minute.
              </>
            ),
          },
        ].map((item) => (
          <div key={item.key} className="border-t border-hairline">
            <button
              onClick={() => setSpecial(special === item.key ? null : item.key)}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-1 flex justify-between"
            >
              {item.label}
              <span className="text-ink-subtle">{special === item.key ? "–" : "+"}</span>
            </button>
            {special === item.key && (
              <p className="px-4 pb-3 text-[12px] text-ink-muted">{item.body}</p>
            )}
          </div>
        ))}
        <div className="border-t border-hairline px-4 py-3">
          <button
            onClick={() => onUpdate({ registrationStatus: "manual_help" })}
            className="border border-hairline px-3 py-2 text-[12px] hover:border-error hover:text-error"
          >
            My situation is complicated — I want help from the team
          </button>
          {status === "manual_help" && (
            <span className="ml-3 text-[12px] text-ink-muted">
              Noted — an organizer will follow up with you.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

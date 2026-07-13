"use client";

import { useState } from "react";
import type { RegistrationStatus } from "@/lib/types";
import { getAdapter, registerUrl } from "@/lib/jurisdictions";
import { RegistrationTag } from "@/components/ui";

/**
 * The registration-check workflow: send the voter to the official state
 * lookup, then record what the official site said. There is no national
 * registration database, so a result is always official-lookup + confirm.
 */
export function RegistrationCheck({
  jurisdiction,
  status,
  onResult,
}: {
  jurisdiction: string; // two-letter code
  status: RegistrationStatus;
  onResult: (result: string) => void;
}) {
  const [showNoMatch, setShowNoMatch] = useState(false);
  const adapter = getAdapter(jurisdiction);

  if (!jurisdiction) {
    return (
      <p className="text-ink-muted">
        Choose where to vote first — the registration check depends on the state.
      </p>
    );
  }

  return (
    <div className="border border-hairline p-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-ink-muted">Registration status</span>
        <RegistrationTag s={status} />
      </div>

      {adapter.method === "NO_REGISTRATION" ? (
        <p className="mt-3">
          {adapter.note}{" "}
          <a
            href={adapter.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Open the official North Dakota voter portal
          </a>
          .
        </p>
      ) : (
        <>
          <div className="mt-3">
            <a
              href={adapter.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-primary text-white px-4 py-2.5 hover:bg-primary-hover"
            >
              Open official {jurisdiction} lookup
            </a>
            <p className="text-ink-subtle text-[12px] mt-2">
              The voter completes the lookup on the official site — Voteable never
              submits or stores the lookup details.
            </p>
          </div>

          <div className="mt-4">
            <span className="text-[12px] text-ink-muted">
              What did the official site say?
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => onResult("confirmed")}
                className="border border-hairline px-3 py-2 hover:border-success hover:text-success"
              >
                Registered
              </button>
              <button
                onClick={() => onResult("pending")}
                className="border border-hairline px-3 py-2 hover:border-primary hover:text-primary"
              >
                Application pending
              </button>
              <button
                onClick={() => setShowNoMatch(true)}
                className="border border-hairline px-3 py-2 hover:border-primary hover:text-primary"
              >
                No match found
              </button>
              <button
                onClick={() => onResult("manual_help")}
                className="border border-hairline px-3 py-2 hover:border-error hover:text-error"
              >
                Needs help
              </button>
            </div>
          </div>

          {showNoMatch && (
            <div className="mt-4 bg-surface-1 p-4">
              <p>
                No match doesn&apos;t mean unregistered. The record may be under a
                different spelling, a previous address, or a recent application
                that hasn&apos;t been processed yet.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href={adapter.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-hairline px-3 py-2 hover:border-primary hover:text-primary"
                >
                  Try again (other spelling / old address)
                </a>
                <a
                  href={registerUrl(jurisdiction)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onResult("needs_registration")}
                  className="border border-primary text-primary px-3 py-2 hover:bg-primary hover:text-white"
                >
                  Register now via vote.gov
                </a>
                <button
                  onClick={() => {
                    onResult("no_match");
                    setShowNoMatch(false);
                  }}
                  className="border border-hairline px-3 py-2 hover:border-primary hover:text-primary"
                >
                  Record “no match” for follow-up
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

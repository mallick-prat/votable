"use client";

import { use, useCallback, useEffect, useState } from "react";
import { VotePlan, type PlanPerson } from "@/components/vote-plan";

type VoterPerson = PlanPerson & {
  registrationStatus: string;
  ballotStatus: string;
  planStatus: string;
};

const SELF_REPORT: {
  field: "registrationStatus" | "ballotStatus" | "planStatus";
  value: string;
  label: string;
  done: (p: VoterPerson) => boolean;
}[] = [
  {
    field: "registrationStatus",
    value: "voter_confirmed",
    label: "I confirmed I'm registered",
    done: (p) => p.registrationStatus === "voter_confirmed",
  },
  {
    field: "ballotStatus",
    value: "requested",
    label: "I requested my ballot",
    done: (p) => ["requested", "received", "returned"].includes(p.ballotStatus),
  },
  {
    field: "ballotStatus",
    value: "received",
    label: "My ballot arrived",
    done: (p) => ["received", "returned"].includes(p.ballotStatus),
  },
  {
    field: "ballotStatus",
    value: "returned",
    label: "I returned my ballot",
    done: (p) => p.ballotStatus === "returned",
  },
  {
    field: "planStatus",
    value: "complete",
    label: "My plan is complete",
    done: (p) => p.planStatus === "complete",
  },
];

export default function VoterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [person, setPerson] = useState<VoterPerson | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    fetch(`/api/voter/${token}`).then(async (r) => {
      if (!r.ok) {
        setInvalid(true);
        return;
      }
      setPerson(((await r.json()) as { person: VoterPerson }).person);
    });
  }, [token]);

  const patch = useCallback(
    (p: Partial<Record<string, unknown>>) => {
      setPerson((prev) => (prev ? ({ ...prev, ...p } as VoterPerson) : prev));
      fetch(`/api/voter/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
    },
    [token],
  );

  if (invalid) {
    return (
      <div className="max-w-md mx-auto mt-24 border border-hairline p-8 text-center">
        <h1 className="text-[24px] font-light">This link has expired</h1>
        <p className="text-ink-muted mt-3">
          Ask your organizer for a new link, or visit{" "}
          <a href="https://vote.gov" className="text-primary hover:underline">
            vote.gov
          </a>{" "}
          to register and plan directly with official sources.
        </p>
      </div>
    );
  }
  if (!person) return null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-[32px] font-light mt-2">
        Your voting plan, {person.firstName}
      </h1>
      <p className="text-ink-muted mt-1">
        This page is private to you. Only you can update it, and every election
        fact links to the official source — nothing here replaces your state&apos;s
        instructions.
      </p>

      <div className="mt-6">
        <VotePlan
          person={person}
          onUpdate={(p) =>
            patch(
              person.planStatus === "none" && (p.jurisdiction || p.method)
                ? { ...p, planStatus: "started" }
                : p,
            )
          }
        />
      </div>

      <h2 className="text-[20px] font-normal mt-8 mb-3">Check off your progress</h2>
      <ul className="border-t border-hairline">
        {SELF_REPORT.map((step) => {
          const done = step.done(person);
          return (
            <li
              key={step.label}
              className="border-b border-hairline flex items-center justify-between gap-3 py-3"
            >
              <span className={done ? "text-ink-subtle line-through" : ""}>
                {step.label}
              </span>
              {!done && (
                <button
                  onClick={() => patch({ [step.field]: step.value })}
                  className="border border-hairline px-3 py-1.5 text-[12px] hover:border-primary hover:text-primary"
                >
                  Mark done
                </button>
              )}
              {done && <span className="text-success text-[12px]">Done</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

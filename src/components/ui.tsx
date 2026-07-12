import type { ReactNode } from "react";
import {
  BallotStatus,
  BALLOT_STATUS_LABEL,
  ContactStatus,
  CONTACT_STATUS_LABEL,
  PlanStatus,
  PLAN_STATUS_LABEL,
  RegistrationStatus,
  REGISTRATION_STATUS_LABEL,
} from "@/lib/types";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-1 text-ink-muted",
  good: "bg-success/10 text-success",
  warn: "bg-warning/20 text-ink",
  bad: "bg-error/10 text-error",
  info: "bg-primary/10 text-primary",
};

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[12px] leading-4 whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

const CONTACT_TONE: Record<ContactStatus, Tone> = {
  uncontacted: "neutral",
  attempted: "warn",
  contacted: "good",
  follow_up: "warn",
  moved: "neutral",
  opted_out: "neutral",
};

const REG_TONE: Record<RegistrationStatus, Tone> = {
  unknown: "neutral",
  voter_confirmed: "good",
  needs_registration: "bad",
  application_submitted: "info",
  lookup_required: "warn",
};

const BALLOT_TONE: Record<BallotStatus, Tone> = {
  not_started: "neutral",
  not_needed: "neutral",
  request_needed: "bad",
  requested: "info",
  received: "good",
  returned: "good",
};

const PLAN_TONE: Record<PlanStatus, Tone> = {
  none: "neutral",
  started: "info",
  complete: "good",
};

export const ContactTag = ({ s }: { s: ContactStatus }) => (
  <Tag tone={CONTACT_TONE[s]}>{CONTACT_STATUS_LABEL[s]}</Tag>
);
export const RegistrationTag = ({ s }: { s: RegistrationStatus }) => (
  <Tag tone={REG_TONE[s]}>{REGISTRATION_STATUS_LABEL[s]}</Tag>
);
export const BallotTag = ({ s }: { s: BallotStatus }) => (
  <Tag tone={BALLOT_TONE[s]}>{BALLOT_STATUS_LABEL[s]}</Tag>
);
export const PlanTag = ({ s }: { s: PlanStatus }) => (
  <Tag tone={PLAN_TONE[s]}>{PLAN_STATUS_LABEL[s]}</Tag>
);

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border border-hairline bg-canvas p-4">
      <div className="text-ink-muted text-[12px] tracking-[0.32px]">{label}</div>
      <div className="text-[32px] font-light leading-tight mt-1">{value}</div>
      {hint && <div className="text-ink-subtle text-[12px] mt-1">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[20px] font-normal mt-8 mb-3">{children}</h2>;
}

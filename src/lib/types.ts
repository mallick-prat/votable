export type ContactOutcome =
  | "no_answer"
  | "contacted"
  | "come_back"
  | "wrong_room"
  | "moved"
  | "opted_out";

export type ContactStatus =
  | "uncontacted"
  | "attempted"
  | "contacted"
  | "follow_up"
  | "moved"
  | "opted_out";

export type RegistrationStatus =
  | "unknown"
  | "voter_confirmed"
  | "needs_registration"
  | "application_submitted"
  | "lookup_required";

export type BallotStatus =
  | "not_started"
  | "not_needed"
  | "request_needed"
  | "requested"
  | "received"
  | "returned";

export type PlanStatus = "none" | "started" | "complete";

export type Jurisdiction = "home" | "ma";
export type VotingMethod = "mail" | "in_person";

export interface ContactAttempt {
  outcome: ContactOutcome;
  at: string; // ISO timestamp
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  classYear: string;
  house: string | null; // one of the twelve Houses when detected
  building: string; // display grouping, e.g. "Mather" or "20 DeWolfe"
  room: string;
  suiteRaw: string;
  homeCity: string;
  homeState: string; // two-letter code
  homeZip: string;
  contactStatus: ContactStatus;
  registrationStatus: RegistrationStatus;
  ballotStatus: BallotStatus;
  planStatus: PlanStatus;
  jurisdiction: Jurisdiction | null;
  method: VotingMethod | null;
  mailbox: string; // Harvard mailbox number, voter-confirmed
  history: ContactAttempt[];
}

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  uncontacted: "Uncontacted",
  attempted: "Attempted",
  contacted: "Contacted",
  follow_up: "Follow-up",
  moved: "Moved",
  opted_out: "Opted out",
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  unknown: "Unknown",
  voter_confirmed: "Confirmed by voter",
  needs_registration: "Registration needed",
  application_submitted: "Application submitted",
  lookup_required: "Official lookup required",
};

export const BALLOT_STATUS_LABEL: Record<BallotStatus, string> = {
  not_started: "—",
  not_needed: "Not needed",
  request_needed: "Request needed",
  requested: "Requested",
  received: "Received",
  returned: "Returned",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  none: "No plan",
  started: "Started",
  complete: "Complete",
};

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  no_answer: "No answer",
  contacted: "Contacted",
  come_back: "Come back later",
  wrong_room: "Wrong room",
  moved: "Moved",
  opted_out: "Opted out",
};

/** Outcome → resulting contact status */
export const OUTCOME_TO_STATUS: Record<ContactOutcome, ContactStatus> = {
  no_answer: "attempted",
  contacted: "contacted",
  come_back: "follow_up",
  wrong_room: "follow_up",
  moved: "moved",
  opted_out: "opted_out",
};

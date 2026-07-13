export type ContactOutcome =
  | "no_answer"
  | "contacted"
  | "come_back"
  | "wrong_room"
  | "moved"
  | "already_completed"
  | "opted_out"
  | "needs_help";

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
  | "pending"
  | "no_match"
  | "needs_registration"
  | "application_submitted"
  | "lookup_required"
  | "manual_help";

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

export type Role = "admin" | "captain" | "organizer" | "field";

export interface Staff {
  email: string;
  role: Role;
  /** House/Yard/building a captain is responsible for. */
  scope: string | null;
  displayName: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  captain: "Captain",
  organizer: "Organizer",
  field: "Field volunteer",
};

/** The fields a voter may update about themselves via a voter link. */
export const VOTER_PATCHABLE = [
  "jurisdiction",
  "method",
  "mailbox",
  "registrationStatus",
  "ballotStatus",
  "planStatus",
] as const;

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
  assignedTo: string | null; // primary organizer's staff email
  unitId: string | null; // House/Yard/Dudley (residential_units)
  entryway: string;
  population: Population;
  active: boolean;
  turfId: string | null;
  history: ContactAttempt[];
}

export interface Turf {
  id: string;
  name: string;
  captainEmail: string | null;
  organizerEmail: string | null;
  members: number;
  contacted: number;
  uncontacted: number;
  followUps: number;
}

export type DeadlineType =
  | "registration"
  | "ballot_request"
  | "recommended_mail"
  | "election_day"
  | "cure";

export const DEADLINE_TYPE_LABEL: Record<DeadlineType, string> = {
  registration: "Registration deadline",
  ballot_request: "Ballot request deadline",
  recommended_mail: "Recommended mail-by date",
  election_day: "Election Day",
  cure: "Ballot cure deadline",
};

export interface Deadline {
  id: number;
  jurisdiction: string; // state code or 'US'
  type: DeadlineType;
  date: string; // YYYY-MM-DD
  sourceUrl: string;
  note: string;
  verifiedAt: string;
}

export type Population =
  | "college"
  | "off_campus"
  | "on_leave"
  | "visiting"
  | "affiliate";

export const POPULATION_LABEL: Record<Population, string> = {
  college: "College resident",
  off_campus: "Off-campus",
  on_leave: "On leave",
  visiting: "Visiting",
  affiliate: "Affiliate",
};

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
  voter_confirmed: "Confirmed registered",
  pending: "Registration pending",
  no_match: "No match found",
  needs_registration: "Registration needed",
  application_submitted: "Application submitted",
  lookup_required: "Official lookup required",
  manual_help: "Manual help needed",
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
  already_completed: "Already completed",
  opted_out: "Opted out",
  needs_help: "Needs help",
};

/** Outcome → resulting contact status */
export const OUTCOME_TO_STATUS: Record<ContactOutcome, ContactStatus> = {
  no_answer: "attempted",
  contacted: "contacted",
  come_back: "follow_up",
  wrong_room: "follow_up",
  moved: "moved",
  already_completed: "contacted",
  opted_out: "opted_out",
  needs_help: "follow_up",
};

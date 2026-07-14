import { neon } from "@neondatabase/serverless";
import {
  ContactAttempt,
  ContactOutcome,
  OUTCOME_TO_STATUS,
  Person,
  Role,
  Staff,
  StateRule,
} from "./types";
import { seedPeople } from "./roster";
import { JURISDICTIONS } from "./jurisdictions";

const sql = neon(process.env.DATABASE_URL!);

interface PersonRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  class_year: string;
  house: string | null;
  building: string;
  room: string;
  suite_raw: string;
  home_city: string;
  home_state: string;
  home_zip: string;
  contact_status: string;
  registration_status: string;
  ballot_status: string;
  plan_status: string;
  jurisdiction: string | null;
  method: string | null;
  mailbox: string;
  ballot_address: string;
  assigned_to: string | null;
  unit_id: string | null;
  entryway: string;
  population: string;
  active: boolean;
  turf_id: string | null;
}

function rowToPerson(r: PersonRow, history: ContactAttempt[]): Person {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    classYear: r.class_year,
    house: r.house,
    building: r.building,
    room: r.room,
    suiteRaw: r.suite_raw,
    homeCity: r.home_city,
    homeState: r.home_state,
    homeZip: r.home_zip,
    contactStatus: r.contact_status as Person["contactStatus"],
    registrationStatus: r.registration_status as Person["registrationStatus"],
    ballotStatus: r.ballot_status as Person["ballotStatus"],
    planStatus: r.plan_status as Person["planStatus"],
    jurisdiction: r.jurisdiction as Person["jurisdiction"],
    method: r.method as Person["method"],
    mailbox: r.mailbox,
    ballotAddress: r.ballot_address,
    assignedTo: r.assigned_to,
    unitId: r.unit_id,
    entryway: r.entryway,
    population: r.population as Person["population"],
    active: r.active,
    turfId: r.turf_id,
    history,
  };
}

// ---------------------------------------------------------------- staff

interface StaffRow {
  email: string;
  role: Role;
  scope: string | null;
  display_name: string;
}

const rowToStaff = (r: StaffRow): Staff => ({
  email: r.email,
  role: r.role,
  scope: r.scope,
  displayName: r.display_name,
});

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  const normalized = email.toLowerCase();
  const rows = (await sql`SELECT * FROM staff WHERE email = ${normalized}`) as StaffRow[];
  if (rows.length > 0) return rowToStaff(rows[0]);

  // Lockout protection for fresh databases: the bootstrap admin email may
  // self-provision the first staff row.
  const bootstrap = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  if (bootstrap && normalized === bootstrap) {
    const [{ count }] = (await sql`SELECT count(*)::int AS count FROM staff`) as [
      { count: number },
    ];
    if (count === 0) {
      await sql`INSERT INTO staff (email, role) VALUES (${normalized}, 'admin')`;
      return { email: normalized, role: "admin", scope: null, displayName: "" };
    }
  }
  return null;
}

export async function listStaff(viewer: Staff): Promise<Staff[]> {
  const rows = (await sql`SELECT * FROM staff ORDER BY role, email`) as StaffRow[];
  const all = rows.map(rowToStaff);
  if (viewer.role === "admin") return all;
  if (viewer.role === "captain")
    return all.filter((s) => s.scope === viewer.scope || s.email === viewer.email);
  return all.filter((s) => s.email === viewer.email);
}

export async function upsertStaff(
  actor: Staff,
  target: { email: string; role: Role; scope?: string | null; displayName?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = target.email.toLowerCase().trim();
  if (!email.includes("@")) return { ok: false, error: "Invalid email" };

  if (actor.role === "captain") {
    // Captains manage only organizers/volunteers inside their own scope.
    if (target.role === "admin" || target.role === "captain")
      return { ok: false, error: "Captains cannot grant admin or captain roles" };
    if ((target.scope ?? actor.scope) !== actor.scope)
      return { ok: false, error: "Captains can only add staff to their own scope" };
    target = { ...target, scope: actor.scope };
  } else if (actor.role !== "admin") {
    return { ok: false, error: "Not permitted" };
  }
  if (email === actor.email && target.role !== actor.role)
    return { ok: false, error: "You cannot change your own role" };

  await sql`
    INSERT INTO staff (email, role, scope, display_name)
    VALUES (${email}, ${target.role}, ${target.scope ?? null}, ${target.displayName ?? ""})
    ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role, scope = EXCLUDED.scope,
        display_name = CASE WHEN EXCLUDED.display_name = '' THEN staff.display_name ELSE EXCLUDED.display_name END`;
  return { ok: true };
}

export async function deleteStaff(
  actor: Staff,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actor.role !== "admin") return { ok: false, error: "Not permitted" };
  const normalized = email.toLowerCase();
  if (normalized === actor.email)
    return { ok: false, error: "You cannot remove yourself" };
  await sql`DELETE FROM staff WHERE email = ${normalized}`;
  return { ok: true };
}

// ---------------------------------------------------------------- people

/** Whether this staff member may see and act on this person. */
function inScope(staff: Staff, p: { house: string | null; building: string; assigned_to?: string | null; assignedTo?: string | null }): boolean {
  if (staff.role === "admin") return true;
  if (staff.role === "captain")
    return p.house === staff.scope || p.building === staff.scope;
  if (staff.role === "organizer")
    return (p.assigned_to ?? p.assignedTo) === staff.email;
  return false; // field volunteers use the field endpoints only
}

export async function insertPeople(people: Person[]): Promise<number> {
  let added = 0;
  for (const p of people) {
    const res = await sql`
      INSERT INTO people (
        id, first_name, last_name, email, phone, class_year, house,
        building, room, suite_raw, home_city, home_state, home_zip,
        unit_id, entryway, population, jurisdiction
      ) VALUES (
        ${p.id}, ${p.firstName}, ${p.lastName}, ${p.email}, ${p.phone},
        ${p.classYear}, ${p.house}, ${p.building}, ${p.room}, ${p.suiteRaw},
        ${p.homeCity}, ${p.homeState}, ${p.homeZip},
        ${p.unitId}, ${p.entryway}, ${p.population}, ${p.jurisdiction}
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id`;
    if (res.length > 0) added++;
  }
  return added;
}

export async function getPeople(staff: Staff): Promise<Person[]> {
  if (staff.role === "field") return [];

  const [{ count }] = (await sql`SELECT count(*)::int AS count FROM people`) as [
    { count: number },
  ];
  if (count === 0) await insertPeople(seedPeople());

  let rows: PersonRow[];
  if (staff.role === "admin") {
    rows = (await sql`SELECT * FROM people ORDER BY last_name, first_name`) as PersonRow[];
  } else if (staff.role === "captain") {
    rows = (await sql`
      SELECT p.* FROM people p
      LEFT JOIN turfs t ON p.turf_id = t.id
      WHERE p.active AND (
        p.house = ${staff.scope} OR p.building = ${staff.scope}
        OR p.unit_id = ${staff.scope?.toLowerCase() ?? ""}
        OR t.captain_email = ${staff.email}
      )
      ORDER BY p.last_name, p.first_name`) as PersonRow[];
  } else {
    rows = (await sql`
      SELECT * FROM people WHERE active AND assigned_to = ${staff.email}
      ORDER BY last_name, first_name`) as PersonRow[];
  }
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const attempts = (await sql`
    SELECT person_id, outcome, occurred_at
    FROM contact_attempts WHERE person_id = ANY(${ids})
    ORDER BY occurred_at`) as {
    person_id: string;
    outcome: ContactOutcome;
    occurred_at: string;
  }[];

  const historyByPerson = new Map<string, ContactAttempt[]>();
  for (const a of attempts) {
    if (!historyByPerson.has(a.person_id)) historyByPerson.set(a.person_id, []);
    historyByPerson.get(a.person_id)!.push({
      outcome: a.outcome,
      at: new Date(a.occurred_at).toISOString(),
    });
  }
  return rows.map((r) => rowToPerson(r, historyByPerson.get(r.id) ?? []));
}

export async function getPersonById(id: string): Promise<Person | null> {
  const rows = (await sql`SELECT * FROM people WHERE id = ${id}`) as PersonRow[];
  if (rows.length === 0) return null;
  const attempts = (await sql`
    SELECT outcome, occurred_at FROM contact_attempts
    WHERE person_id = ${id} ORDER BY occurred_at`) as {
    outcome: ContactOutcome;
    occurred_at: string;
  }[];
  return rowToPerson(
    rows[0],
    attempts.map((a) => ({ outcome: a.outcome, at: new Date(a.occurred_at).toISOString() })),
  );
}

async function requirePersonInScope(
  staff: Staff,
  id: string,
): Promise<PersonRow | null> {
  const rows = (await sql`
    SELECT p.*, t.captain_email AS turf_captain FROM people p
    LEFT JOIN turfs t ON p.turf_id = t.id
    WHERE p.id = ${id}`) as (PersonRow & { turf_captain: string | null })[];
  if (rows.length === 0) return null;
  if (staff.role === "captain" && rows[0].turf_captain === staff.email) return rows[0];
  if (!inScope(staff, rows[0])) return null;
  return rows[0];
}

/**
 * Import upsert: inserts new people; for an existing email, updates
 * identity/location fields and reactivates. Statuses are never touched.
 */
export async function importPeople(
  people: Person[],
): Promise<{ added: number; updated: number; unchanged: number }> {
  let added = 0;
  let updated = 0;
  const unchanged = 0;
  for (const p of people) {
    const res = (await sql`
      INSERT INTO people (
        id, first_name, last_name, email, phone, class_year, house,
        building, room, suite_raw, home_city, home_state, home_zip,
        unit_id, entryway, population
      ) VALUES (
        ${p.id}, ${p.firstName}, ${p.lastName}, ${p.email}, ${p.phone},
        ${p.classYear}, ${p.house}, ${p.building}, ${p.room}, ${p.suiteRaw},
        ${p.homeCity}, ${p.homeState}, ${p.homeZip},
        ${p.unitId}, ${p.entryway}, ${p.population}
      )
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        class_year = CASE WHEN EXCLUDED.class_year = '' THEN people.class_year ELSE EXCLUDED.class_year END,
        phone = CASE WHEN EXCLUDED.phone = '' THEN people.phone ELSE EXCLUDED.phone END,
        home_city = CASE WHEN EXCLUDED.home_city = '' THEN people.home_city ELSE EXCLUDED.home_city END,
        home_state = CASE WHEN EXCLUDED.home_state = '' THEN people.home_state ELSE EXCLUDED.home_state END,
        home_zip = CASE WHEN EXCLUDED.home_zip = '' THEN people.home_zip ELSE EXCLUDED.home_zip END,
        house = EXCLUDED.house,
        building = EXCLUDED.building,
        room = EXCLUDED.room,
        suite_raw = EXCLUDED.suite_raw,
        unit_id = EXCLUDED.unit_id,
        entryway = EXCLUDED.entryway,
        active = true,
        updated_at = now()
      RETURNING (xmax = 0) AS inserted`) as { inserted: boolean }[];
    if (res[0]?.inserted) added++;
    else updated++;
  }
  // "updated" includes rows whose values happened to be identical; callers
  // that need the distinction compute it in the preview step.
  return { added, updated, unchanged };
}

/** Merge duplicate records: history and missing fields move to the target. */
export async function mergePeople(
  staff: Staff,
  sourceId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  if (sourceId === targetId)
    return { ok: false, error: "Cannot merge a person into themselves" };
  const source = (await sql`SELECT * FROM people WHERE id = ${sourceId}`) as PersonRow[];
  const target = (await sql`SELECT * FROM people WHERE id = ${targetId}`) as PersonRow[];
  if (!source.length || !target.length)
    return { ok: false, error: "Person not found" };

  await sql`UPDATE contact_attempts SET person_id = ${targetId} WHERE person_id = ${sourceId}`;
  const s = source[0];
  await sql`
    UPDATE people SET
      phone = CASE WHEN phone = '' THEN ${s.phone} ELSE phone END,
      class_year = CASE WHEN class_year = '' THEN ${s.class_year} ELSE class_year END,
      home_city = CASE WHEN home_city = '' THEN ${s.home_city} ELSE home_city END,
      home_state = CASE WHEN home_state = '' THEN ${s.home_state} ELSE home_state END,
      home_zip = CASE WHEN home_zip = '' THEN ${s.home_zip} ELSE home_zip END,
      mailbox = CASE WHEN mailbox = '' THEN ${s.mailbox} ELSE mailbox END,
      assigned_to = COALESCE(assigned_to, ${s.assigned_to}),
      updated_at = now()
    WHERE id = ${targetId}`;
  await sql`DELETE FROM people WHERE id = ${sourceId}`;
  return { ok: true };
}

/** Columns a client is allowed to update, keyed by Person field. */
const PATCHABLE: Record<string, string> = {
  contactStatus: "contact_status",
  registrationStatus: "registration_status",
  ballotStatus: "ballot_status",
  planStatus: "plan_status",
  jurisdiction: "jurisdiction",
  method: "method",
  mailbox: "mailbox",
  ballotAddress: "ballot_address",
};

/** Identity/location fields only admins may edit. */
const ADMIN_PATCHABLE: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  classYear: "class_year",
  phone: "phone",
  homeCity: "home_city",
  homeState: "home_state",
  homeZip: "home_zip",
  house: "house",
  building: "building",
  entryway: "entryway",
  room: "room",
  suiteRaw: "suite_raw",
  unitId: "unit_id",
  population: "population",
  active: "active",
  turfId: "turf_id",
};

export async function updatePerson(
  staff: Staff,
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  if (!(await requirePersonInScope(staff, id))) return false;

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(PATCHABLE)) {
    if (field in patch) {
      values.push(patch[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  // Only admins and captains reassign people.
  if ("assignedTo" in patch && (staff.role === "admin" || staff.role === "captain")) {
    values.push(patch.assignedTo || null);
    sets.push(`assigned_to = $${values.length}`);
  }
  // Identity and residence edits (move, deactivate, regroup) are admin-only.
  if (staff.role === "admin") {
    for (const [field, column] of Object.entries(ADMIN_PATCHABLE)) {
      if (field in patch) {
        values.push(patch[field]);
        sets.push(`${column} = $${values.length}`);
      }
    }
  }
  if (sets.length === 0) return false;
  values.push(id);
  const res = await sql.query(
    `UPDATE people SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length} RETURNING id`,
    values,
  );
  return res.length > 0;
}

/** Voter self-service update — no staff scope; caller must verify the token. */
export async function updatePersonAsVoter(
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const allowed: Record<string, string> = {
    jurisdiction: "jurisdiction",
    method: "method",
    mailbox: "mailbox",
    ballotAddress: "ballot_address",
    registrationStatus: "registration_status",
    ballotStatus: "ballot_status",
    planStatus: "plan_status",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(allowed)) {
    if (field in patch) {
      values.push(patch[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return false;
  values.push(id);
  const res = await sql.query(
    `UPDATE people SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length} RETURNING id`,
    values,
  );
  return res.length > 0;
}

export async function addOutcome(
  staff: Staff,
  id: string,
  outcome: ContactOutcome,
): Promise<boolean> {
  if (staff.role === "field") {
    // Field volunteers may record only a plain "contacted".
    if (outcome !== "contacted") return false;
  } else if (!(await requirePersonInScope(staff, id))) {
    return false;
  }
  await sql`INSERT INTO contact_attempts (person_id, outcome) VALUES (${id}, ${outcome})`;
  await sql`
    UPDATE people SET contact_status = ${OUTCOME_TO_STATUS[outcome]}, updated_at = now()
    WHERE id = ${id}`;
  return true;
}

export async function undoOutcome(staff: Staff, id: string): Promise<boolean> {
  if (!(await requirePersonInScope(staff, id))) return false;
  await sql`
    DELETE FROM contact_attempts
    WHERE id = (
      SELECT id FROM contact_attempts
      WHERE person_id = ${id}
      ORDER BY occurred_at DESC, id DESC LIMIT 1
    )`;
  const remaining = (await sql`
    SELECT outcome FROM contact_attempts
    WHERE person_id = ${id}
    ORDER BY occurred_at DESC, id DESC LIMIT 1`) as { outcome: ContactOutcome }[];
  const status = remaining.length
    ? OUTCOME_TO_STATUS[remaining[0].outcome]
    : "uncontacted";
  await sql`UPDATE people SET contact_status = ${status}, updated_at = now() WHERE id = ${id}`;
  return true;
}

// ---------------------------------------------------------------- state rules

interface StateRuleRow {
  jurisdiction: string;
  name: string;
  election_date: string | null;
  registration_deadline: string | null;
  online_registration: boolean | null;
  same_day_registration: boolean | null;
  mail_request_required: boolean | null;
  mail_request_deadline: string | null;
  ballot_return_deadline: string | null;
  return_deadline_basis: "postmark" | "receipt" | null;
  witness_required: boolean | null;
  notary_required: boolean | null;
  id_required: boolean | null;
  postage_required: boolean | null;
  early_voting_start: string | null;
  early_voting_end: string | null;
  polling_place_url: string | null;
  ballot_tracking_url: string | null;
  sample_ballot_url: string | null;
  source_url: string | null;
  reviewed_at: string | null;
  published: boolean;
}

const d = (v: unknown): string | null =>
  v == null ? null : typeof v === "string" ? v : new Date(v as string).toISOString().slice(0, 10);

function rowToRule(r: StateRuleRow): StateRule {
  return {
    jurisdiction: r.jurisdiction,
    name: r.name,
    electionDate: d(r.election_date),
    registrationDeadline: d(r.registration_deadline),
    onlineRegistration: r.online_registration,
    sameDayRegistration: r.same_day_registration,
    mailRequestRequired: r.mail_request_required,
    mailRequestDeadline: d(r.mail_request_deadline),
    ballotReturnDeadline: d(r.ballot_return_deadline),
    returnDeadlineBasis: r.return_deadline_basis,
    witnessRequired: r.witness_required,
    notaryRequired: r.notary_required,
    idRequired: r.id_required,
    postageRequired: r.postage_required,
    earlyVotingStart: d(r.early_voting_start),
    earlyVotingEnd: d(r.early_voting_end),
    pollingPlaceUrl: r.polling_place_url,
    ballotTrackingUrl: r.ballot_tracking_url,
    sampleBallotUrl: r.sample_ballot_url,
    sourceUrl: r.source_url,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    published: r.published,
  };
}

/** Witness / notary / ID structural flags from the campaign rule matrix. */
const MATRIX_WITNESS = new Set(["AL", "AK", "AR", "LA", "MN", "NC", "SC", "WI"]);
const MATRIX_NOTARY = new Set(["MS", "MO", "OK"]);
const MATRIX_ID = new Set(["AR", "NC", "GA", "KS", "OH", "TX", "TN", "MN"]);

/** Seed unpublished structural drafts for every jurisdiction once. */
async function ensureStateRules(): Promise<void> {
  const [{ count }] = (await sql`SELECT count(*)::int AS count FROM state_rules`) as [
    { count: number },
  ];
  if (count >= Object.keys(JURISDICTIONS).length) return;
  for (const j of Object.values(JURISDICTIONS)) {
    const mailRequestRequired =
      j.mailModel === "ALL_MAIL" ? false : j.mailModel === "TERRITORY" ? null : true;
    await sql`
      INSERT INTO state_rules (jurisdiction, name, mail_request_required,
        witness_required, notary_required, id_required, published)
      VALUES (${j.code}, ${j.name}, ${mailRequestRequired},
        ${MATRIX_WITNESS.has(j.code) ? true : null},
        ${MATRIX_NOTARY.has(j.code) ? true : null},
        ${MATRIX_ID.has(j.code) ? true : null},
        false)
      ON CONFLICT (jurisdiction) DO NOTHING`;
  }
}

export async function listStateRules(publishedOnly: boolean): Promise<StateRule[]> {
  await ensureStateRules();
  const rows = (publishedOnly
    ? await sql`SELECT * FROM state_rules WHERE published ORDER BY name`
    : await sql`SELECT * FROM state_rules ORDER BY name`) as StateRuleRow[];
  return rows.map(rowToRule);
}

const RULE_COLUMNS: Record<string, string> = {
  electionDate: "election_date",
  registrationDeadline: "registration_deadline",
  onlineRegistration: "online_registration",
  sameDayRegistration: "same_day_registration",
  mailRequestRequired: "mail_request_required",
  mailRequestDeadline: "mail_request_deadline",
  ballotReturnDeadline: "ballot_return_deadline",
  returnDeadlineBasis: "return_deadline_basis",
  witnessRequired: "witness_required",
  notaryRequired: "notary_required",
  idRequired: "id_required",
  postageRequired: "postage_required",
  earlyVotingStart: "early_voting_start",
  earlyVotingEnd: "early_voting_end",
  pollingPlaceUrl: "polling_place_url",
  ballotTrackingUrl: "ballot_tracking_url",
  sampleBallotUrl: "sample_ballot_url",
  sourceUrl: "source_url",
};

/**
 * Save a rule. Publishing requires an official source URL and stamps
 * reviewed_at — that is the whole "review and publish" flow, deliberately.
 */
export async function saveStateRule(
  staff: Staff,
  jurisdiction: string,
  patch: Record<string, unknown>,
  publish: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(RULE_COLUMNS)) {
    if (field in patch) {
      values.push(patch[field] === "" ? null : patch[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (publish) {
    const sourceUrl = (patch.sourceUrl as string) || null;
    if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) {
      return { ok: false, error: "Publishing requires an official source URL" };
    }
    sets.push(`published = true`, `reviewed_at = now()`);
  } else {
    sets.push(`published = false`);
  }
  values.push(jurisdiction.toUpperCase());
  await sql.query(
    `UPDATE state_rules SET ${sets.join(", ")} WHERE jurisdiction = $${values.length}`,
    values,
  );
  return { ok: true };
}

// ---------------------------------------------------------------- units

export async function listUnits() {
  const rows = (await sql`
    SELECT id, name, type, mail_street FROM residential_units ORDER BY type, name`) as {
    id: string;
    name: string;
    type: string;
    mail_street: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    mailStreet: r.mail_street,
  }));
}

export async function updateUnitMailStreet(
  staff: Staff,
  id: string,
  mailStreet: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  await sql`UPDATE residential_units SET mail_street = ${mailStreet || null} WHERE id = ${id}`;
  return { ok: true };
}

// ------------------------------------------------------- registration checks

const CHECK_RESULT_TO_STATUS: Record<string, string> = {
  confirmed: "voter_confirmed",
  pending: "pending",
  no_match: "no_match",
  needs_registration: "needs_registration",
  application_submitted: "application_submitted",
  manual_help: "manual_help",
};

/**
 * Record the outcome of an official-lookup registration check. Stores only
 * status, jurisdiction, source, and time — never the lookup inputs.
 */
export async function recordRegistrationCheck(
  personId: string,
  jurisdiction: string,
  result: string,
  source: "voter_confirmed" | "organizer_recorded",
): Promise<boolean> {
  const status = CHECK_RESULT_TO_STATUS[result];
  if (!status) return false;
  await sql`
    INSERT INTO registration_checks (person_id, jurisdiction, status, source)
    VALUES (${personId}, ${jurisdiction}, ${status}, ${source})`;
  await sql`
    UPDATE people SET registration_status = ${status}, updated_at = now()
    WHERE id = ${personId}`;
  return true;
}

// ---------------------------------------------------------------- turfs

interface TurfRow {
  id: string;
  name: string;
  captain_email: string | null;
  organizer_email: string | null;
  members: number;
  contacted: number;
  uncontacted: number;
  follow_ups: number;
}

function rowToTurf(r: TurfRow) {
  return {
    id: r.id,
    name: r.name,
    captainEmail: r.captain_email,
    organizerEmail: r.organizer_email,
    members: Number(r.members),
    contacted: Number(r.contacted),
    uncontacted: Number(r.uncontacted),
    followUps: Number(r.follow_ups),
  };
}

export async function listTurfs(staff: Staff) {
  const rows = (await sql`
    SELECT t.id, t.name, t.captain_email, t.organizer_email,
      count(p.id) AS members,
      count(*) FILTER (WHERE p.contact_status = 'contacted') AS contacted,
      count(*) FILTER (WHERE p.contact_status = 'uncontacted') AS uncontacted,
      count(*) FILTER (WHERE p.contact_status = 'follow_up') AS follow_ups
    FROM turfs t
    LEFT JOIN people p ON p.turf_id = t.id AND p.active
    GROUP BY t.id ORDER BY t.name`) as TurfRow[];
  const all = rows.map(rowToTurf);
  if (staff.role === "admin") return all;
  if (staff.role === "captain")
    return all.filter((t) => t.captainEmail === staff.email);
  return all.filter((t) => t.organizerEmail === staff.email);
}

/** Residential-proximity order used for turf building and splitting. */
const PROXIMITY_ORDER = `ORDER BY building, entryway, room, last_name`;

/**
 * Create turfs from a slice of the residential hierarchy. With targetSize,
 * students are chunked into turfs of roughly that size in residential order.
 */
export async function createTurfs(
  staff: Staff,
  opts: {
    baseName: string;
    unitId?: string;
    building?: string;
    onlyUnassigned: boolean;
    targetSize?: number;
    captainEmail?: string | null;
    organizerEmail?: string | null;
  },
): Promise<{ ok: true; created: string[] } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };

  const conditions = ["active", "population != 'affiliate'"];
  const params: unknown[] = [];
  if (opts.unitId) {
    params.push(opts.unitId);
    conditions.push(`unit_id = $${params.length}`);
  }
  if (opts.building) {
    params.push(opts.building);
    conditions.push(`building = $${params.length}`);
  }
  if (opts.onlyUnassigned) conditions.push("turf_id IS NULL");

  const people = (await sql.query(
    `SELECT id FROM people WHERE ${conditions.join(" AND ")} ${PROXIMITY_ORDER}`,
    params,
  )) as { id: string }[];
  if (people.length === 0) return { ok: false, error: "No matching students" };

  const size = opts.targetSize && opts.targetSize > 0 ? opts.targetSize : people.length;
  const chunkCount = Math.ceil(people.length / size);
  const created: string[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const name = chunkCount === 1 ? opts.baseName : `${opts.baseName} ${i + 1}`;
    const [turf] = (await sql`
      INSERT INTO turfs (name, captain_email, organizer_email)
      VALUES (${name}, ${opts.captainEmail ?? null}, ${opts.organizerEmail ?? null})
      RETURNING id`) as { id: string }[];
    const ids = people.slice(i * size, (i + 1) * size).map((p) => p.id);
    await sql`
      UPDATE people SET turf_id = ${turf.id},
        assigned_to = COALESCE(${opts.organizerEmail ?? null}, assigned_to),
        updated_at = now()
      WHERE id = ANY(${ids})`;
    created.push(turf.id);
  }
  return { ok: true, created };
}

/** Rename or re-staff a turf. A new organizer cascades to all members. */
export async function updateTurf(
  staff: Staff,
  id: string,
  patch: { name?: string; captainEmail?: string | null; organizerEmail?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = (await sql`SELECT * FROM turfs WHERE id = ${id}`) as {
    captain_email: string | null;
  }[];
  if (!rows.length) return { ok: false, error: "Turf not found" };
  const mayManage =
    staff.role === "admin" ||
    (staff.role === "captain" && rows[0].captain_email === staff.email);
  if (!mayManage) return { ok: false, error: "Not permitted" };
  if ("captainEmail" in patch && staff.role !== "admin")
    return { ok: false, error: "Only admins change captains" };

  if (patch.name !== undefined)
    await sql`UPDATE turfs SET name = ${patch.name} WHERE id = ${id}`;
  if ("captainEmail" in patch)
    await sql`UPDATE turfs SET captain_email = ${patch.captainEmail ?? null} WHERE id = ${id}`;
  if ("organizerEmail" in patch) {
    await sql`UPDATE turfs SET organizer_email = ${patch.organizerEmail ?? null} WHERE id = ${id}`;
    // Reassign members; contact history lives on the person and is preserved.
    await sql`
      UPDATE people SET assigned_to = ${patch.organizerEmail ?? null}, updated_at = now()
      WHERE turf_id = ${id}`;
  }
  return { ok: true };
}

/** Split a turf in half along residential order; second half gets a new turf. */
export async function splitTurf(
  staff: Staff,
  id: string,
): Promise<{ ok: true; newId: string } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  const turf = (await sql`SELECT * FROM turfs WHERE id = ${id}`) as {
    name: string;
    captain_email: string | null;
  }[];
  if (!turf.length) return { ok: false, error: "Turf not found" };

  const members = (await sql.query(
    `SELECT id FROM people WHERE turf_id = $1 AND active ${PROXIMITY_ORDER}`,
    [id],
  )) as { id: string }[];
  if (members.length < 2) return { ok: false, error: "Too small to split" };

  const [next] = (await sql`
    INSERT INTO turfs (name, captain_email)
    VALUES (${turf[0].name + " (split)"}, ${turf[0].captain_email})
    RETURNING id`) as { id: string }[];
  const secondHalf = members.slice(Math.ceil(members.length / 2)).map((m) => m.id);
  await sql`
    UPDATE people SET turf_id = ${next.id}, updated_at = now()
    WHERE id = ANY(${secondHalf})`;
  return { ok: true, newId: next.id };
}

/** Merge source turf into target; members adopt the target's organizer. */
export async function mergeTurfs(
  staff: Staff,
  sourceId: string,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  if (sourceId === targetId) return { ok: false, error: "Pick two different turfs" };
  const target = (await sql`SELECT organizer_email FROM turfs WHERE id = ${targetId}`) as {
    organizer_email: string | null;
  }[];
  if (!target.length) return { ok: false, error: "Target turf not found" };

  await sql`
    UPDATE people SET turf_id = ${targetId},
      assigned_to = COALESCE(${target[0].organizer_email}, assigned_to),
      updated_at = now()
    WHERE turf_id = ${sourceId}`;
  await sql`DELETE FROM turfs WHERE id = ${sourceId}`;
  return { ok: true };
}

/** Dissolve a turf; members keep their organizer and contact history. */
export async function deleteTurf(
  staff: Staff,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  await sql`DELETE FROM turfs WHERE id = ${id}`; // people.turf_id → NULL via FK
  return { ok: true };
}

/** Organizer workload: assigned people and open follow-ups per organizer. */
export async function organizerWorkload() {
  const rows = (await sql`
    SELECT assigned_to AS email, count(*) AS assigned,
      count(*) FILTER (WHERE contact_status = 'follow_up') AS follow_ups,
      count(*) FILTER (WHERE contact_status = 'uncontacted') AS uncontacted
    FROM people WHERE active AND assigned_to IS NOT NULL
    GROUP BY assigned_to ORDER BY count(*) DESC`) as {
    email: string;
    assigned: number;
    follow_ups: number;
    uncontacted: number;
  }[];
  return rows.map((r) => ({
    email: r.email,
    assigned: Number(r.assigned),
    followUps: Number(r.follow_ups),
    uncontacted: Number(r.uncontacted),
  }));
}

// ---------------------------------------------------------------- deadlines

interface DeadlineRow {
  id: number;
  jurisdiction: string;
  type: string;
  date: string;
  source_url: string;
  note: string;
  verified_at: string;
}

export async function listDeadlines() {
  const rows = (await sql`SELECT * FROM deadlines ORDER BY date, jurisdiction`) as DeadlineRow[];
  return rows.map((r) => ({
    id: r.id,
    jurisdiction: r.jurisdiction,
    type: r.type,
    date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10),
    sourceUrl: r.source_url,
    note: r.note,
    verifiedAt: new Date(r.verified_at).toISOString(),
  }));
}

export async function addDeadline(
  staff: Staff,
  d: { jurisdiction: string; type: string; date: string; sourceUrl: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  if (!/^https?:\/\//.test(d.sourceUrl))
    return { ok: false, error: "A source URL from the official site is required" };
  await sql`
    INSERT INTO deadlines (jurisdiction, type, date, source_url, note)
    VALUES (${d.jurisdiction.toUpperCase()}, ${d.type}, ${d.date}, ${d.sourceUrl}, ${d.note ?? ""})`;
  return { ok: true };
}

export async function deleteDeadline(
  staff: Staff,
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (staff.role !== "admin") return { ok: false, error: "Admins only" };
  await sql`DELETE FROM deadlines WHERE id = ${id}`;
  return { ok: true };
}

// ---------------------------------------------------------------- field mode

/** Minimal, non-residential person search for tabling. */
export async function fieldSearch(q: string): Promise<
  {
    id: string;
    name: string;
    classYear: string;
    contactStatus: string;
    homeState: string;
    jurisdiction: string | null;
    registrationStatus: string;
  }[]
> {
  const needle = `%${q.trim()}%`;
  const rows = (await sql`
    SELECT id, first_name, last_name, class_year, contact_status,
           home_state, jurisdiction, registration_status
    FROM people
    WHERE active AND (email ILIKE ${needle}
       OR (first_name || ' ' || last_name) ILIKE ${needle})
    ORDER BY last_name LIMIT 8`) as {
    id: string;
    first_name: string;
    last_name: string;
    class_year: string;
    contact_status: string;
    home_state: string;
    jurisdiction: string | null;
    registration_status: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name}`,
    classYear: r.class_year,
    contactStatus: r.contact_status,
    homeState: r.home_state,
    jurisdiction: r.jurisdiction,
    registrationStatus: r.registration_status,
  }));
}

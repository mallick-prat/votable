import { neon } from "@neondatabase/serverless";
import {
  ContactAttempt,
  ContactOutcome,
  OUTCOME_TO_STATUS,
  Person,
  Role,
  Staff,
} from "./types";
import { seedPeople } from "./roster";

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
  assigned_to: string | null;
  unit_id: string | null;
  entryway: string;
  population: string;
  active: boolean;
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
    assignedTo: r.assigned_to,
    unitId: r.unit_id,
    entryway: r.entryway,
    population: r.population as Person["population"],
    active: r.active,
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
        unit_id, entryway, population
      ) VALUES (
        ${p.id}, ${p.firstName}, ${p.lastName}, ${p.email}, ${p.phone},
        ${p.classYear}, ${p.house}, ${p.building}, ${p.room}, ${p.suiteRaw},
        ${p.homeCity}, ${p.homeState}, ${p.homeZip},
        ${p.unitId}, ${p.entryway}, ${p.population}
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
      SELECT * FROM people
      WHERE active AND (house = ${staff.scope} OR building = ${staff.scope} OR unit_id = ${staff.scope?.toLowerCase() ?? ""})
      ORDER BY last_name, first_name`) as PersonRow[];
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
  const rows = (await sql`SELECT * FROM people WHERE id = ${id}`) as PersonRow[];
  if (rows.length === 0 || !inScope(staff, rows[0])) return null;
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

// ---------------------------------------------------------------- field mode

/** Minimal, non-residential person search for tabling. */
export async function fieldSearch(
  q: string,
): Promise<{ id: string; name: string; classYear: string; contactStatus: string }[]> {
  const needle = `%${q.trim()}%`;
  const rows = (await sql`
    SELECT id, first_name, last_name, class_year, contact_status FROM people
    WHERE email ILIKE ${needle}
       OR (first_name || ' ' || last_name) ILIKE ${needle}
    ORDER BY last_name LIMIT 8`) as {
    id: string;
    first_name: string;
    last_name: string;
    class_year: string;
    contact_status: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name}`,
    classYear: r.class_year,
    contactStatus: r.contact_status,
  }));
}

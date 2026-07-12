import { neon } from "@neondatabase/serverless";
import {
  ContactAttempt,
  ContactOutcome,
  OUTCOME_TO_STATUS,
  Person,
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
    history,
  };
}

export async function insertPeople(people: Person[]): Promise<number> {
  let added = 0;
  for (const p of people) {
    const res = await sql`
      INSERT INTO people (
        id, first_name, last_name, email, phone, class_year, house,
        building, room, suite_raw, home_city, home_state, home_zip
      ) VALUES (
        ${p.id}, ${p.firstName}, ${p.lastName}, ${p.email}, ${p.phone},
        ${p.classYear}, ${p.house}, ${p.building}, ${p.room}, ${p.suiteRaw},
        ${p.homeCity}, ${p.homeState}, ${p.homeZip}
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id`;
    if (res.length > 0) added++;
  }
  return added;
}

export async function getPeople(): Promise<Person[]> {
  const [{ count }] = (await sql`SELECT count(*)::int AS count FROM people`) as [
    { count: number },
  ];
  if (count === 0) await insertPeople(seedPeople());

  const rows = (await sql`SELECT * FROM people ORDER BY last_name, first_name`) as PersonRow[];
  const attempts = (await sql`
    SELECT person_id, outcome, occurred_at
    FROM contact_attempts ORDER BY occurred_at`) as {
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

export async function updatePerson(
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(PATCHABLE)) {
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
  id: string,
  outcome: ContactOutcome,
): Promise<void> {
  await sql`INSERT INTO contact_attempts (person_id, outcome) VALUES (${id}, ${outcome})`;
  await sql`
    UPDATE people SET contact_status = ${OUTCOME_TO_STATUS[outcome]}, updated_at = now()
    WHERE id = ${id}`;
}

export async function undoOutcome(id: string): Promise<void> {
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
}

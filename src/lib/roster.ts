import { Person } from "./types";
import { HOUSES } from "./mail";

/**
 * Parse a Harvard suite string into house / building / room.
 * "Mather B-433" → house Mather; "20 DeWolfe 33" → swing housing building.
 */
export function parseSuite(suite: string): {
  house: string | null;
  building: string;
  room: string;
} {
  const trimmed = suite.trim();
  const tokens = trimmed.split(/\s+/);
  const first = tokens[0];
  const houseMatch = HOUSES.find(
    (h) => h.toLowerCase() === first?.toLowerCase(),
  );
  if (houseMatch) {
    return {
      house: houseMatch,
      building: houseMatch,
      room: tokens.slice(1).join(" ") || "—",
    };
  }
  if (tokens.length >= 2) {
    return {
      house: null,
      building: tokens.slice(0, -1).join(" "),
      room: tokens[tokens.length - 1],
    };
  }
  return { house: null, building: trimmed || "Unknown", room: "—" };
}

function idFromEmail(email: string): string {
  return email.toLowerCase().split("@")[0];
}

export interface ParsedRow {
  classYears?: string;
  year: string;
  firstName: string;
  lastName: string;
  email: string;
  suite: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
}

export function rowToPerson(r: ParsedRow): Person {
  const { house, building, room } = parseSuite(r.suite);
  return {
    id: idFromEmail(r.email),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email.toLowerCase(),
    phone: r.phone,
    classYear: r.year,
    house,
    building,
    room,
    suiteRaw: r.suite,
    homeCity: r.city,
    homeState: r.state.toUpperCase(),
    homeZip: r.zip,
    contactStatus: "uncontacted",
    registrationStatus: "unknown",
    ballotStatus: "not_started",
    planStatus: "none",
    jurisdiction: null,
    method: null,
    mailbox: "",
    history: [],
  };
}

/**
 * Parse pasted roster text. Accepts tab-separated (spreadsheet paste) or
 * comma-separated rows with the standard header:
 * Class Years, Year, first_name, last_name, email, suite, phone_number, city, state, zip
 */
export function parseRosterText(text: string): {
  rows: ParsedRow[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const cells = line.includes("\t")
      ? line.split("\t").map((c) => c.trim())
      : line.split(",").map((c) => c.trim());
    // Skip header rows
    if (/first_name/i.test(line) || /class\s*years/i.test(line)) continue;
    if (cells.length < 10) {
      errors.push(`Skipped (needs 10 columns, got ${cells.length}): ${line.slice(0, 60)}`);
      continue;
    }
    const [classYears, year, firstName, lastName, email, suite, phone, city, state, zip] =
      cells;
    if (!email.includes("@")) {
      errors.push(`Skipped (invalid email): ${line.slice(0, 60)}`);
      continue;
    }
    rows.push({ classYears, year, firstName, lastName, email, suite, phone, city, state, zip });
  }
  return { rows, errors };
}

// Fictional demo roster — the repo is public, so no real student data lives
// here. Import the real roster through the People page; it is stored only in
// the campaign database.
const SEED_TSV = `Sophomore	2025	Ada	Quill	aquill@demo.example	20 DeWolfe 33	617-555-0101	Clovis	CA	93619
Sophomore	2025	Ben	Marsh	bmarsh@demo.example	Mather B-433	617-555-0102	Chicago	IL	60637
Sophomore	2025	Cleo	Tran	ctran@demo.example	Inn 421	617-555-0103	Accokeek	MD	20607
Sophomore	2025	Dev	Okafor	dokafor@demo.example	20 DeWolfe 26	617-555-0104	Bethesda	MD	20817
Sophomore	2025	Elena	Voss	evoss@demo.example	Eliot J-21	617-555-0105	Carmel	IN	46032
Sophomore	2025	Farah	Idris	fidris@demo.example	Dunster W 204	617-555-0106	New York	NY	10024
Sophomore	2025	Gus	Palermo	gpalermo@demo.example	Winthrop S245	617-555-0107	Ripon	CA	95366
Sophomore	2025	Hana	Sato	hsato@demo.example	Winthrop S245	617-555-0108	Ripon	CA	95366
Sophomore	2025	Iris	Delgado	idelgado@demo.example	Lowell E-213	617-555-0109	Miami	FL	33177
Sophomore	2025	Jonas	Berg	jberg@demo.example	24 Prescott 09	617-555-0110	Eden Prairie	MN	55347
Sophomore	2025	Kofi	Mensah	kmensah@demo.example	Kirkland E-12	617-555-0111	Arlington	TN	38002
Sophomore	2025	Lena	Novak	lnovak@demo.example	Kirkland M-11	617-555-0112	Jamaica	NY	11433`;

export function seedPeople(): Person[] {
  return parseRosterText(SEED_TSV).rows.map(rowToPerson);
}

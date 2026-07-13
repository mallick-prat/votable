import type { Person } from "./types";
import { PersonInput } from "./roster";
import { resolveUnit } from "./units";

/** RFC-4180-ish delimited text parser: quotes, escaped quotes, CRLF. */
export function parseDelimited(text: string): string[][] {
  const delimiter = text.split("\n", 1)[0]?.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row.map((v) => v.trim()));
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row.map((v) => v.trim()));
  return rows;
}

/** Import targets an admin can map a CSV column onto. */
export const IMPORT_FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Harvard email" },
  { key: "classYear", label: "Class year" },
  { key: "unit", label: "House / Yard" },
  { key: "building", label: "Building" },
  { key: "entryway", label: "Entryway" },
  { key: "suite", label: "Suite" },
  { key: "room", label: "Room" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "Home city" },
  { key: "state", label: "Home state" },
  { key: "zip", label: "Home ZIP" },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

/** header text → best-guess target field */
export function guessField(header: string): ImportField | null {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  if (/email/.test(h)) return "email";
  if (/first/.test(h)) return "firstName";
  if (/last/.test(h)) return "lastName";
  if (h === "name" || h === "fullname" || h === "studentname") return "fullName";
  if (/classyear|^year$|^class$|classof/.test(h)) return "classYear";
  if (/house|yard|unit|community/.test(h)) return "unit";
  if (/building|dorm|hall$/.test(h)) return "building";
  if (/entry/.test(h)) return "entryway";
  if (/suite/.test(h)) return "suite";
  if (/room/.test(h)) return "room";
  if (/phone|mobile|cell/.test(h)) return "phone";
  if (/city|town/.test(h)) return "city";
  if (/^state$|homestate/.test(h)) return "state";
  if (/zip|postal/.test(h)) return "zip";
  return null;
}

export interface PreviewRow {
  index: number;
  input: PersonInput;
  disposition: "new" | "update" | "unchanged" | "invalid";
  /** blocking problem for invalid rows */
  error?: string;
  /** non-blocking notes: room change, unknown unit, possible duplicate */
  warnings: string[];
}

/** mapping: column index → field (null = ignored) */
export function buildPreview(
  rows: string[][],
  mapping: (ImportField | null)[],
  existing: Person[],
): PreviewRow[] {
  const byEmail = new Map(existing.map((p) => [p.email, p]));
  const existingNames = new Map(
    existing.map((p) => [`${p.firstName} ${p.lastName}`.toLowerCase(), p]),
  );
  const seenEmails = new Set<string>();
  const out: PreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const get = (f: ImportField) => {
      const col = mapping.indexOf(f);
      return col >= 0 ? (cells[col] ?? "").trim() : "";
    };

    let firstName = get("firstName");
    let lastName = get("lastName");
    const fullName = get("fullName");
    if (!firstName && !lastName && fullName) {
      const cut = fullName.includes(",")
        ? // "Last, First"
          ([fullName.split(",")[1], fullName.split(",")[0]] as const)
        : // "First … Last"
          ([
            fullName.slice(0, fullName.lastIndexOf(" ")),
            fullName.slice(fullName.lastIndexOf(" ") + 1),
          ] as const);
      firstName = (cut[0] ?? "").trim();
      lastName = (cut[1] ?? "").trim();
    }

    const input: PersonInput = {
      firstName,
      lastName,
      email: get("email").toLowerCase(),
      classYear: get("classYear"),
      unit: get("unit"),
      building: get("building"),
      entryway: get("entryway"),
      suite: get("suite"),
      room: get("room"),
      phone: get("phone"),
      city: get("city"),
      state: get("state"),
      zip: get("zip"),
    };

    const warnings: string[] = [];
    let error: string | undefined;
    if (!input.email || !input.email.includes("@")) error = "Missing or invalid email";
    else if (seenEmails.has(input.email)) error = "Duplicate email within this file";
    else if (!firstName || !lastName) error = "Missing name";
    seenEmails.add(input.email);

    if (input.unit && !resolveUnit(input.unit))
      warnings.push(`Unknown House/Yard "${input.unit}"`);

    let disposition: PreviewRow["disposition"] = "new";
    if (error) {
      disposition = "invalid";
    } else {
      const match = byEmail.get(input.email);
      if (match) {
        const incomingLoc = [input.suite || `${input.building ?? ""} ${input.room ?? ""}`.trim()]
          .join("")
          .toLowerCase();
        const currentLoc = match.suiteRaw.toLowerCase();
        if (incomingLoc && incomingLoc !== currentLoc) {
          disposition = "update";
          warnings.push(`Room change: "${match.suiteRaw}" → "${input.suite || incomingLoc}"`);
        } else {
          disposition = "unchanged";
        }
      } else {
        const nameMatch = existingNames.get(`${firstName} ${lastName}`.toLowerCase());
        if (nameMatch)
          warnings.push(
            `Possible duplicate of ${nameMatch.firstName} ${nameMatch.lastName} (${nameMatch.email})`,
          );
      }
    }
    out.push({ index: i, input, disposition, error, warnings });
  }
  return out;
}

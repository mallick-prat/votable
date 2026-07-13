import { HOUSES } from "./mail";

/**
 * Top-level residential units: the twelve Houses, four first-year Yards,
 * and the Dudley Community. These are stable public facts and are seeded.
 * Buildings, entryways, suites, and rooms below them are NOT hardcoded —
 * they come from the imported roster.
 */

export type UnitType = "house" | "yard" | "community";

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
}

const YARDS = ["Crimson", "Elm", "Ivy", "Oak"];

export const UNITS: Unit[] = [
  ...HOUSES.map((h) => ({
    id: h.toLowerCase(),
    name: `${h} House`,
    type: "house" as const,
  })),
  ...YARDS.map((y) => ({
    id: `${y.toLowerCase()}-yard`,
    name: `${y} Yard`,
    type: "yard" as const,
  })),
  { id: "dudley", name: "Dudley Community", type: "community" },
];

const byKey = new Map<string, Unit>();
for (const u of UNITS) {
  byKey.set(u.id, u);
  byKey.set(u.name.toLowerCase(), u);
  byKey.set(u.name.toLowerCase().replace(/ (house|yard|community)$/, ""), u);
}

/** Match "Adams", "Adams House", "adams", "Crimson Yard", "Dudley", … */
export function resolveUnit(raw: string | null | undefined): Unit | null {
  if (!raw) return null;
  return byKey.get(raw.trim().toLowerCase()) ?? null;
}

/** The House name used for mail-center addressing, when the unit is a House. */
export function houseFromUnit(unit: Unit | null): string | null {
  return unit?.type === "house" ? unit.name.replace(" House", "") : null;
}

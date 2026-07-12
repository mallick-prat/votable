/** Harvard mail-address model (PRD §6.3). */

/** House mail centers — current street addresses. */
export const HOUSE_MAIL_CENTERS: Record<string, string> = {
  Adams: "26 Plympton Street",
  Cabot: "60 Linnaean Street",
  Currier: "64 Linnaean Street",
  Dunster: "945 Memorial Drive",
  Eliot: "101 Dunster Street",
  Kirkland: "95 Dunster Street",
  Leverett: "28 DeWolfe Street",
  Lowell: "10 Holyoke Place",
  Mather: "10 Cowperthwaite Street",
  Pforzheimer: "56 Linnaean Street",
  Quincy: "58 Plympton Street",
  Winthrop: "32 Mill Street",
};

export const HOUSES = Object.keys(HOUSE_MAIL_CENTERS);

export interface MailAddress {
  lines: string[];
  /** Why this address can't be generated yet, if it can't. */
  blocked?: string;
}

/**
 * Ballot mailing address for a student. Requires a voter-confirmed mailbox
 * number — a room number must never be silently substituted.
 */
export function ballotMailAddress(opts: {
  fullName: string;
  house: string | null;
  isFirstYear: boolean;
  mailbox: string;
}): MailAddress {
  const { fullName, house, isFirstYear, mailbox } = opts;
  if (!mailbox.trim()) {
    return {
      lines: [],
      blocked:
        "Mailbox number required — ask the student to confirm it in Harvard's mail system. Do not use a room number.",
    };
  }
  if (isFirstYear) {
    return {
      lines: [
        fullName,
        `${mailbox.trim()} Harvard Yard Mail Center`,
        "1 Oxford Street",
        "Cambridge, MA 02138",
      ],
    };
  }
  if (house && HOUSE_MAIL_CENTERS[house]) {
    return {
      lines: [
        fullName,
        `${mailbox.trim()} ${house} House Mail Center`,
        HOUSE_MAIL_CENTERS[house],
        "Cambridge, MA 02138",
      ],
    };
  }
  return {
    lines: [],
    blocked:
      "No House mail center on file for this residence — confirm the correct mail center with the student's House before using an address.",
  };
}

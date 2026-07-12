/**
 * Jurisdiction reference data.
 *
 * Mail-voting models and requirement flags come from the campaign rule
 * matrix (PRD §24). They are operational hints, not legal advice — every
 * displayed rule links to the official source and must be reverified per
 * election. No deadlines are hardcoded anywhere: deadlines change per
 * election and must come from the official source the links point to.
 */

export type MailModel = "ALL_MAIL" | "REQUEST" | "EXCUSE" | "NO_REGISTRATION";

export interface JurisdictionInfo {
  code: string;
  name: string;
  mailModel: MailModel;
  /** Requirement flags from the campaign rule matrix — verify per election. */
  flags?: string;
}

const J = (
  code: string,
  name: string,
  mailModel: MailModel,
  flags?: string,
): JurisdictionInfo => ({ code, name, mailModel, flags });

export const JURISDICTIONS: Record<string, JurisdictionInfo> = Object.fromEntries(
  [
    J("AL", "Alabama", "EXCUSE", "Two witnesses or notary on return envelope"),
    J("AK", "Alaska", "REQUEST", "Witness or notary on return envelope"),
    J("AZ", "Arizona", "REQUEST", "Signature review; cure process available"),
    J("AR", "Arkansas", "EXCUSE", "Witness and ID copy required"),
    J("CA", "California", "ALL_MAIL"),
    J("CO", "Colorado", "ALL_MAIL"),
    J("CT", "Connecticut", "REQUEST", "Signed envelope required"),
    J("DE", "Delaware", "REQUEST", "Signed envelope required"),
    J("FL", "Florida", "REQUEST", "Signature match; cure process available"),
    J("GA", "Georgia", "REQUEST", "State ID number or permitted substitute required"),
    J("HI", "Hawaii", "ALL_MAIL"),
    J("ID", "Idaho", "REQUEST"),
    J("IL", "Illinois", "REQUEST"),
    J("IN", "Indiana", "EXCUSE", "Excuse and signature requirements"),
    J("IA", "Iowa", "REQUEST"),
    J("KS", "Kansas", "REQUEST", "ID information required"),
    J("KY", "Kentucky", "EXCUSE", "Excuse and signature requirements"),
    J("LA", "Louisiana", "EXCUSE", "Witness on return envelope"),
    J("ME", "Maine", "REQUEST"),
    J("MD", "Maryland", "REQUEST"),
    J("MA", "Massachusetts", "REQUEST"),
    J("MI", "Michigan", "REQUEST"),
    J("MN", "Minnesota", "REQUEST", "Witness or notary; ID information required"),
    J("MS", "Mississippi", "EXCUSE", "Notarization required"),
    J("MO", "Missouri", "EXCUSE", "Notarization required (exceptions apply)"),
    J("MT", "Montana", "REQUEST"),
    J("NE", "Nebraska", "REQUEST"),
    J("NV", "Nevada", "ALL_MAIL"),
    J("NH", "New Hampshire", "EXCUSE", "Residency documentation may be required"),
    J("NJ", "New Jersey", "REQUEST"),
    J("NM", "New Mexico", "REQUEST"),
    J("NY", "New York", "REQUEST"),
    J("NC", "North Carolina", "REQUEST", "Two witnesses or notary; ID copy or exemption"),
    J("ND", "North Dakota", "NO_REGISTRATION", "No voter registration — ID and residency workflow instead"),
    J("OH", "Ohio", "REQUEST", "ID information required"),
    J("OK", "Oklahoma", "EXCUSE", "Notarization or alternative verification required"),
    J("OR", "Oregon", "ALL_MAIL"),
    J("PA", "Pennsylvania", "REQUEST", "Exact envelope instructions matter — read carefully"),
    J("RI", "Rhode Island", "REQUEST"),
    J("SC", "South Carolina", "EXCUSE", "Witness on return envelope"),
    J("SD", "South Dakota", "EXCUSE"),
    J("TN", "Tennessee", "EXCUSE", "Signature and ID requirements"),
    J("TX", "Texas", "EXCUSE", "ID number must match registration record"),
    J("UT", "Utah", "ALL_MAIL"),
    J("VT", "Vermont", "ALL_MAIL"),
    J("VA", "Virginia", "REQUEST"),
    J("WA", "Washington", "ALL_MAIL"),
    J("WV", "West Virginia", "EXCUSE"),
    J("WI", "Wisconsin", "REQUEST", "Witness required; address must be complete"),
    J("WY", "Wyoming", "EXCUSE", "Signed envelope required"),
    J("DC", "Washington, D.C.", "ALL_MAIL"),
  ].map((j) => [j.code, j]),
);

export const MAIL_MODEL_LABEL: Record<MailModel, string> = {
  ALL_MAIL: "Ballot mailed automatically",
  REQUEST: "Mail ballot by request",
  EXCUSE: "Absentee with excuse",
  NO_REGISTRATION: "No voter registration",
};

/** Official gateway for registering / updating registration. */
export function registerUrl(code: string): string {
  const info = JURISDICTIONS[code];
  if (!info) return "https://vote.gov";
  const slug = info.name.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, "-");
  return `https://vote.gov/register/${slug}`;
}

/** Official registration-status lookup gateway (NASS hub; MA direct). */
export function checkRegistrationUrl(code: string): string {
  if (code === "MA")
    return "https://www.sec.state.ma.us/voterregistrationsearch/";
  return "https://www.nass.org/can-I-vote/voter-registration-status";
}

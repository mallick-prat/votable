-- Voteable schema. Apply with: npm run db:push

CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL DEFAULT '',
  class_year text NOT NULL DEFAULT '',
  house text,
  building text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  suite_raw text NOT NULL DEFAULT '',
  home_city text NOT NULL DEFAULT '',
  home_state text NOT NULL DEFAULT '',
  home_zip text NOT NULL DEFAULT '',
  contact_status text NOT NULL DEFAULT 'uncontacted',
  registration_status text NOT NULL DEFAULT 'unknown',
  ballot_status text NOT NULL DEFAULT 'not_started',
  plan_status text NOT NULL DEFAULT 'none',
  jurisdiction text,
  method text,
  mailbox text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_attempts_person_idx
  ON contact_attempts (person_id, occurred_at);

-- Top-level residential units (Houses, Yards, Dudley) are seeded below.
-- Buildings, entryways, suites, and rooms are data-driven from rosters.
CREATE TABLE IF NOT EXISTS residential_units (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('house', 'yard', 'community'))
);

INSERT INTO residential_units (id, name, type) VALUES
  ('adams', 'Adams House', 'house'),
  ('cabot', 'Cabot House', 'house'),
  ('currier', 'Currier House', 'house'),
  ('dunster', 'Dunster House', 'house'),
  ('eliot', 'Eliot House', 'house'),
  ('kirkland', 'Kirkland House', 'house'),
  ('leverett', 'Leverett House', 'house'),
  ('lowell', 'Lowell House', 'house'),
  ('mather', 'Mather House', 'house'),
  ('pforzheimer', 'Pforzheimer House', 'house'),
  ('quincy', 'Quincy House', 'house'),
  ('winthrop', 'Winthrop House', 'house'),
  ('crimson-yard', 'Crimson Yard', 'yard'),
  ('elm-yard', 'Elm Yard', 'yard'),
  ('ivy-yard', 'Ivy Yard', 'yard'),
  ('oak-yard', 'Oak Yard', 'yard'),
  ('dudley', 'Dudley Community', 'community')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS unit_id text REFERENCES residential_units(id) ON DELETE SET NULL;
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS entryway text NOT NULL DEFAULT '';
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS floor text NOT NULL DEFAULT '';
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS population text NOT NULL DEFAULT 'college'
    CHECK (population IN ('college', 'off_campus', 'on_leave', 'visiting', 'affiliate'));
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Invited campaign staff. A Google session whose email has no row here
-- gets no access. Captains carry a scope (House/Yard/building name).
CREATE TABLE IF NOT EXISTS staff (
  email text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'captain', 'organizer', 'field')),
  scope text,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS assigned_to text REFERENCES staff(email) ON DELETE SET NULL;

-- Turfs: named groups of students with a captain and one primary organizer.
-- The person remains the atomic assignment (people.assigned_to).
CREATE TABLE IF NOT EXISTS turfs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  captain_email text REFERENCES staff(email) ON DELETE SET NULL,
  organizer_email text REFERENCES staff(email) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS turf_id text REFERENCES turfs(id) ON DELETE SET NULL;

-- Election rules per jurisdiction, edited by admins from official sources.
-- Structural drafts are seeded in code from the campaign rule matrix and
-- start unpublished. Voters only ever see published rules.
-- (Note: keep semicolons out of comments — the apply script splits on them.)
CREATE TABLE IF NOT EXISTS state_rules (
  jurisdiction text PRIMARY KEY,
  name text NOT NULL,
  election_date date,
  registration_deadline date,
  online_registration boolean,
  same_day_registration boolean,
  mail_request_required boolean,
  mail_request_deadline date,
  ballot_return_deadline date,
  return_deadline_basis text CHECK (return_deadline_basis IN ('postmark', 'receipt')),
  witness_required boolean,
  notary_required boolean,
  id_required boolean,
  postage_required boolean,
  early_voting_start date,
  early_voting_end date,
  polling_place_url text,
  ballot_tracking_url text,
  sample_ballot_url text,
  source_url text,
  reviewed_at timestamptz,
  published boolean NOT NULL DEFAULT false
);

-- Harvard mail-center street addresses live in data, not code, so admins
-- can update them when Harvard changes its mail system.
ALTER TABLE residential_units
  ADD COLUMN IF NOT EXISTS mail_street text;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS ballot_address text NOT NULL DEFAULT '';

-- Registration checks store ONLY the outcome: status, jurisdiction, source,
-- and time. Never the lookup query, birth date, or identification numbers.
CREATE TABLE IF NOT EXISTS registration_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Election deadlines are entered by admins from official sources — the app
-- never generates dates. Each row records its source and verification time.
CREATE TABLE IF NOT EXISTS deadlines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jurisdiction text NOT NULL,   -- two-letter state code, or 'US' for national
  type text NOT NULL CHECK (type IN
    ('registration', 'ballot_request', 'recommended_mail', 'election_day', 'cure')),
  date date NOT NULL,
  source_url text NOT NULL,
  note text NOT NULL DEFAULT '',
  verified_at timestamptz NOT NULL DEFAULT now()
);

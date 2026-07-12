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

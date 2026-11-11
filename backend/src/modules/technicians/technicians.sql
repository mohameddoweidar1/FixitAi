-- FixItAI — Technician Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users, service_categories (auth.sql)

-- ── Technician Profiles ───────────────────────────────────
DROP TABLE IF EXISTS technician_gallery CASCADE;
DROP TABLE IF EXISTS technician_specializations CASCADE;
DROP TABLE IF EXISTS time_slot_overrides CASCADE;
DROP TABLE IF EXISTS technician_day_overrides CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS technician_work_days CASCADE;
DROP TABLE IF EXISTS technician_profiles CASCADE;

CREATE TABLE technician_profiles (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL UNIQUE
                                 REFERENCES users(id) ON DELETE RESTRICT,
  bio              TEXT          NOT NULL DEFAULT '',
  experience_years INT           NOT NULL DEFAULT 0
                                 CHECK (experience_years >= 0),
  hourly_rate      NUMERIC(10,2) NOT NULL DEFAULT 0
                                 CHECK (hourly_rate >= 0),
  inspection_fee   NUMERIC(10,2) NOT NULL DEFAULT 0
                                 CHECK (inspection_fee >= 0),
  id_image_url     TEXT,
  is_verified      BOOLEAN       NOT NULL DEFAULT FALSE,
  is_available     BOOLEAN       NOT NULL DEFAULT TRUE,
  rating_avg       NUMERIC(3,2)  NOT NULL DEFAULT 0
                                 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count     INT           NOT NULL DEFAULT 0
                                 CHECK (rating_count >= 0),
  area_latitude    NUMERIC(10,7),
  area_longitude   NUMERIC(10,7),
  area_radius_km   NUMERIC(6,2)  DEFAULT 10
                                 CHECK (area_radius_km IS NULL OR area_radius_km > 0),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tech_profiles_user     ON technician_profiles (user_id);
CREATE INDEX idx_tech_profiles_rating   ON technician_profiles (rating_avg);
CREATE INDEX idx_tech_profiles_verified ON technician_profiles (is_verified);
CREATE INDEX idx_tech_profiles_avail    ON technician_profiles (is_available);

-- ── Work Days (weekly template) ───────────────────────────
CREATE TABLE technician_work_days (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id  UUID        NOT NULL
                             REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  day_of_week    SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technician_id, day_of_week)
);

CREATE INDEX idx_work_days_tech ON technician_work_days (technician_id);

-- ── Time Slots (per work-day windows) ─────────────────────
CREATE TABLE time_slots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id  UUID        NOT NULL
                             REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  work_day_id    UUID        NOT NULL
                             REFERENCES technician_work_days(id) ON DELETE RESTRICT,
  start_time     TIME        NOT NULL,
  end_time       TIME        NOT NULL,
  max_bookings   INT         NOT NULL DEFAULT 1 CHECK (max_bookings >= 1),
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_time_slots_tech     ON time_slots (technician_id);
CREATE INDEX idx_time_slots_work_day ON time_slots (work_day_id);

-- ── Day Overrides (vacation / holiday exceptions) ─────────
CREATE TABLE technician_day_overrides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id    UUID        NOT NULL
                               REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  override_date    DATE        NOT NULL,
  is_working_day   BOOLEAN     NOT NULL DEFAULT FALSE,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technician_id, override_date)
);

CREATE INDEX idx_day_overrides_date ON technician_day_overrides (technician_id, override_date);

-- ── Time Slot Overrides (per-slot date exceptions) ────────
CREATE TABLE time_slot_overrides (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id        UUID        NOT NULL
                             REFERENCES time_slots(id) ON DELETE RESTRICT,
  override_date  DATE        NOT NULL,
  max_bookings   INT         NOT NULL DEFAULT 1 CHECK (max_bookings >= 0),
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, override_date)
);

CREATE INDEX idx_slot_overrides_date ON time_slot_overrides (slot_id, override_date);

-- ── Specializations (many-to-many: technician ↔ category) ─
CREATE TABLE technician_specializations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id  UUID        NOT NULL
                             REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  category_id    UUID        NOT NULL
                             REFERENCES service_categories(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technician_id, category_id)
);

CREATE INDEX idx_specializations_tech ON technician_specializations (technician_id);
CREATE INDEX idx_specializations_cat  ON technician_specializations (category_id);

-- ── Gallery (portfolio images) ────────────────────────────
CREATE TABLE technician_gallery (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id   UUID        NOT NULL
                              REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  image_url       TEXT        NOT NULL,
  caption         VARCHAR(255),
  display_order   INT         NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_tech ON technician_gallery (technician_id);

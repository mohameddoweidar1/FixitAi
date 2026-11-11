-- FixItAI — Foundation: users + service_categories
-- Destructive migration: drops and recreates tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users ─────────────────────────────────────────────────
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255)  UNIQUE NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  full_name      VARCHAR(120)  NOT NULL,
  phone          VARCHAR(32),
  role           VARCHAR(20)   NOT NULL DEFAULT 'client'
                 CHECK (role IN ('client', 'technician', 'admin')),
  avatar_url     TEXT,
  latitude       NUMERIC(10,7),
  longitude      NUMERIC(10,7),
  location_label TEXT,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email     ON users (email);
CREATE INDEX idx_users_role      ON users (role);
CREATE INDEX idx_users_active    ON users (is_active) WHERE deleted_at IS NULL;

-- ── Service Categories ────────────────────────────────────
DROP TABLE IF EXISTS service_categories CASCADE;

CREATE TABLE service_categories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID         REFERENCES service_categories(id) ON DELETE RESTRICT,
  name        VARCHAR(120) NOT NULL,
  slug        VARCHAR(140) UNIQUE NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  icon_url    TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON service_categories (parent_id);
CREATE INDEX idx_categories_slug   ON service_categories (slug);
CREATE INDEX idx_categories_active ON service_categories (is_active);

-- ── Seed default categories ───────────────────────────────
INSERT INTO service_categories (name, slug, description) VALUES
  ('Plumbing',    'plumbing',    'Pipe repairs, leak fixes, drain cleaning, and water heater services'),
  ('Electrical',  'electrical',  'Wiring, circuit repairs, lighting installation, and panel upgrades'),
  ('HVAC',        'hvac',        'Heating, ventilation, and air conditioning installation and repair'),
  ('Painting',    'painting',    'Interior and exterior painting, wall preparation, and finishing'),
  ('Carpentry',   'carpentry',   'Furniture repair, door/window installation, and woodwork'),
  ('Appliances',  'appliances',  'Washing machine, refrigerator, oven, and dishwasher repair'),
  ('Cleaning',    'cleaning',    'Deep cleaning, post-construction cleanup, and regular maintenance'),
  ('General',     'general',     'General handyman tasks and miscellaneous home repairs');

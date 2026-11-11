-- FixItAI — Reviews
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql), technician_profiles (technicians.sql), bookings (bookings.sql)

DROP TABLE IF EXISTS reviews CASCADE;

CREATE TABLE reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        NOT NULL UNIQUE
                              REFERENCES bookings(id) ON DELETE RESTRICT,
  client_id       UUID        NOT NULL
                              REFERENCES users(id) ON DELETE RESTRICT,
  technician_id   UUID        NOT NULL
                              REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  rating          INT         NOT NULL
                              CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT        NOT NULL DEFAULT '',
  is_visible      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_technician ON reviews (technician_id);
CREATE INDEX idx_reviews_client     ON reviews (client_id);
CREATE INDEX idx_reviews_rating     ON reviews (rating);
CREATE INDEX idx_reviews_visible    ON reviews (is_visible);
CREATE INDEX idx_reviews_created    ON reviews (created_at DESC);

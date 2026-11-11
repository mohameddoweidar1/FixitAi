-- FixItAI — Booking Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql), service_categories (auth.sql),
--           technician_profiles, time_slots (technicians.sql)

-- ── Bookings ──────────────────────────────────────────────
DROP TABLE IF EXISTS booking_status_history CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

CREATE TABLE bookings (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID          NOT NULL
                                  REFERENCES users(id) ON DELETE RESTRICT,
  technician_id     UUID          NOT NULL
                                  REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  category_id       UUID          REFERENCES service_categories(id) ON DELETE RESTRICT,
  slot_id           UUID          REFERENCES time_slots(id) ON DELETE RESTRICT,
  booking_date      DATE,
  service_title     VARCHAR(120)  NOT NULL,
  description       TEXT          NOT NULL DEFAULT '',
  agreed_price      NUMERIC(10,2),
  client_latitude   NUMERIC(10,7),
  client_longitude  NUMERIC(10,7),
  client_address    TEXT          NOT NULL DEFAULT '',
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending', 'accepted', 'in_progress',
                      'completed', 'cancelled', 'rejected'
                    )),
  cancelled_by      VARCHAR(20)
                    CHECK (cancelled_by IS NULL OR cancelled_by IN ('client', 'technician', 'admin')),
  cancellation_note TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_client      ON bookings (client_id);
CREATE INDEX idx_bookings_technician  ON bookings (technician_id);
CREATE INDEX idx_bookings_category    ON bookings (category_id);
CREATE INDEX idx_bookings_slot        ON bookings (slot_id);
CREATE INDEX idx_bookings_date        ON bookings (booking_date);
CREATE INDEX idx_bookings_status      ON bookings (status);
CREATE INDEX idx_bookings_created     ON bookings (created_at DESC);

-- ── Booking Status History (audit trail) ──────────────────
CREATE TABLE booking_status_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL
                          REFERENCES bookings(id) ON DELETE RESTRICT,
  old_status  VARCHAR(20),
  new_status  VARCHAR(20) NOT NULL,
  changed_by  UUID        REFERENCES users(id) ON DELETE RESTRICT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_history_booking ON booking_status_history (booking_id);
CREATE INDEX idx_booking_history_created ON booking_status_history (created_at DESC);

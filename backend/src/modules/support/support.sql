-- FixItAI — Platform Support Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql), bookings (bookings.sql)

-- ── Notifications ─────────────────────────────────────────
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type        VARCHAR(40) NOT NULL DEFAULT 'info'
              CHECK (type IN ('info', 'booking', 'payment', 'review', 'dispute', 'system')),
  title       VARCHAR(255) NOT NULL,
  body        TEXT         NOT NULL DEFAULT '',
  entity_type VARCHAR(40),
  entity_id   UUID,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user        ON notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created     ON notifications (created_at DESC);

-- ── Disputes ──────────────────────────────────────────────
DROP TABLE IF EXISTS disputes CASCADE;

CREATE TABLE disputes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_id      UUID        REFERENCES bookings(id) ON DELETE RESTRICT,
  reason          TEXT        NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolved_by     UUID        REFERENCES users(id) ON DELETE RESTRICT,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_reporter ON disputes (reporter_id);
CREATE INDEX idx_disputes_reported ON disputes (reported_id);
CREATE INDEX idx_disputes_booking  ON disputes (booking_id);
CREATE INDEX idx_disputes_status   ON disputes (status);

-- ── Chat Sessions (AI chatbot) ────────────────────────────
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

CREATE TABLE chat_sessions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       VARCHAR(255) NOT NULL DEFAULT 'New Chat',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user    ON chat_sessions (user_id);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions (updated_at DESC);

-- ── Chat Messages ─────────────────────────────────────────
CREATE TABLE chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE RESTRICT,
  sender_type VARCHAR(10) NOT NULL DEFAULT 'user'
              CHECK (sender_type IN ('user', 'ai', 'system')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages (created_at);

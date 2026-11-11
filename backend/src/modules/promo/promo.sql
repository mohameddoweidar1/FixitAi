-- FixItAI — Promo Codes Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql), orders (marketplace.sql), bookings (bookings.sql)

-- ── Promo Codes ──────────────────────────────────────────
DROP TABLE IF EXISTS promo_redemptions CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;

CREATE TABLE promo_codes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50)   UNIQUE NOT NULL,
  discount_type     VARCHAR(20)   NOT NULL
                                  CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value    NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  max_uses          INT,
  used_count        INT           NOT NULL DEFAULT 0,
  max_uses_per_user INT           NOT NULL DEFAULT 1,
  min_order_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  applies_to        VARCHAR(20)   NOT NULL DEFAULT 'all'
                                  CHECK (applies_to IN ('all', 'bookings', 'marketplace')),
  starts_at         TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by        UUID          NOT NULL
                                  REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_codes_code   ON promo_codes (code);
CREATE INDEX idx_promo_codes_active ON promo_codes (is_active);

-- ── Promo Redemptions ────────────────────────────────────
CREATE TABLE promo_redemptions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID          NOT NULL
                                REFERENCES promo_codes(id) ON DELETE RESTRICT,
  user_id         UUID          NOT NULL
                                REFERENCES users(id) ON DELETE RESTRICT,
  order_id        UUID          REFERENCES orders(id) ON DELETE RESTRICT,
  booking_id      UUID          REFERENCES bookings(id) ON DELETE RESTRICT,
  discount_amount NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_redemptions_code ON promo_redemptions (promo_code_id);
CREATE INDEX idx_promo_redemptions_user ON promo_redemptions (promo_code_id, user_id);

-- ── Seed demo promo codes ────────────────────────────────
-- Uses a DO block so seeds only run when an admin user exists.
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, max_uses_per_user, min_order_amount, applies_to, is_active, created_by)
    VALUES
      ('WELCOME50',  'percentage', 50.00, NULL, 1, 0,     'all',         TRUE, admin_id),
      ('FIXIT10',    'fixed',      10.00, 100,  2, 20.00, 'marketplace', TRUE, admin_id),
      ('FREEBOOK',   'percentage', 100.00, 50,  1, 0,     'bookings',    TRUE, admin_id)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

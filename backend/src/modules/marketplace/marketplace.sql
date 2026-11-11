-- FixItAI — Marketplace Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql), service_categories (auth.sql), bookings (bookings.sql)

-- ── Products ──────────────────────────────────────────────
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120)  NOT NULL,
  description TEXT          NOT NULL DEFAULT '',
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock_qty   INT           NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  category_id UUID          REFERENCES service_categories(id) ON DELETE RESTRICT,
  image_url   TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_active   ON products (is_active);
CREATE INDEX idx_products_stock    ON products (stock_qty) WHERE stock_qty > 0;

-- ── Cart Items ────────────────────────────────────────────
CREATE TABLE cart_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INT         NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user ON cart_items (user_id);

-- ── Orders ────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  shipping_address TEXT          NOT NULL DEFAULT '',
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);

-- ── Order Items ───────────────────────────────────────────
CREATE TABLE order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id   UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INT           NOT NULL CHECK (quantity >= 1),
  unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  product_name VARCHAR(120)  NOT NULL DEFAULT ''
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

-- ── Payments (unified: orders + bookings) ─────────────────
CREATE TABLE payments (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID          REFERENCES orders(id) ON DELETE RESTRICT,
  booking_id       UUID          REFERENCES bookings(id) ON DELETE RESTRICT,
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method           VARCHAR(30)   NOT NULL DEFAULT 'card'
                   CHECK (method IN ('card', 'cash', 'wallet', 'promo')),
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_type     VARCHAR(20)   NOT NULL DEFAULT 'order'
                   CHECK (payment_type IN ('order', 'booking')),
  transaction_ref  VARCHAR(100),
  gateway_response JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  refunded_at      TIMESTAMPTZ,
  -- Exactly one parent: either order_id or booking_id, not both, not neither
  CHECK (
    (order_id IS NOT NULL AND booking_id IS NULL) OR
    (order_id IS NULL AND booking_id IS NOT NULL)
  )
);

CREATE INDEX idx_payments_order   ON payments (order_id)   WHERE order_id IS NOT NULL;
CREATE INDEX idx_payments_booking ON payments (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_payments_user    ON payments (user_id);
CREATE INDEX idx_payments_type    ON payments (payment_type);

-- ── Seed demo products ────────────────────────────────────
INSERT INTO products (name, description, price, stock_qty, image_url) VALUES
  ('Adjustable Wrench Set',  'Professional 3-piece adjustable wrench set for plumbing and general repairs.', 29.99, 50, NULL),
  ('LED Work Light',         'Rechargeable 1000-lumen LED work light with magnetic base.',                   24.99, 30, NULL),
  ('Pipe Repair Kit',        'Emergency pipe repair kit with clamps, tape, and sealant.',                    18.50, 40, NULL),
  ('Electrical Wire Bundle', '100ft bundle of 14-gauge copper electrical wire, assorted colors.',            34.99, 25, NULL),
  ('HVAC Filter Pack',       'Pack of 4 high-efficiency HVAC filters (20x25x1).',                           42.00, 20, NULL),
  ('Safety Goggles',         'Anti-fog safety goggles with adjustable strap.',                               12.99, 100, NULL),
  ('Drain Snake Tool',       '25ft flexible drain snake for clearing clogs.',                                19.99, 35, NULL),
  ('Multi-Surface Cleaner',  'Professional-grade multi-surface cleaner, 1 gallon.',                          15.99, 60, NULL);

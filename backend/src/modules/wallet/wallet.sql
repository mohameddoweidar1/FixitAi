-- FixItAI — Wallet Domain
-- Destructive migration: drops and recreates tables.
-- Requires: users (auth.sql)

-- ── Wallet Accounts ──────────────────────────────────────
DROP TABLE IF EXISTS saved_payment_methods CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallet_accounts CASCADE;

CREATE TABLE wallet_accounts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          UNIQUE NOT NULL
                                REFERENCES users(id) ON DELETE RESTRICT,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0
                                CHECK (current_balance >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_accounts_user ON wallet_accounts (user_id);

-- ── Wallet Transactions (immutable ledger) ────────────────
CREATE TABLE wallet_transactions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id      UUID          NOT NULL
                               REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  type           VARCHAR(30)   NOT NULL
                               CHECK (type IN (
                                 'top_up', 'payment', 'refund',
                                 'admin_adjustment', 'withdrawal'
                               )),
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction      VARCHAR(10)   NOT NULL
                               CHECK (direction IN ('credit', 'debit')),
  reference_type VARCHAR(30),
  reference_id   UUID,
  note           TEXT,
  created_by     UUID          REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_wallet    ON wallet_transactions (wallet_id);
CREATE INDEX idx_wallet_tx_type      ON wallet_transactions (type);
CREATE INDEX idx_wallet_tx_created   ON wallet_transactions (created_at DESC);

-- ── Saved Payment Methods (tokenized / masked) ───────────
CREATE TABLE saved_payment_methods (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL
                          REFERENCES users(id) ON DELETE RESTRICT,
  provider   VARCHAR(30)  NOT NULL DEFAULT 'demo',
  card_brand VARCHAR(30)  NOT NULL DEFAULT '',
  last4      VARCHAR(4)   NOT NULL,
  exp_month  INT          NOT NULL CHECK (exp_month BETWEEN 1 AND 12),
  exp_year   INT          NOT NULL CHECK (exp_year >= 2024),
  token      VARCHAR(255) NOT NULL,
  is_default BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_pm_user ON saved_payment_methods (user_id);

-- At most one default payment method per user
CREATE UNIQUE INDEX idx_saved_pm_one_default
  ON saved_payment_methods (user_id) WHERE is_default = TRUE;

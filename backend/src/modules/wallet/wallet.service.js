import { query, pool } from '../../config/db.js';
import { eventBus, EVENTS } from '../../events/eventBus.js';

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

// ── Row mappers ──────────────────────────────────────────
function toPublicWallet(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    currentBalance: Number(row.current_balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    walletId: row.wallet_id,
    type: row.type,
    amount: Number(row.amount),
    direction: row.direction,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    note: row.note,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
  };
}

function toPublicPaymentMethod(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    cardBrand: row.card_brand,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // token is intentionally omitted from public output
  };
}

// ── Wallet CRUD ──────────────────────────────────────────

/**
 * Returns the wallet for a user, creating one with zero balance if none exists.
 * Used during registration and on first wallet access.
 */
export async function getOrCreateWallet(userId) {
  // Attempt an upsert so concurrent calls don't fail
  const { rows } = await query(
    `INSERT INTO wallet_accounts (user_id, current_balance)
     VALUES ($1, 0)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = wallet_accounts.updated_at
     RETURNING *`,
    [userId],
  );
  return toPublicWallet(rows[0]);
}

export async function getWalletByUserId(userId) {
  const { rows } = await query(
    `SELECT * FROM wallet_accounts WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return toPublicWallet(rows[0]);
}

// ── Core ledger operations (atomic) ──────────────────────

/**
 * Credits the wallet: inserts a ledger row and increases current_balance.
 * Runs inside a pg transaction for atomicity.
 */
export async function creditWallet(userId, { type, amount, referenceType, referenceId, note, createdBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the wallet row
    const { rows: walletRows } = await client.query(
      `SELECT id FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    if (!walletRows.length) throwError('Wallet not found', 404);
    const walletId = walletRows[0].id;

    // Insert ledger entry
    await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, type, amount, direction, reference_type, reference_id, note, created_by)
       VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7)`,
      [walletId, type, amount, referenceType ?? null, referenceId ?? null, note ?? null, createdBy ?? null],
    );

    // Update cached balance
    await client.query(
      `UPDATE wallet_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2`,
      [amount, walletId],
    );

    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }

  // Avoid notifying for internal payment routing if desired, but notifying is fine for all for completeness
  if (type !== 'refund') {
    eventBus.emit(EVENTS.WALLET_TOP_UP, { userId, amount });
  }

  return getWalletByUserId(userId);
}

/**
 * Debits the wallet: inserts a ledger row and decreases current_balance.
 * Throws if insufficient balance.
 */
export async function debitWallet(userId, { type, amount, referenceType, referenceId, note, createdBy }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: walletRows } = await client.query(
      `SELECT id, current_balance FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    if (!walletRows.length) throwError('Wallet not found', 404);
    const wallet = walletRows[0];

    if (Number(wallet.current_balance) < amount) {
      throwError('Insufficient wallet balance', 400);
    }

    await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, type, amount, direction, reference_type, reference_id, note, created_by)
       VALUES ($1, $2, $3, 'debit', $4, $5, $6, $7)`,
      [wallet.id, type, amount, referenceType ?? null, referenceId ?? null, note ?? null, createdBy ?? null],
    );

    await client.query(
      `UPDATE wallet_accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2`,
      [amount, wallet.id],
    );

    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }

  if (type !== 'payment') {
    eventBus.emit(EVENTS.WALLET_WITHDRAWAL, { userId, amount });
  }

  return getWalletByUserId(userId);
}

// ── High-level wallet operations ─────────────────────────

export async function topUp(userId, amount) {
  return creditWallet(userId, { type: 'top_up', amount, note: 'Wallet top-up' });
}

export async function withdraw(userId, amount) {
  return debitWallet(userId, { type: 'withdrawal', amount, note: 'Wallet withdrawal' });
}

export async function adminAdjust(adminId, targetUserId, amount, direction, reason) {
  if (direction === 'credit') {
    return creditWallet(targetUserId, {
      type: 'admin_adjustment', amount,
      referenceType: 'admin', note: reason, createdBy: adminId,
    });
  }
  return debitWallet(targetUserId, {
    type: 'admin_adjustment', amount,
    referenceType: 'admin', note: reason, createdBy: adminId,
  });
}

export async function payFromWallet(userId, amount, referenceType, referenceId) {
  return debitWallet(userId, {
    type: 'payment', amount, referenceType, referenceId, note: 'Payment from wallet',
  });
}

export async function refundToWallet(userId, amount, referenceType, referenceId) {
  return creditWallet(userId, {
    type: 'refund', amount, referenceType, referenceId, note: 'Refund to wallet',
  });
}

// ── Transaction history ──────────────────────────────────

export async function listTransactions(userId, { type, page, limit }) {
  const { rows: walletRows } = await query(
    `SELECT id FROM wallet_accounts WHERE user_id = $1 LIMIT 1`, [userId],
  );
  if (!walletRows.length) throwError('Wallet not found', 404);
  const walletId = walletRows[0].id;

  const where = ['wt.wallet_id = $1'];
  const params = [walletId];
  let i = 2;

  if (type) { where.push(`wt.type = $${i++}`); params.push(type); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const rowsP = query(
    `SELECT wt.*, u.full_name AS created_by_name
       FROM wallet_transactions wt
       LEFT JOIN users u ON u.id = wt.created_by
     ${whereSql}
     ORDER BY wt.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );
  const countP = query(
    `SELECT COUNT(*)::int AS total FROM wallet_transactions wt ${whereSql}`, params,
  );

  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicTransaction), page, limit, total: countRes.rows[0].total };
}

export async function listTransactionsByWalletUserId(targetUserId, { type, page, limit }) {
  return listTransactions(targetUserId, { type, page, limit });
}

// ── Admin: Wallet Overview & List ────────────────────────
export async function adminGetOverview() {
  const { rows } = await query(`
    SELECT
      COUNT(*)::int AS total_wallets,
      COALESCE(SUM(current_balance), 0)::numeric(14,2) AS total_balance,
      COUNT(*) FILTER (WHERE current_balance > 0)::int AS funded_wallets,
      COALESCE(AVG(current_balance), 0)::numeric(14,2) AS avg_balance
    FROM wallet_accounts
  `);
  const { rows: txStats } = await query(`
    SELECT
      COUNT(*)::int AS total_transactions,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0)::numeric(14,2) AS total_credits,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0)::numeric(14,2) AS total_debits,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS recent_transactions
    FROM wallet_transactions
  `);
  return { wallets: rows[0], transactions: txStats[0] };
}

export async function adminListWallets({ search, page, limit }) {
  const where = []; const params = []; let i = 1;
  if (search) {
    where.push(`(u.full_name ILIKE $${i} OR u.email ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rowsP = query(
    `SELECT wa.*, u.full_name, u.email, u.role
       FROM wallet_accounts wa
       JOIN users u ON u.id = wa.user_id
     ${whereSql} ORDER BY wa.current_balance DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );
  const countP = query(
    `SELECT COUNT(*)::int AS total FROM wallet_accounts wa JOIN users u ON u.id = wa.user_id ${whereSql}`,
    params,
  );
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return {
    items: rowsRes.rows.map(r => ({
      ...toPublicWallet(r), fullName: r.full_name, email: r.email, role: r.role,
    })),
    page, limit, total: countRes.rows[0].total,
  };
}

// ── Saved Payment Methods ────────────────────────────────

export async function addSavedPaymentMethod(userId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If setting as default, clear existing default first
    if (data.isDefault) {
      await client.query(
        `UPDATE saved_payment_methods SET is_default = FALSE, updated_at = NOW()
         WHERE user_id = $1 AND is_default = TRUE`, [userId],
      );
    }

    const { rows } = await client.query(
      `INSERT INTO saved_payment_methods
         (user_id, provider, card_brand, last4, exp_month, exp_year, token, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, data.provider, data.cardBrand, data.last4,
       data.expMonth, data.expYear, data.token, data.isDefault ?? false],
    );

    await client.query('COMMIT');
    return toPublicPaymentMethod(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}

export async function listSavedPaymentMethods(userId) {
  const { rows } = await query(
    `SELECT * FROM saved_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return rows.map(toPublicPaymentMethod);
}

export async function deleteSavedPaymentMethod(userId, methodId) {
  const { rowCount } = await query(
    `DELETE FROM saved_payment_methods WHERE id = $1 AND user_id = $2`, [methodId, userId],
  );
  if (!rowCount) throwError('Payment method not found', 404);
}

export async function setDefaultPaymentMethod(userId, methodId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify method belongs to user
    const { rows } = await client.query(
      `SELECT id FROM saved_payment_methods WHERE id = $1 AND user_id = $2`, [methodId, userId],
    );
    if (!rows.length) throwError('Payment method not found', 404);

    // Clear old default
    await client.query(
      `UPDATE saved_payment_methods SET is_default = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND is_default = TRUE`, [userId],
    );

    // Set new default
    await client.query(
      `UPDATE saved_payment_methods SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1`, [methodId],
    );

    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }

  return listSavedPaymentMethods(userId);
}

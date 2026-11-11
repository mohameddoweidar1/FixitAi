import { query, pool } from '../../config/db.js';

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function toPublicPromo(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxUses: row.max_uses,
    usedCount: row.used_count,
    maxUsesPerUser: row.max_uses_per_user,
    minOrderAmount: Number(row.min_order_amount),
    appliesTo: row.applies_to,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicRedemption(row) {
  if (!row) return null;
  return {
    id: row.id,
    promoCodeId: row.promo_code_id,
    userId: row.user_id,
    userName: row.user_name || null,
    orderId: row.order_id,
    bookingId: row.booking_id,
    discountAmount: Number(row.discount_amount),
    createdAt: row.created_at,
  };
}

// ── Admin CRUD ───────────────────────────────────────────

export async function createPromo(adminId, data) {
  try {
    const { rows } = await query(
      `INSERT INTO promo_codes
         (code, discount_type, discount_value, max_uses, max_uses_per_user,
          min_order_amount, applies_to, starts_at, expires_at, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [data.code, data.discountType, data.discountValue, data.maxUses ?? null,
       data.maxUsesPerUser ?? 1, data.minOrderAmount ?? 0, data.appliesTo ?? 'all',
       data.startsAt ?? null, data.expiresAt ?? null, data.isActive ?? true, adminId],
    );
    return toPublicPromo(rows[0]);
  } catch (err) {
    if (err.code === '23505') throwError('Promo code already exists', 409);
    throw err;
  }
}

export async function updatePromo(id, data) {
  const fields = []; const params = []; let i = 1;

  if (data.discountType !== undefined)  { fields.push(`discount_type = $${i++}`);     params.push(data.discountType); }
  if (data.discountValue !== undefined) { fields.push(`discount_value = $${i++}`);    params.push(data.discountValue); }
  if (data.maxUses !== undefined)       { fields.push(`max_uses = $${i++}`);          params.push(data.maxUses); }
  if (data.maxUsesPerUser !== undefined) { fields.push(`max_uses_per_user = $${i++}`); params.push(data.maxUsesPerUser); }
  if (data.minOrderAmount !== undefined) { fields.push(`min_order_amount = $${i++}`);  params.push(data.minOrderAmount); }
  if (data.appliesTo !== undefined)     { fields.push(`applies_to = $${i++}`);        params.push(data.appliesTo); }
  if (data.startsAt !== undefined)      { fields.push(`starts_at = $${i++}`);         params.push(data.startsAt); }
  if (data.expiresAt !== undefined)     { fields.push(`expires_at = $${i++}`);        params.push(data.expiresAt); }
  if (data.isActive !== undefined)      { fields.push(`is_active = $${i++}`);         params.push(data.isActive); }

  if (!fields.length) throwError('No fields to update', 400);

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const { rowCount } = await query(
    `UPDATE promo_codes SET ${fields.join(', ')} WHERE id = $${i}`, params,
  );
  if (!rowCount) throwError('Promo code not found', 404);
  return getPromoById(id);
}

export async function deactivatePromo(id) {
  const { rowCount } = await query(
    `UPDATE promo_codes SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id],
  );
  if (!rowCount) throwError('Promo code not found', 404);
  return getPromoById(id);
}

export async function getPromoById(id) {
  const { rows } = await query(
    `SELECT pc.*, u.full_name AS created_by_name
       FROM promo_codes pc
       LEFT JOIN users u ON u.id = pc.created_by
      WHERE pc.id = $1 LIMIT 1`, [id],
  );
  return toPublicPromo(rows[0]);
}

export async function listPromos({ isActive, page, limit }) {
  const where = []; const params = []; let i = 1;
  if (isActive !== undefined) { where.push(`pc.is_active = $${i++}`); params.push(isActive === 'true'); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rowsP = query(
    `SELECT pc.*, u.full_name AS created_by_name
       FROM promo_codes pc
       LEFT JOIN users u ON u.id = pc.created_by
     ${whereSql}
     ORDER BY pc.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );
  const countP = query(
    `SELECT COUNT(*)::int AS total FROM promo_codes pc ${whereSql}`, params,
  );

  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicPromo), page, limit, total: countRes.rows[0].total };
}

// ── Validation + Redemption ──────────────────────────────

/**
 * Validates a promo code and returns the calculated discount amount.
 * Does NOT redeem — call redeemPromo() after successful payment.
 */
export async function validatePromoCode(code, userId, subtotal, appliesTo) {
  const upperCode = code.toUpperCase();

  const { rows } = await query(
    `SELECT * FROM promo_codes WHERE code = $1 LIMIT 1`, [upperCode],
  );
  if (!rows.length) throwError('Promo code not found', 404);
  const promo = rows[0];

  // Active check
  if (!promo.is_active) throwError('Promo code is no longer active', 400);

  // Date checks
  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) throwError('Promo code is not yet active', 400);
  if (promo.expires_at && new Date(promo.expires_at) < now) throwError('Promo code has expired', 400);

  // Max uses check
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    throwError('Promo code has reached its usage limit', 400);
  }

  // Per-user limit check
  const { rows: userRedemptions } = await query(
    `SELECT COUNT(*)::int AS cnt FROM promo_redemptions
     WHERE promo_code_id = $1 AND user_id = $2`,
    [promo.id, userId],
  );
  if (userRedemptions[0].cnt >= promo.max_uses_per_user) {
    throwError('You have already used this promo code the maximum number of times', 400);
  }

  // Applies-to check
  if (promo.applies_to !== 'all' && promo.applies_to !== appliesTo) {
    throwError(`This promo code only applies to ${promo.applies_to}`, 400);
  }

  // Min order amount check
  if (subtotal < Number(promo.min_order_amount)) {
    throwError(`Minimum order amount for this promo is ${promo.min_order_amount}`, 400);
  }

  // Calculate discount
  let discountAmount;
  if (promo.discount_type === 'percentage') {
    discountAmount = Math.round(subtotal * Number(promo.discount_value) / 100 * 100) / 100;
  } else {
    discountAmount = Number(promo.discount_value);
  }

  // Cap discount to subtotal (cannot go negative)
  discountAmount = Math.min(discountAmount, subtotal);

  return {
    promoCodeId: promo.id,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
    discountAmount,
    finalAmount: Math.round((subtotal - discountAmount) * 100) / 100,
  };
}

/**
 * Records a promo redemption and increments used_count.
 * Must be called inside a transaction or after payment succeeds.
 */
export async function redeemPromo(promoCodeId, userId, { orderId, bookingId, discountAmount }, pgClient) {
  const qFn = pgClient ? pgClient.query.bind(pgClient) : query;

  await qFn(
    `INSERT INTO promo_redemptions (promo_code_id, user_id, order_id, booking_id, discount_amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [promoCodeId, userId, orderId ?? null, bookingId ?? null, discountAmount],
  );

  await qFn(
    `UPDATE promo_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1`,
    [promoCodeId],
  );
}

// ── Admin stats ──────────────────────────────────────────

export async function getRedemptionStats(promoCodeId) {
  const promo = await getPromoById(promoCodeId);
  if (!promo) throwError('Promo code not found', 404);

  const { rows: stats } = await query(
    `SELECT COUNT(*)::int AS total_redemptions,
            COALESCE(SUM(discount_amount), 0)::numeric(12,2) AS total_discount_given,
            COUNT(DISTINCT user_id)::int AS unique_users
       FROM promo_redemptions
      WHERE promo_code_id = $1`,
    [promoCodeId],
  );

  const { rows: recent } = await query(
    `SELECT pr.*, u.full_name AS user_name
       FROM promo_redemptions pr
       JOIN users u ON u.id = pr.user_id
      WHERE pr.promo_code_id = $1
      ORDER BY pr.created_at DESC
      LIMIT 10`,
    [promoCodeId],
  );

  return {
    promo,
    stats: {
      totalRedemptions: stats[0].total_redemptions,
      totalDiscountGiven: Number(stats[0].total_discount_given),
      uniqueUsers: stats[0].unique_users,
    },
    recentRedemptions: recent.map(toPublicRedemption),
  };
}

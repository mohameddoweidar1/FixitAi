import { query } from '../../config/db.js';

const REVIEW_COLUMNS = `
  r.id, r.booking_id, r.client_id, r.technician_id,
  r.rating, r.comment, r.is_visible, r.created_at,
  cu.full_name AS client_name, tu.full_name AS technician_name
`;

const FROM_CLAUSE = `
  FROM reviews r
  JOIN users cu ON cu.id = r.client_id
  JOIN technician_profiles tp ON tp.id = r.technician_id
  JOIN users tu ON tu.id = tp.user_id
`;

function toPublicReview(row) {
  if (!row) return null;
  return {
    id: row.id, bookingId: row.booking_id, clientId: row.client_id,
    technicianId: row.technician_id, rating: row.rating, comment: row.comment,
    isVisible: row.is_visible, createdAt: row.created_at,
    client: { fullName: row.client_name },
    technician: { fullName: row.technician_name },
  };
}

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

async function recalcTechnicianRating(technicianProfileId) {
  await query(
    `UPDATE technician_profiles
        SET rating_avg   = COALESCE(sub.avg, 0),
            rating_count = COALESCE(sub.cnt, 0),
            updated_at   = NOW()
       FROM (
         SELECT AVG(rating)::NUMERIC(3,2) AS avg, COUNT(*)::int AS cnt
           FROM reviews
          WHERE technician_id = $1 AND is_visible = TRUE
       ) sub
      WHERE id = $1`,
    [technicianProfileId],
  );
}

// ── Read (single) ─────────────────────────────────────────
export async function getReviewById(id) {
  const { rows } = await query(`SELECT ${REVIEW_COLUMNS} ${FROM_CLAUSE} WHERE r.id = $1 LIMIT 1`, [id]);
  return toPublicReview(rows[0]);
}

// ── Read (lists) ──────────────────────────────────────────
async function listReviews(whereClause, whereParams, { page, limit }) {
  const whereSql = whereClause ? `WHERE ${whereClause}` : '';
  const offset = (page - 1) * limit; let i = whereParams.length + 1;
  const rowsP = query(`SELECT ${REVIEW_COLUMNS} ${FROM_CLAUSE} ${whereSql} ORDER BY r.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...whereParams, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM reviews r ${whereSql}`, whereParams);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicReview), page, limit, total: countRes.rows[0].total };
}

export async function listTechnicianReviews(techProfileId, filters) {
  return listReviews('r.technician_id = $1 AND r.is_visible = TRUE', [techProfileId], filters);
}

export async function listAllReviews(filters) {
  return listReviews('', [], filters);
}

// ── Create ────────────────────────────────────────────────
export async function createReview(clientId, data) {
  const { rows: bookingRows } = await query(`SELECT id, client_id, technician_id, status FROM bookings WHERE id = $1 LIMIT 1`, [data.bookingId]);
  if (!bookingRows.length) throwError('Booking not found', 404);
  const booking = bookingRows[0];
  if (booking.client_id !== clientId) throwError('You can only review your own bookings', 403);
  if (booking.status !== 'completed') throwError('You can only review completed bookings', 400);

  const { rows: existingRows } = await query(`SELECT 1 FROM reviews WHERE booking_id = $1 LIMIT 1`, [data.bookingId]);
  if (existingRows.length > 0) throwError('A review already exists for this booking', 409);

  try {
    const { rows } = await query(
      `INSERT INTO reviews (booking_id, client_id, technician_id, rating, comment) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [data.bookingId, clientId, booking.technician_id, data.rating, data.comment ?? '']);
    await recalcTechnicianRating(booking.technician_id);
    return getReviewById(rows[0].id);
  } catch (err) {
    if (err.code === '23505') throwError('A review already exists for this booking', 409);
    throw err;
  }
}

// ── Update ────────────────────────────────────────────────
export async function updateReview(reviewId, clientId, data) {
  const { rows: reviewRows } = await query(`SELECT id, client_id, technician_id FROM reviews WHERE id = $1 LIMIT 1`, [reviewId]);
  if (!reviewRows.length) throwError('Review not found', 404);
  const review = reviewRows[0];
  if (review.client_id !== clientId) throwError('You can only update your own reviews', 403);

  const colMap = { rating: 'rating', comment: 'comment' };
  const sets = []; const params = []; let i = 1;
  for (const [k, c] of Object.entries(colMap)) { if (data[k] !== undefined) { sets.push(`${c} = $${i++}`); params.push(data[k]); } }
  if (!sets.length) return getReviewById(reviewId);
  params.push(reviewId);
  await query(`UPDATE reviews SET ${sets.join(', ')} WHERE id = $${i}`, params);
  await recalcTechnicianRating(review.technician_id);
  return getReviewById(reviewId);
}

// ── Delete ────────────────────────────────────────────────
export async function deleteReview(reviewId, clientId) {
  const { rows: reviewRows } = await query(`SELECT id, client_id, technician_id FROM reviews WHERE id = $1 LIMIT 1`, [reviewId]);
  if (!reviewRows.length) throwError('Review not found', 404);
  const review = reviewRows[0];
  if (review.client_id !== clientId) throwError('You can only delete your own reviews', 403);
  await query(`DELETE FROM reviews WHERE id = $1`, [reviewId]);
  await recalcTechnicianRating(review.technician_id);
}

// ── Admin: toggle visibility ──────────────────────────────
export async function toggleReviewVisibility(reviewId) {
  const { rows } = await query(
    `UPDATE reviews SET is_visible = NOT is_visible WHERE id = $1 RETURNING id, technician_id, is_visible`, [reviewId]);
  if (!rows.length) throwError('Review not found', 404);
  await recalcTechnicianRating(rows[0].technician_id);
  return getReviewById(rows[0].id);
}

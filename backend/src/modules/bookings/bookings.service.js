import { query, pool } from '../../config/db.js';
import { eventBus, EVENTS } from '../../events/eventBus.js';
import { payFromWallet, creditWallet, getOrCreateWallet } from '../wallet/wallet.service.js';

// ── Status transition rules ───────────────────────────────
const VALID_TRANSITIONS = {
  pending:     ['accepted', 'rejected', 'cancelled'],
  accepted:    ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  rejected:    [],
  cancelled:   [],
  completed:   [],
};

const BOOKING_COLUMNS = `
  b.id, b.client_id, b.technician_id, b.category_id, b.slot_id,
  b.booking_date, b.service_title, b.description,
  b.agreed_price, b.client_latitude, b.client_longitude, b.client_address,
  b.status, b.cancelled_by, b.cancellation_note,
  b.payment_status,
  b.created_at, b.updated_at,
  cu.full_name  AS client_name,
  cu.avatar_url AS client_avatar,
  cu.phone      AS client_phone,
  cu.location_label AS client_location_label,
  tu.full_name  AS technician_name,
  tu.id         AS technician_user_id,
  sc.name       AS category_name,
  ts.start_time AS slot_start_time,
  ts.end_time   AS slot_end_time
`;

const FROM_CLAUSE = `
  FROM bookings b
  JOIN users cu ON cu.id = b.client_id
  JOIN technician_profiles tp ON tp.id = b.technician_id
  JOIN users tu ON tu.id = tp.user_id
  LEFT JOIN service_categories sc ON sc.id = b.category_id
  LEFT JOIN time_slots ts ON ts.id = b.slot_id
`;

function toPublicBooking(row) {
  if (!row) return null;
  return {
    id: row.id, clientId: row.client_id, technicianId: row.technician_id,
    categoryId: row.category_id, slotId: row.slot_id,
    bookingDate: row.booking_date, serviceTitle: row.service_title,
    description: row.description,
    agreedPrice: row.agreed_price != null ? Number(row.agreed_price) : null,
    clientLatitude: row.client_latitude != null ? Number(row.client_latitude) : null,
    clientLongitude: row.client_longitude != null ? Number(row.client_longitude) : null,
    clientAddress: row.client_address,
    status: row.status, cancelledBy: row.cancelled_by,
    cancellationNote: row.cancellation_note,
    paymentStatus: row.payment_status,
    createdAt: row.created_at, updatedAt: row.updated_at,
    client: { 
      fullName: row.client_name, 
      avatarUrl: row.client_avatar,
      phone: row.client_phone,
      locationLabel: row.client_location_label
    },
    technician: { fullName: row.technician_name, userId: row.technician_user_id },
    category: row.category_name ? { name: row.category_name } : null,
    slot: row.slot_id ? { startTime: row.slot_start_time, endTime: row.slot_end_time } : null
  };
}

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function assertTransition(cur, next) {
  const allowed = VALID_TRANSITIONS[cur] ?? [];
  if (!allowed.includes(next)) throwError(`Cannot transition from "${cur}" to "${next}"`, 400);
}

async function resolveTechProfileId(userId) {
  const { rows } = await query(`SELECT id FROM technician_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!rows.length) throwError('Technician profile not found for this user', 404);
  return rows[0].id;
}

// ── Status History ────────────────────────────────────────
async function insertStatusHistory(bookingId, oldStatus, newStatus, changedBy, note) {
  await query(
    `INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, oldStatus, newStatus, changedBy, note ?? null],
  );
}

export async function getStatusHistory(bookingId) {
  const { rows } = await query(
    `SELECT bsh.id, bsh.old_status, bsh.new_status, bsh.note, bsh.created_at,
            u.full_name AS changed_by_name
       FROM booking_status_history bsh
       LEFT JOIN users u ON u.id = bsh.changed_by
      WHERE bsh.booking_id = $1
      ORDER BY bsh.created_at`,
    [bookingId],
  );
  return rows.map(r => ({
    id: r.id, oldStatus: r.old_status, newStatus: r.new_status,
    note: r.note, createdAt: r.created_at,
    changedBy: r.changed_by_name ? { fullName: r.changed_by_name } : null,
  }));
}

// ── Create ────────────────────────────────────────────────
export async function createBooking(clientId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify Technician exists
    const { rows: techRows } = await client.query(`SELECT id, inspection_fee FROM technician_profiles WHERE id = $1 LIMIT 1`, [data.technicianId]);
    if (!techRows.length) throwError('Technician profile not found', 404);
    const inspectionFee = techRows[0].inspection_fee;

    // 2. If slot is provided, validate slot & double bookings
    if (data.slotId && data.bookingDate) {
      // Lock slot to prevent concurrent bookings
      const { rows: slotRows } = await client.query(`
        SELECT ts.id, ts.technician_id, ts.max_bookings, ts.is_active, wd.is_active as wd_is_active 
        FROM time_slots ts 
        JOIN technician_work_days wd ON wd.id = ts.work_day_id 
        WHERE ts.id = $1 FOR UPDATE
      `, [data.slotId]);

      if (!slotRows.length) throwError('Time slot not found', 404);
      const slot = slotRows[0];

      if (slot.technician_id !== data.technicianId) throwError('Slot does not belong to this technician', 400);
      if (!slot.is_active || !slot.wd_is_active) throwError('Slot or work day is not active', 400);

      // Check slot capacity and double bookings
      const { rows: existingRows } = await client.query(`
        SELECT client_id, status FROM bookings 
        WHERE slot_id = $1 AND booking_date = $2 AND status NOT IN ('cancelled', 'rejected')
      `, [data.slotId, data.bookingDate]);

      if (existingRows.length >= slot.max_bookings) throwError('Time slot is fully booked', 409);
      if (existingRows.some(r => r.client_id === clientId)) throwError('You have already booked this slot', 409);
    }

    // 3. Insert booking
    const { rows } = await client.query(
      `INSERT INTO bookings
         (client_id, technician_id, category_id, slot_id, booking_date,
          service_title, description, agreed_price,
          client_latitude, client_longitude, client_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [clientId, data.technicianId, data.categoryId ?? null, data.slotId ?? null,
       data.bookingDate ?? null, data.serviceTitle, data.description ?? '',
       inspectionFee, data.clientLatitude ?? null,
       data.clientLongitude ?? null, data.clientAddress ?? ''],
    );

    const newBookingId = rows[0].id;
    await client.query(
      `INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, note)
       VALUES ($1, NULL, 'pending', $2, 'Booking created')`,
      [newBookingId, clientId]
    );

    await client.query('COMMIT');

    const newBooking = await getBookingById(newBookingId);
    if (newBooking.technician.userId) {
      eventBus.emit(EVENTS.BOOKING_CREATED, { userId: newBooking.technician.userId, serviceTitle: newBooking.serviceTitle, bookingId: newBookingId });
    }
    return newBooking;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Read (single) ─────────────────────────────────────────
export async function getBookingById(bookingId) {
  const { rows } = await query(`SELECT ${BOOKING_COLUMNS} ${FROM_CLAUSE} WHERE b.id = $1 LIMIT 1`, [bookingId]);
  if (!rows.length) throwError('Booking not found', 404);
  return toPublicBooking(rows[0]);
}

// ── Read (lists) ──────────────────────────────────────────
async function listBookings(whereClause, whereParams, { status, page, limit }) {
  const conditions = whereClause ? [whereClause] : [];
  const params = [...whereParams]; let i = params.length + 1;
  if (status) { conditions.push(`b.status = $${i++}`); params.push(status); }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT ${BOOKING_COLUMNS} ${FROM_CLAUSE} ${whereSql} ORDER BY b.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM bookings b ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicBooking), page, limit, total: countRes.rows[0].total };
}

export async function listClientBookings(clientId, filters) {
  return listBookings('b.client_id = $1', [clientId], filters);
}

export async function listTechnicianBookings(userId, filters) {
  const techProfileId = await resolveTechProfileId(userId);
  return listBookings('b.technician_id = $1', [techProfileId], filters);
}

export async function listAllBookings(filters) {
  return listBookings('', [], filters);
}

// ── Cancel (client) ───────────────────────────────────────
export async function cancelBooking(bookingId, clientId, cancellationNote) {
  const booking = await getBookingById(bookingId);
  if (!booking) throwError('Booking not found', 404);
  if (booking.clientId !== clientId) throwError('You can only cancel your own bookings', 403);
  assertTransition(booking.status, 'cancelled');

  const { rowCount } = await query(
    `UPDATE bookings SET status = 'cancelled', cancelled_by = 'client', cancellation_note = $2, updated_at = NOW() WHERE id = $1 AND status = $3`,
    [bookingId, cancellationNote ?? null, booking.status],
  );
  if (rowCount === 0) throwError('Booking status changed concurrently', 409);

  if (booking.paymentStatus === 'reserved') {
    // Refund client
    await getOrCreateWallet(booking.clientId);
    await creditWallet(booking.clientId, {
      type: 'refund',
      amount: booking.agreedPrice,
      referenceType: 'booking',
      referenceId: bookingId,
      note: 'Refund for cancelled booking'
    });
    await query(`UPDATE bookings SET payment_status = 'refunded' WHERE id = $1`, [bookingId]);
  }

  await insertStatusHistory(bookingId, booking.status, 'cancelled', clientId, cancellationNote);
  const updatedBooking = await getBookingById(bookingId);
  if (updatedBooking.technician.userId) {
    eventBus.emit(EVENTS.BOOKING_STATUS_CHANGED, { userId: updatedBooking.technician.userId, serviceTitle: updatedBooking.serviceTitle, status: 'cancelled', bookingId });
  }
  return updatedBooking;
}

// ── Client pays quote ─────────────────────────────────────
export async function payQuote(bookingId, clientId) {
  const booking = await getBookingById(bookingId);
  if (!booking) throwError('Booking not found', 404);
  if (booking.clientId !== clientId) throwError('You can only pay for your own bookings', 403);
  if (booking.paymentStatus !== 'unpaid') throwError('Booking is already paid', 400);
  if (!booking.agreedPrice) throwError('Booking fee is missing', 400);
  if (!['pending', 'accepted'].includes(booking.status)) throwError('Cannot pay for booking in current status', 400);

  // Optimistically lock the booking for payment
  const { rowCount } = await query(
    `UPDATE bookings SET payment_status = 'reserved', updated_at = NOW() WHERE id = $1 AND payment_status = 'unpaid'`,
    [bookingId]
  );
  
  if (rowCount === 0) {
    throwError('Booking is already paid or payment is processing', 400);
  }

  try {
    // Debit the client's wallet
    await payFromWallet(clientId, booking.agreedPrice, 'booking', bookingId);
  } catch (err) {
    // Revert if payment failed
    await query(`UPDATE bookings SET payment_status = 'unpaid' WHERE id = $1`, [bookingId]);
    throw err;
  }
  
  const updatedBooking = await getBookingById(bookingId);
  eventBus.emit(EVENTS.PAYMENT_PROCESSED, { userId: clientId, amount: booking.agreedPrice, isTechnician: false });
  if (updatedBooking.technician.userId) {
    eventBus.emit(EVENTS.BOOKING_STATUS_CHANGED, { userId: updatedBooking.technician.userId, serviceTitle: updatedBooking.serviceTitle, status: 'paid', bookingId });
  }
  return updatedBooking;
}

// ── Update status (technician) ────────────────────────────
export async function updateBookingStatus(bookingId, userId, newStatus) {
  const techProfileId = await resolveTechProfileId(userId);
  const booking = await getBookingById(bookingId);
  if (!booking) throwError('Booking not found', 404);
  if (booking.technicianId !== techProfileId) throwError('You can only manage bookings assigned to you', 403);
  assertTransition(booking.status, newStatus);

  if (newStatus === 'in_progress' && booking.paymentStatus !== 'reserved') {
    throwError('Cannot start work until client pays the quotation', 400);
  }

  const cancelledBy = newStatus === 'cancelled' ? 'technician' : null;
  const { rowCount } = await query(
    `UPDATE bookings SET status = $1, cancelled_by = COALESCE($3, cancelled_by), updated_at = NOW() WHERE id = $2 AND status = $4`,
    [newStatus, bookingId, cancelledBy, booking.status],
  );
  if (rowCount === 0) throwError('Booking status changed concurrently', 409);
  
  if (newStatus === 'completed' && booking.paymentStatus === 'reserved') {
    // Release funds to technician
    await getOrCreateWallet(booking.technician.userId); // Ensure wallet exists
    await creditWallet(booking.technician.userId, { 
      type: 'payment', 
      amount: booking.agreedPrice, 
      referenceType: 'booking', 
      referenceId: bookingId, 
      note: 'Payment for completed booking' 
    });
    await query(`UPDATE bookings SET payment_status = 'released' WHERE id = $1`, [bookingId]);
    eventBus.emit(EVENTS.PAYMENT_PROCESSED, { userId: booking.technician.userId, amount: booking.agreedPrice, isTechnician: true });
  }

  if (newStatus === 'cancelled' && booking.paymentStatus === 'reserved') {
    // Refund client
    await getOrCreateWallet(booking.clientId);
    await creditWallet(booking.clientId, {
      type: 'refund',
      amount: booking.agreedPrice,
      referenceType: 'booking',
      referenceId: bookingId,
      note: 'Refund for tech-cancelled booking'
    });
    await query(`UPDATE bookings SET payment_status = 'refunded' WHERE id = $1`, [bookingId]);
  }

  await insertStatusHistory(bookingId, booking.status, newStatus, userId, null);
  const updatedBooking = await getBookingById(bookingId);
  eventBus.emit(EVENTS.BOOKING_STATUS_CHANGED, { userId: updatedBooking.clientId, serviceTitle: updatedBooking.serviceTitle, status: newStatus, bookingId });
  return updatedBooking;
}

// ── Update status (admin override) ────────────────────────
export async function adminUpdateBookingStatus(bookingId, newStatus, adminUserId) {
  const booking = await getBookingById(bookingId);
  if (!booking) throwError('Booking not found', 404);

  const cancelledBy = newStatus === 'cancelled' ? 'admin' : null;
  await query(
    `UPDATE bookings SET status = $1, cancelled_by = COALESCE($3, cancelled_by), updated_at = NOW() WHERE id = $2`,
    [newStatus, bookingId, cancelledBy],
  );
  await insertStatusHistory(bookingId, booking.status, newStatus, adminUserId, 'Admin override');
  const updatedBooking = await getBookingById(bookingId);
  eventBus.emit(EVENTS.BOOKING_STATUS_CHANGED, { userId: updatedBooking.clientId, serviceTitle: updatedBooking.serviceTitle, status: newStatus, bookingId });
  if (updatedBooking.technician.userId) {
    eventBus.emit(EVENTS.BOOKING_STATUS_CHANGED, { userId: updatedBooking.technician.userId, serviceTitle: updatedBooking.serviceTitle, status: newStatus, bookingId });
  }
  return updatedBooking;
}

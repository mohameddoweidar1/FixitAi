import { query } from '../../config/db.js';

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

// ── Notifications ─────────────────────────────────────────
export async function createNotification(userId, { type, title, body, entityType, entityId }) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, type ?? 'info', title, body ?? '', entityType ?? null, entityId ?? null]);
  return toNotification(rows[0]);
}

export async function listUserNotifications(userId, { page, limit, unreadOnly }) {
  const where = ['n.user_id = $1']; const params = [userId]; let i = 2;
  if (unreadOnly) { where.push('n.is_read = FALSE'); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const rowsP = query(`SELECT * FROM notifications n ${whereSql} ORDER BY n.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM notifications n ${whereSql}`, params);
  const unreadP = query(`SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND is_read = FALSE`, [userId]);
  const [rowsRes, countRes, unreadRes] = await Promise.all([rowsP, countP, unreadP]);
  return {
    items: rowsRes.rows.map(toNotification), page, limit,
    total: countRes.rows[0].total, unreadCount: unreadRes.rows[0].total,
  };
}

export async function markAsRead(notificationId, userId) {
  const { rowCount } = await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
  if (!rowCount) throwError('Notification not found', 404);
}

export async function markAllRead(userId) {
  await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [userId]);
}

function toNotification(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, type: r.type, title: r.title, body: r.body,
    entityType: r.entity_type, entityId: r.entity_id, isRead: r.is_read, createdAt: r.created_at,
  };
}

// ── Disputes ──────────────────────────────────────────────
export async function createDispute(reporterId, data) {
  // Validate reported user exists
  const { rows: userRows } = await query(`SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [data.reportedId]);
  if (!userRows.length) throwError('Reported user not found', 404);

  const { rows } = await query(
    `INSERT INTO disputes (reporter_id, reported_id, booking_id, reason)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [reporterId, data.reportedId, data.bookingId ?? null, data.reason]);
  return toDispute(rows[0]);
}

export async function listDisputes({ status, page, limit }) {
  const where = []; const params = []; let i = 1;
  if (status) { where.push(`d.status = $${i++}`); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rowsP = query(
    `SELECT d.*, reporter.full_name AS reporter_name, reported.full_name AS reported_name
       FROM disputes d
       JOIN users reporter ON reporter.id = d.reporter_id
       JOIN users reported ON reported.id = d.reported_id
     ${whereSql} ORDER BY d.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]);
  const countP = query(`SELECT COUNT(*)::int AS total FROM disputes d ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toDispute), page, limit, total: countRes.rows[0].total };
}

export async function getDisputeById(id) {
  const { rows } = await query(
    `SELECT d.*, reporter.full_name AS reporter_name, reported.full_name AS reported_name
       FROM disputes d
       JOIN users reporter ON reporter.id = d.reporter_id
       JOIN users reported ON reported.id = d.reported_id
      WHERE d.id = $1 LIMIT 1`, [id]);
  return toDispute(rows[0]);
}

export async function resolveDispute(disputeId, adminUserId, { status, resolutionNote }) {
  const { rows } = await query(
    `UPDATE disputes SET status = $2, resolved_by = $3, resolution_note = $4, updated_at = NOW()
     WHERE id = $1 RETURNING *`, [disputeId, status, adminUserId, resolutionNote ?? null]);
  if (!rows.length) throwError('Dispute not found', 404);
  return getDisputeById(disputeId);
}

function toDispute(r) {
  if (!r) return null;
  return {
    id: r.id, reporterId: r.reporter_id, reportedId: r.reported_id,
    bookingId: r.booking_id, reason: r.reason, status: r.status,
    resolvedBy: r.resolved_by, resolutionNote: r.resolution_note,
    createdAt: r.created_at, updatedAt: r.updated_at,
    reporter: r.reporter_name ? { fullName: r.reporter_name } : undefined,
    reported: r.reported_name ? { fullName: r.reported_name } : undefined,
  };
}

// ── Chat Sessions ─────────────────────────────────────────
export async function createSession(userId, title) {
  const { rows } = await query(
    `INSERT INTO chat_sessions (user_id, title) VALUES ($1,$2) RETURNING *`,
    [userId, title ?? 'New Chat']);
  return toSession(rows[0]);
}

export async function listSessions(userId) {
  const { rows } = await query(
    `SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return rows.map(toSession);
}

export async function getSessionById(sessionId, userId) {
  const { rows } = await query(
    `SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`, [sessionId, userId]);
  if (!rows.length) throwError('Chat session not found', 404);
  return toSession(rows[0]);
}

function toSession(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ── Chat Messages ─────────────────────────────────────────
export async function addMessage(sessionId, userId, { senderType, content }) {
  // Verify session ownership
  await getSessionById(sessionId, userId);
  const { rows } = await query(
    `INSERT INTO chat_messages (session_id, sender_type, content) VALUES ($1,$2,$3) RETURNING *`,
    [sessionId, senderType ?? 'user', content]);
  // Touch the session's updated_at
  await query(`UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1`, [sessionId]);
  return toMessage(rows[0]);
}

export async function listMessages(sessionId, userId) {
  // Verify session ownership
  await getSessionById(sessionId, userId);
  const { rows } = await query(
    `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at`, [sessionId]);
  return rows.map(toMessage);
}

function toMessage(r) {
  if (!r) return null;
  return { id: r.id, sessionId: r.session_id, senderType: r.sender_type, content: r.content, createdAt: r.created_at };
}

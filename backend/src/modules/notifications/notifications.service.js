import { query } from '../../config/db.js';

export async function createNotification(userId, title, message, type = 'system', entityType = null, entityId = null) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, title, body, type, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, body AS message, type, entity_type AS "entityType", entity_id AS "entityId", is_read AS "isRead", created_at AS "createdAt"`,
    [userId, title, message, type, entityType, entityId]
  );
  return rows[0];
}

export async function getUserNotifications(userId, limit = 50) {
  const { rows } = await query(
    `SELECT id, title, body AS message, type, entity_type AS "entityType", entity_id AS "entityId", is_read AS "isRead", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getUnreadCount(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return rows[0].count;
}

export async function markAsRead(userId, notificationId) {
  const { rowCount } = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1 AND id = $2`,
    [userId, notificationId]
  );
  return rowCount > 0;
}

export async function markAllAsRead(userId) {
  await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
}

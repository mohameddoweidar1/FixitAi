import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { storage } from '../../utils/fileStorage.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function throwError(msg, status) {
  const e = new Error(msg);
  e.status = status;
  throw e;
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    locationLabel: row.location_label,
    city: row.city ?? null,
    country: row.country ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Profile Read ─────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { rows } = await query(
    `SELECT id, email, full_name, role, phone,
            avatar_url, latitude, longitude, location_label,
            city, country, is_active, created_at, updated_at
       FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [userId],
  );
  if (!rows[0]) throwError('User not found', 404);
  return toPublicUser(rows[0]);
}

// ── Profile Update ───────────────────────────────────────────────────────────

export async function updateProfile(userId, data) {
  const colMap = {
    fullName: 'full_name',
    phone: 'phone',
    latitude: 'latitude',
    longitude: 'longitude',
    locationLabel: 'location_label',
    city: 'city',
    country: 'country',
  };

  const sets = [];
  const params = [];
  let i = 1;

  for (const [key, col] of Object.entries(colMap)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      params.push(data[key]);
    }
  }

  if (!sets.length) return getProfile(userId);

  sets.push('updated_at = NOW()');
  params.push(userId);

  await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL`,
    params,
  );

  return getProfile(userId);
}

// ── Avatar Update ────────────────────────────────────────────────────────────

export async function updateAvatar(userId, uploadedFile) {
  if (!uploadedFile) throwError('No file uploaded', 400);

  // Fetch the old avatar to clean up
  const { rows: old } = await query(
    `SELECT avatar_url FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );

  if (old[0]?.avatar_url) {
    // Extract relative path from URL: /uploads/avatars/xxx.webp → avatars/xxx.webp
    const oldPath = old[0].avatar_url.replace(/^\/uploads\//, '');
    try {
      await storage.delete(oldPath);
    } catch {
      // Old file may already be gone — non-fatal
    }
  }

  await query(
    `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
    [uploadedFile.url, userId],
  );

  return getProfile(userId);
}

// ── Password Change ──────────────────────────────────────────────────────────

export async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query(
    `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId],
  );
  if (!rows[0]) throwError('User not found', 404);

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) throwError('Current password is incorrect', 400);

  const newHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, userId],
  );
}

// ── Admin: List Users ────────────────────────────────────────────────────────

export async function adminListUsers({ page, limit, role, search, isActive }) {
  const where = ['deleted_at IS NULL'];
  const params = [];
  let i = 1;

  if (role) {
    where.push(`role = $${i++}`);
    params.push(role);
  }

  if (typeof isActive === 'boolean') {
    where.push(`is_active = $${i++}`);
    params.push(isActive);
  }

  if (search) {
    where.push(`(full_name ILIKE $${i} OR email ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT id, email, full_name, role, phone, avatar_url,
              latitude, longitude, location_label, city, country,
              is_active, created_at, updated_at
         FROM users ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset],
    ),
    query(`SELECT COUNT(*)::int AS total FROM users ${whereSql}`, params),
  ]);

  return {
    items: rowsRes.rows.map(toPublicUser),
    page,
    limit,
    total: countRes.rows[0].total,
  };
}

// ── Admin: Get Stats ─────────────────────────────────────────────────────────

export async function adminGetStats() {
  const { rows } = await query(`
    SELECT
      COUNT(*)::int                                                   AS total,
      COUNT(*) FILTER (WHERE is_active = TRUE AND deleted_at IS NULL)::int  AS active,
      COUNT(*) FILTER (WHERE role = 'client')::int                    AS clients,
      COUNT(*) FILTER (WHERE role = 'technician')::int                AS technicians,
      COUNT(*) FILTER (WHERE role = 'admin')::int                     AS admins,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS "newLast30d"
    FROM users
    WHERE deleted_at IS NULL
  `);
  return rows[0];
}

// ── Admin: Get User by ID ────────────────────────────────────────────────────

export async function adminGetUser(id) {
  const { rows } = await query(
    `SELECT id, email, full_name, role, phone, avatar_url,
            latitude, longitude, location_label, city, country,
            is_active, created_at, updated_at
       FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [id],
  );
  if (!rows[0]) throwError('User not found', 404);
  return toPublicUser(rows[0]);
}

// ── Admin: Update User ───────────────────────────────────────────────────────

export async function adminUpdateUser(id, data) {
  const colMap = {
    fullName: 'full_name',
    phone: 'phone',
    role: 'role',
  };

  const sets = [];
  const params = [];
  let i = 1;

  for (const [key, col] of Object.entries(colMap)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      params.push(data[key]);
    }
  }

  if (!sets.length) return adminGetUser(id);

  sets.push('updated_at = NOW()');
  params.push(id);

  const { rowCount } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL`,
    params,
  );
  if (!rowCount) throwError('User not found', 404);

  return adminGetUser(id);
}

// ── Admin: Activate / Deactivate ─────────────────────────────────────────────

export async function adminSetActive(id, active) {
  const { rowCount } = await query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
    [active, id],
  );
  if (!rowCount) throwError('User not found', 404);
  return adminGetUser(id);
}

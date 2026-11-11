import { query } from '../../config/db.js';
import { storage } from '../../utils/fileStorage.js';

const PROFILE_COLUMNS = `
  tp.id, tp.user_id, tp.bio, tp.experience_years, tp.hourly_rate,
  tp.inspection_fee, tp.id_image_url, tp.is_verified, tp.is_available,
  tp.rating_avg, tp.rating_count, tp.area_latitude, tp.area_longitude,
  tp.area_radius_km, tp.created_at, tp.updated_at,
  u.full_name, u.avatar_url, u.email AS user_email_col, u.location_label,
  u.city AS user_city, u.country AS user_country,
  u.latitude AS user_latitude, u.longitude AS user_longitude
`;

function toPublicProfile(row) {
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, bio: row.bio,
    experienceYears: row.experience_years,
    hourlyRate: Number(row.hourly_rate ?? 0),
    inspectionFee: Number(row.inspection_fee ?? 0),
    idImageUrl: row.id_image_url,
    isVerified: row.is_verified, isAvailable: row.is_available,
    ratingAvg: Number(row.rating_avg ?? 0), ratingCount: row.rating_count,
    areaLatitude: row.area_latitude != null ? Number(row.area_latitude) : null,
    areaLongitude: row.area_longitude != null ? Number(row.area_longitude) : null,
    areaRadiusKm: row.area_radius_km != null ? Number(row.area_radius_km) : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
    // Enriched user object with avatar, location
    user: {
      fullName: row.full_name,
      avatarUrl: row.avatar_url ?? null,
      locationLabel: row.location_label ?? null,
      city: row.user_city ?? null,
      country: row.user_country ?? null,
    },
    // Top-level convenience fields for frontend
    city: row.user_city || row.location_label || null,
    country: row.user_country || null,
    specialty: row.specialty_name || null,
    activeWorkDays: row.active_work_days || [],
  };
}

function throwError(msg, status) { const e = new Error(msg); e.status = status; throw e; }

// ── Read ──────────────────────────────────────────────────
export async function listProfiles({ categoryId, minRating, available, city, days, page, limit }) {
  const where = [
    `u.avatar_url IS NOT NULL`,
    `tp.bio IS NOT NULL AND tp.bio != ''`,
    `tp.area_latitude IS NOT NULL`,
    `u.is_active = TRUE`,
    `EXISTS (SELECT 1 FROM technician_specializations ts WHERE ts.technician_id = tp.id)`,
    `EXISTS (SELECT 1 FROM time_slots tss JOIN technician_work_days twd ON twd.id = tss.work_day_id WHERE tss.technician_id = tp.id AND tss.is_active = TRUE AND twd.is_active = TRUE)`
  ];
  const params = []; let i = 1;
  if (categoryId) {
    where.push(`EXISTS (SELECT 1 FROM technician_specializations ts2 WHERE ts2.technician_id = tp.id AND ts2.category_id = $${i++})`);
    params.push(categoryId);
  }
  if (typeof minRating === 'number') { where.push(`tp.rating_avg >= $${i++}`); params.push(minRating); }
  if (typeof available === 'boolean') { where.push(`tp.is_available = $${i++}`); params.push(available); }
  if (city) { where.push(`u.city ILIKE $${i++}`); params.push(`%${city}%`); }
  if (days && days.length > 0) {
    where.push(`EXISTS (
      SELECT 1 FROM technician_work_days twd 
      WHERE twd.technician_id = tp.id 
      AND twd.is_active = TRUE 
      AND twd.day_of_week = ANY($${i++}::int[])
    )`);
    params.push(days);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  // LEFT JOIN to get the first specialization name as "specialty"
  const specialtySql = `LEFT JOIN LATERAL (
    SELECT sc.name AS specialty_name FROM technician_specializations tsp
    JOIN service_categories sc ON sc.id = tsp.category_id
    WHERE tsp.technician_id = tp.id ORDER BY sc.name LIMIT 1
  ) spec ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(twd.day_of_week) AS active_work_days
    FROM technician_work_days twd
    WHERE twd.technician_id = tp.id AND twd.is_active = TRUE
  ) wd ON TRUE`;
  const rowsP = query(
    `SELECT ${PROFILE_COLUMNS}, spec.specialty_name, wd.active_work_days
       FROM technician_profiles tp
       JOIN users u ON u.id = tp.user_id
       ${specialtySql}
     ${whereSql}
     ORDER BY tp.is_verified DESC, tp.rating_avg DESC, tp.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );
  const countP = query(`SELECT COUNT(*)::int AS total FROM technician_profiles tp JOIN users u ON u.id = tp.user_id ${whereSql}`, params);
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return { items: rowsRes.rows.map(toPublicProfile), page, limit, total: countRes.rows[0].total };
}

export async function adminListProfiles({ search, isVerified, isAvailable, page, limit }) {
  const where = []; const params = []; let i = 1;
  if (search) {
    where.push(`(u.full_name ILIKE $${i} OR u.email ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }
  if (typeof isVerified === 'boolean') { where.push(`tp.is_verified = $${i++}`); params.push(isVerified); }
  if (typeof isAvailable === 'boolean') { where.push(`tp.is_available = $${i++}`); params.push(isAvailable); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const specialtySql = `LEFT JOIN LATERAL (
    SELECT sc.name AS specialty_name FROM technician_specializations tsp
    JOIN service_categories sc ON sc.id = tsp.category_id
    WHERE tsp.technician_id = tp.id ORDER BY sc.name LIMIT 1
  ) spec ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(twd.day_of_week) AS active_work_days
    FROM technician_work_days twd
    WHERE twd.technician_id = tp.id AND twd.is_active = TRUE
  ) wd ON TRUE`;
  const rowsP = query(
    `SELECT ${PROFILE_COLUMNS}, spec.specialty_name, wd.active_work_days, u.is_active AS user_is_active
       FROM technician_profiles tp JOIN users u ON u.id = tp.user_id
       ${specialtySql}
     ${whereSql} ORDER BY tp.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );
  const countP = query(
    `SELECT COUNT(*)::int AS total FROM technician_profiles tp JOIN users u ON u.id = tp.user_id ${whereSql}`,
    params,
  );
  const [rowsRes, countRes] = await Promise.all([rowsP, countP]);
  return {
    items: rowsRes.rows.map(r => ({ ...toPublicProfile(r), email: r.user_email_col || r.user_email, userIsActive: r.user_is_active })),
    page, limit, total: countRes.rows[0].total,
  };
}

export async function getProfileById(id) {
  const { rows } = await query(`SELECT ${PROFILE_COLUMNS} FROM technician_profiles tp JOIN users u ON u.id = tp.user_id WHERE tp.id = $1 LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const { rows: specs } = await query(
    `SELECT ts.id, ts.category_id, sc.name AS category_name, sc.slug AS category_slug FROM technician_specializations ts JOIN service_categories sc ON sc.id = ts.category_id WHERE ts.technician_id = $1`, [id]);
  const profile = toPublicProfile(rows[0]);
  profile.specializations = specs.map(s => ({ id: s.id, categoryId: s.category_id, categoryName: s.category_name, categorySlug: s.category_slug }));
  return profile;
}

export async function getOwnProfile(userId) {
  const { rows } = await query(`SELECT ${PROFILE_COLUMNS} FROM technician_profiles tp JOIN users u ON u.id = tp.user_id WHERE tp.user_id = $1 LIMIT 1`, [userId]);
  if (!rows[0]) return null;
  const { rows: specs } = await query(
    `SELECT ts.id, ts.category_id, sc.name AS category_name, sc.slug AS category_slug FROM technician_specializations ts JOIN service_categories sc ON sc.id = ts.category_id WHERE ts.technician_id = $1`, [rows[0].id]);
  const profile = toPublicProfile(rows[0]);
  profile.specializations = specs.map(s => ({ id: s.id, categoryId: s.category_id, categoryName: s.category_name, categorySlug: s.category_slug }));
  return profile;
}

// ── Write ─────────────────────────────────────────────────
export async function createProfileForUser(userId, data) {
  const existing = await query(`SELECT 1 FROM technician_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  if (existing.rowCount > 0) throwError('Technician profile already exists for this user', 409);
  try {
    const { rows } = await query(
      `INSERT INTO technician_profiles (user_id, bio, experience_years, hourly_rate, inspection_fee, area_latitude, area_longitude, area_radius_km) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [userId, data.bio ?? '', data.experienceYears ?? 0, data.hourlyRate ?? 0, data.inspectionFee ?? 0, data.areaLatitude ?? null, data.areaLongitude ?? null, data.areaRadiusKm ?? 10]);
    return await getProfileById(rows[0].id);
  } catch (err) { if (err.code === '23505') throwError('Technician profile already exists for this user', 409); throw err; }
}

export async function updateProfileById(id, requesterUserId, data) {
  const { rows: cur } = await query(`SELECT user_id FROM technician_profiles WHERE id = $1 LIMIT 1`, [id]);
  if (!cur.length) throwError('Technician profile not found', 404);
  if (cur[0].user_id !== requesterUserId) throwError('You can only update your own technician profile', 403);
  const colMap = { bio:'bio', experienceYears:'experience_years', hourlyRate:'hourly_rate', inspectionFee:'inspection_fee', isAvailable:'is_available', areaLatitude:'area_latitude', areaLongitude:'area_longitude', areaRadiusKm:'area_radius_km' };
  const sets = []; const params = []; let i = 1;
  for (const [key, col] of Object.entries(colMap)) { if (data[key] !== undefined) { sets.push(`${col} = $${i++}`); params.push(data[key]); } }
  if (!sets.length) return await getProfileById(id);
  sets.push(`updated_at = NOW()`); params.push(id);
  await query(`UPDATE technician_profiles SET ${sets.join(', ')} WHERE id = $${i}`, params);
  return await getProfileById(id);
}

export async function toggleVerification(id) {
  const { rows } = await query(`UPDATE technician_profiles SET is_verified = NOT is_verified, updated_at = NOW() WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) throwError('Technician profile not found', 404);
  return await getProfileById(rows[0].id);
}

// ── Specializations ───────────────────────────────────────
export async function addSpecialization(techId, categoryId) {
  const { rows: c } = await query(`SELECT id FROM service_categories WHERE id = $1 AND is_active = TRUE LIMIT 1`, [categoryId]);
  if (!c.length) throwError('Category not found', 404);
  try { await query(`INSERT INTO technician_specializations (technician_id, category_id) VALUES ($1,$2)`, [techId, categoryId]); }
  catch (err) { if (err.code === '23505') throwError('Specialization already exists', 409); throw err; }
  return listSpecializations(techId);
}

export async function removeSpecialization(techId, categoryId) {
  const { rowCount } = await query(`DELETE FROM technician_specializations WHERE technician_id = $1 AND category_id = $2`, [techId, categoryId]);
  if (!rowCount) throwError('Specialization not found', 404);
  return listSpecializations(techId);
}

export async function listSpecializations(techId) {
  const { rows } = await query(`SELECT ts.id, ts.category_id, sc.name AS category_name, sc.slug AS category_slug FROM technician_specializations ts JOIN service_categories sc ON sc.id = ts.category_id WHERE ts.technician_id = $1 ORDER BY sc.name`, [techId]);
  return rows.map(s => ({ id: s.id, categoryId: s.category_id, categoryName: s.category_name, categorySlug: s.category_slug }));
}

// ── Work Days & Time Slots ────────────────────────────────
export async function setWorkDays(techId, days) {
  for (const d of days) {
    await query(`INSERT INTO technician_work_days (technician_id, day_of_week, is_active) VALUES ($1,$2,$3) ON CONFLICT (technician_id, day_of_week) DO UPDATE SET is_active = $3, updated_at = NOW()`, [techId, d.dayOfWeek, d.isActive]);
  }
  return listWorkDays(techId);
}

export async function listWorkDays(techId) {
  const { rows } = await query(`SELECT id, day_of_week, is_active, created_at, updated_at FROM technician_work_days WHERE technician_id = $1 ORDER BY day_of_week`, [techId]);
  return rows.map(r => ({ id: r.id, dayOfWeek: r.day_of_week, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export async function addTimeSlot(techId, data) {
  const { rows: wd } = await query(`SELECT id FROM technician_work_days WHERE id = $1 AND technician_id = $2 LIMIT 1`, [data.workDayId, techId]);
  if (!wd.length) throwError('Work day not found', 404);
  const { rows } = await query(`INSERT INTO time_slots (technician_id, work_day_id, start_time, end_time, max_bookings) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [techId, data.workDayId, data.startTime, data.endTime, data.maxBookings ?? 1]);
  return toSlot(rows[0]);
}

export async function updateTimeSlot(slotId, techId, data) {
  const { rows: s } = await query(`SELECT id FROM time_slots WHERE id = $1 AND technician_id = $2 LIMIT 1`, [slotId, techId]);
  if (!s.length) throwError('Time slot not found', 404);
  const colMap = { startTime:'start_time', endTime:'end_time', maxBookings:'max_bookings', isActive:'is_active' };
  const sets = []; const params = []; let i = 1;
  for (const [k, c] of Object.entries(colMap)) { if (data[k] !== undefined) { sets.push(`${c} = $${i++}`); params.push(data[k]); } }
  if (!sets.length) return toSlot(s[0]);
  sets.push(`updated_at = NOW()`); params.push(slotId);
  await query(`UPDATE time_slots SET ${sets.join(', ')} WHERE id = $${i}`, params);
  const { rows } = await query(`SELECT * FROM time_slots WHERE id = $1`, [slotId]);
  return toSlot(rows[0]);
}

export async function deleteTimeSlot(slotId, techId) {
  const { rowCount } = await query(`DELETE FROM time_slots WHERE id = $1 AND technician_id = $2`, [slotId, techId]);
  if (!rowCount) throwError('Time slot not found', 404);
}

export async function listTimeSlots(techId) {
  const { rows } = await query(`SELECT ts.*, wd.day_of_week FROM time_slots ts JOIN technician_work_days wd ON wd.id = ts.work_day_id WHERE ts.technician_id = $1 ORDER BY wd.day_of_week, ts.start_time`, [techId]);
  return rows.map(r => ({ ...toSlot(r), dayOfWeek: r.day_of_week }));
}

function toSlot(r) {
  if (!r) return null;
  return { id: r.id, technicianId: r.technician_id, workDayId: r.work_day_id, startTime: r.start_time, endTime: r.end_time, maxBookings: r.max_bookings, isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ── Gallery ───────────────────────────────────────────────
export async function addGalleryImage(techId, data) {
  const { rows } = await query(`INSERT INTO technician_gallery (technician_id, image_url, caption, display_order) VALUES ($1,$2,$3,$4) RETURNING *`, [techId, data.imageUrl, data.caption ?? null, data.displayOrder ?? 0]);
  return toGallery(rows[0]);
}

export async function removeGalleryImage(imageId, techId) {
  const { rows } = await query(
    `DELETE FROM technician_gallery WHERE id = $1 AND technician_id = $2 RETURNING image_url`,
    [imageId, techId]
  );
  if (!rows.length) throwError('Gallery image not found', 404);
  
  if (rows[0].image_url) {
    const oldPath = rows[0].image_url.replace(/^\/uploads\//, '');
    try {
      await storage.delete(oldPath);
    } catch (err) {
      console.warn(`Failed to delete gallery file: ${oldPath}`, err);
    }
  }
}

export async function listGallery(techId) {
  const { rows } = await query(`SELECT * FROM technician_gallery WHERE technician_id = $1 ORDER BY display_order, created_at`, [techId]);
  return rows.map(toGallery);
}

function toGallery(r) {
  return { id: r.id, technicianId: r.technician_id, imageUrl: r.image_url, caption: r.caption, displayOrder: r.display_order, createdAt: r.created_at };
}

// ── Service Categories ────────────────────────────────────────────────────────

export async function getAllCategories() {
  const { rows } = await query(
    `SELECT id, name, slug, description, icon_url, parent_id
       FROM service_categories
      WHERE is_active = TRUE
      ORDER BY name`,
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    iconUrl: r.icon_url,
    parentId: r.parent_id,
  }));
}

// ── Cities ────────────────────────────────────────────────────────────────────

export async function getAvailableCities() {
  const { rows } = await query(`
    SELECT DISTINCT u.city 
    FROM technician_profiles tp 
    JOIN users u ON u.id = tp.user_id 
    WHERE u.city IS NOT NULL AND u.is_active = TRUE
    ORDER BY u.city
  `);
  return rows.map(r => r.city);
}

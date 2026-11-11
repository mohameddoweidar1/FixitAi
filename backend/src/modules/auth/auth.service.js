import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { ROLES } from './auth.constants.js';
import { getOrCreateWallet } from '../wallet/wallet.service.js';
import { createProfileForUser } from '../technicians/technicians.service.js';

// Map a raw DB row to the public-facing user shape (no password hash, camelCase).
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

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, email, password_hash, full_name, role, phone,
            avatar_url, latitude, longitude, location_label, is_active,
            created_at, updated_at
       FROM users
      WHERE email = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, email, full_name, role, phone,
            avatar_url, latitude, longitude, location_label,
            city, country, is_active,
            created_at, updated_at
       FROM users
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
    [id],
  );
  return toPublicUser(rows[0]);
}

async function insertUser({ email, password, fullName, phone, role, latitude, longitude, locationLabel }) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name, role, phone, latitude, longitude, location_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, email, full_name, role, phone, avatar_url,
               latitude, longitude, location_label, is_active,
               created_at, updated_at`,
    [email, passwordHash, fullName, role, phone ?? null, latitude ?? null, longitude ?? null, locationLabel ?? null],
  );
  return toPublicUser(rows[0]);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export async function registerUser(input) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  try {
    const user = await insertUser({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role ?? ROLES.CLIENT,
      latitude: input.latitude,
      longitude: input.longitude,
      locationLabel: input.locationLabel,
    });

    // Auto-create wallet for every new user
    try { await getOrCreateWallet(user.id); } catch (e) {
      console.error('[auth] Failed to auto-create wallet:', e.message);
    }

    // Auto-create technician profile for technician role
    if (user.role === ROLES.TECHNICIAN) {
      try {
        await createProfileForUser(user.id, {});
      } catch (e) {
        console.error('[auth] Failed to auto-create technician profile:', e.message);
      }
    }

    const token = signToken(user);
    return { user, token };
  } catch (err) {
    // Race-condition safety net for the UNIQUE constraint on email.
    if (err.code === '23505') {
      const e = new Error('Email already registered');
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

export async function loginUser({ email, password }) {
  const row = await findUserByEmail(email);
  if (!row) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  if (!row.is_active) {
    const err = new Error('Account is deactivated');
    err.status = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const user = toPublicUser(row);
  const token = signToken(user);
  return { user, token };
}

export async function getCurrentUser(id) {
  const user = await findUserById(id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return user;
}

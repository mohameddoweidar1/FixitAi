import { query, pool } from '../config/db.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

async function seed() {
  console.log('Starting DB seed...');

  try {
    await query('BEGIN');

    // 1. Clear existing data (optional, but good for a fresh seed)
    await query(`
      TRUNCATE TABLE users, service_categories, technician_profiles, technician_specializations, 
      technician_work_days, time_slots, bookings, booking_status_history, technician_gallery,
      orders, order_items, payments, notifications CASCADE
    `);

    console.log('Cleared existing data.');

    // 2. Insert Service Categories
    const categories = [
      { name: 'Plumbing', slug: 'plumbing', description: 'Fix leaks, pipes, and water systems.' },
      { name: 'Electrical', slug: 'electrical', description: 'Wiring, fixtures, and electrical repairs.' },
      { name: 'HVAC', slug: 'hvac', description: 'Air conditioning and heating maintenance.' },
      { name: 'Carpentry', slug: 'carpentry', description: 'Furniture repair and woodworking.' },
      { name: 'Painting', slug: 'painting', description: 'Interior and exterior painting services.' },
    ];

    const categoryIds = {};
    for (const c of categories) {
      const res = await query(
        `INSERT INTO service_categories (name, slug, description) VALUES ($1, $2, $3) RETURNING id`,
        [c.name, c.slug, c.description]
      );
      categoryIds[c.slug] = res.rows[0].id;
    }

    // 3. Insert Users (Admin, Clients, Technicians)
    const hash = await bcrypt.hash('password123', 10);

    const usersData = [
      { email: 'admin@fixitai.com', full_name: 'System Admin', role: 'admin', phone: '01000000001' },
      { email: 'ahmed@client.com', full_name: 'Ahmed Hassan', role: 'client', phone: '01012345678' },
      { email: 'fatima@client.com', full_name: 'Fatima Ali', role: 'client', phone: '01112345678' },
      // Tech 1: Plumber (Fully Complete)
      { email: 'mahmoud@tech.com', full_name: 'Mahmoud Sayed', role: 'technician', phone: '01212345678', avatar_url: 'https://i.pravatar.cc/150?u=mahmoud', lat: 30.0444, lng: 31.2357, location: 'Cairo, Egypt' },
      // Tech 2: Electrician (Fully Complete)
      { email: 'omar@tech.com', full_name: 'Omar Ibrahim', role: 'technician', phone: '01512345678', avatar_url: 'https://i.pravatar.cc/150?u=omar', lat: 31.2001, lng: 29.9187, location: 'Alexandria, Egypt' },
      // Tech 3: HVAC (Incomplete - missing avatar)
      { email: 'youssef@tech.com', full_name: 'Youssef Moustafa', role: 'technician', phone: '01098765432', avatar_url: null, lat: 30.0131, lng: 31.2089, location: 'Giza, Egypt' },
    ];

    const insertedUsers = [];
    for (const u of usersData) {
      const res = await query(
        `INSERT INTO users (email, password_hash, full_name, role, phone, avatar_url, latitude, longitude, location_label, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id, role`,
        [u.email, hash, u.full_name, u.role, u.phone, u.avatar_url || null, u.lat || null, u.lng || null, u.location || null]
      );
      insertedUsers.push({ id: res.rows[0].id, role: res.rows[0].role, data: u });
    }

    // 4. Insert Technician Profiles
    for (const u of insertedUsers.filter(user => user.role === 'technician')) {
      const isMahmoud = u.data.full_name === 'Mahmoud Sayed';
      const isOmar = u.data.full_name === 'Omar Ibrahim';
      
      const res = await query(
        `INSERT INTO technician_profiles (user_id, bio, experience_years, hourly_rate, inspection_fee, is_verified, is_available, rating_avg, rating_count, area_latitude, area_longitude, area_radius_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          u.id,
          isMahmoud ? 'Expert plumber with 10 years of experience in Cairo.' : (isOmar ? 'Certified electrician in Alexandria.' : 'HVAC Specialist'),
          isMahmoud ? 10 : (isOmar ? 5 : 2),
          isMahmoud ? 150 : (isOmar ? 200 : 120),
          50,
          true,
          true,
          isMahmoud ? 4.8 : (isOmar ? 4.5 : 0),
          isMahmoud ? 24 : (isOmar ? 12 : 0),
          u.data.lat,
          u.data.lng,
          15
        ]
      );
      const tpId = res.rows[0].id;

      // Add specializations
      if (isMahmoud) await query(`INSERT INTO technician_specializations (technician_id, category_id) VALUES ($1, $2)`, [tpId, categoryIds['plumbing']]);
      if (isOmar) await query(`INSERT INTO technician_specializations (technician_id, category_id) VALUES ($1, $2)`, [tpId, categoryIds['electrical']]);
      if (!isMahmoud && !isOmar) await query(`INSERT INTO technician_specializations (technician_id, category_id) VALUES ($1, $2)`, [tpId, categoryIds['hvac']]);

      // Add Schedule & Slots for Mahmoud and Omar (Completeness)
      if (isMahmoud || isOmar) {
        for (let day = 0; day <= 6; day++) {
          const isActive = day >= 1 && day <= 5; // Monday to Friday
          const wdRes = await query(`INSERT INTO technician_work_days (technician_id, day_of_week, is_active) VALUES ($1, $2, $3) RETURNING id`, [tpId, day, isActive]);
          
          if (isActive) {
            await query(`INSERT INTO time_slots (technician_id, work_day_id, start_time, end_time, max_bookings) VALUES ($1, $2, $3, $4, $5)`, [tpId, wdRes.rows[0].id, '09:00', '13:00', 2]);
            await query(`INSERT INTO time_slots (technician_id, work_day_id, start_time, end_time, max_bookings) VALUES ($1, $2, $3, $4, $5)`, [tpId, wdRes.rows[0].id, '14:00', '18:00', 2]);
          }
        }
        
        // Add Gallery
        await query(`INSERT INTO technician_gallery (technician_id, image_url, caption) VALUES ($1, $2, $3)`, [tpId, 'https://picsum.photos/seed/fixit1/800/600', 'Recent completed work 1']);
        await query(`INSERT INTO technician_gallery (technician_id, image_url, caption) VALUES ($1, $2, $3)`, [tpId, 'https://picsum.photos/seed/fixit2/800/600', 'Recent completed work 2']);
      }
    }

    await query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (err) {
    await query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    pool.end();
  }
}

seed();

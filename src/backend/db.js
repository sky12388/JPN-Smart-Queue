import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../smartqueue.db');

sqlite3.verbose();
export const db = new sqlite3.Database(DB_PATH);

// Helper for promise-based queries
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export async function initDatabase() {
  // Optimize SQLite for concurrent reading and write-ahead log
  await dbRun("PRAGMA journal_mode = WAL;");
  await dbRun("PRAGMA foreign_keys = ON;");

  // 1. Branches Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name_ms TEXT NOT NULL,
      name_en TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_meters INTEGER DEFAULT 150
    );
  `);

  // 2. Categories Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name_ms TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_ms TEXT,
      description_en TEXT,
      avg_duration_mins INTEGER DEFAULT 10
    );
  `);

  // 3. Counters Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      branch_id TEXT NOT NULL,
      officer_name TEXT NOT NULL,
      current_ticket_id INTEGER NULL,
      status TEXT DEFAULT 'ONLINE',
      assigned_categories TEXT DEFAULT '["MYKAD","KELAHIRAN","KAHWIN","KHAS"]'
    );
  `);

  // 4. Tickets Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      ticket_number TEXT NOT NULL,
      citizen_name TEXT NOT NULL,
      ic_number TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_CHECKIN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      checked_in_at DATETIME NULL,
      checkin_method TEXT NULL,
      called_at DATETIME NULL,
      served_at DATETIME NULL,
      completed_at DATETIME NULL,
      counter_id INTEGER NULL,
      counter_number INTEGER NULL,
      estimated_wait_mins INTEGER DEFAULT 15
    );
  `);

  // Seed default data if empty
  const branchCount = await dbGet('SELECT COUNT(*) as count FROM branches');
  if (branchCount.count === 0) {
    await dbRun(`
      INSERT INTO branches (id, name_ms, name_en, address, lat, lng, radius_meters) VALUES
      ('PUTRAJAYA', 'JPN Ibu Pejabat Putrajaya', 'JPN Headquarters Putrajaya', 'No 20, Persiaran Perdana, Presint 2, 62551 Putrajaya', 2.9234, 101.6888, 200),
      ('UTC_SHAH_ALAM', 'JPN UTC Selangor (Shah Alam)', 'JPN UTC Selangor (Shah Alam)', 'Tingkat 2, Plaza Angsana, Seksyen 14, 40000 Shah Alam', 3.0707, 101.5234, 150),
      ('HULU_SELANGOR', 'JPN Daerah Hulu Selangor (Kuala Kubu Bharu)', 'JPN Hulu Selangor District (Kuala Kubu Bharu)', 'D/A Pejabat Daerah, Hulu Selangor, 44000 Kuala Kubu Bharu', 3.5647, 101.6582, 150)
    `);
  } else {
    // Ensure Hulu Selangor exists in already-seeded DBs
    await dbRun(`
      INSERT OR IGNORE INTO branches (id, name_ms, name_en, address, lat, lng, radius_meters) VALUES
      ('HULU_SELANGOR', 'JPN Daerah Hulu Selangor (Kuala Kubu Bharu)', 'JPN Hulu Selangor District (Kuala Kubu Bharu)', 'D/A Pejabat Daerah, Hulu Selangor, 44000 Kuala Kubu Bharu', 3.5647, 101.6582, 150)
    `);
  }

  const catCount = await dbGet('SELECT COUNT(*) as count FROM categories');
  if (catCount.count === 0) {
    await dbRun(`
      INSERT INTO categories (id, code, name_ms, name_en, description_ms, description_en, avg_duration_mins) VALUES
      ('MYKAD', 'A', 'Kad Pengenalan (MyKad / MyKid)', 'Identity Card (MyKad / MyKid)', 'Permohonan baharu, gantian rosak, hilang, kemas kini cip & alamat', 'New application, replacement, lost, chip & address update', 8),
      ('KELAHIRAN', 'B', 'Kelahiran & Kematian', 'Birth & Death Registration', 'Daftar kelahiran bayi, cabutan sijil lahir, daftar kematian', 'Newborn registration, certificate extract, death registration', 12),
      ('KAHWIN', 'C', 'Perkahwinan & Perceraian (Bukan Islam)', 'Marriage & Divorce (Non-Muslim)', 'Daftar perkahwinan sivil, pembetulan rekod, permohonan taraf', 'Civil marriage registration, record correction, status inquiry', 15),
      ('KHAS', 'D', 'Kaunter Khas (Warga Emas / OKU / Ibu Mengandung)', 'Priority Lane (Senior Citizen / OKU / Pregnant)', 'Laluan pantas keutamaan untuk pemohon berkeperluan khas', 'Fast priority queue for special needs applicants', 6)
    `);
  }

  // Ensure all branches have 10 counters (Kaunter 1 - Kaunter 10)
  const defaultOfficers = [
    { num: 1, name: 'Puan Siti Norhaliza', cats: '["MYKAD","KHAS"]' },
    { num: 2, name: 'Encik Ahmad Razali', cats: '["MYKAD"]' },
    { num: 3, name: 'Cik Farah Nadia', cats: '["MYKAD"]' },
    { num: 4, name: 'Encik Hafizuddin', cats: '["MYKAD"]' },
    { num: 5, name: 'Puan Nurul Huda', cats: '["KELAHIRAN"]' },
    { num: 6, name: 'Encik Tan Wei Lun', cats: '["KELAHIRAN","KAHWIN"]' },
    { num: 7, name: 'Puan Kavitha Raj', cats: '["KAHWIN"]' },
    { num: 8, name: 'Encik Rajesh Kumar', cats: '["KAHWIN","KELAHIRAN"]' },
    { num: 9, name: 'Puan Zainab binti Sulaiman', cats: '["KHAS","MYKAD"]' },
    { num: 10, name: 'Encik Muhammad Fikri', cats: '["KHAS","MYKAD","KELAHIRAN"]' }
  ];

  for (const branchId of ['PUTRAJAYA', 'UTC_SHAH_ALAM', 'HULU_SELANGOR']) {
    for (const off of defaultOfficers) {
      const exists = await dbGet(
        'SELECT id FROM counters WHERE branch_id = ? AND number = ?',
        [branchId, off.num]
      );
      if (!exists) {
        await dbRun(
          `INSERT INTO counters (number, branch_id, officer_name, status, assigned_categories) VALUES (?, ?, ?, 'ONLINE', ?)`,
          [off.num, branchId, off.name, off.cats]
        );
      }
    }
  }

  console.log('✓ SQLite Database initialized successfully with default seeds.');
}

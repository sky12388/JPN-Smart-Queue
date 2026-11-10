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
      ('UTC_SHAH_ALAM', 'JPN UTC Selangor (Shah Alam)', 'JPN UTC Selangor (Shah Alam)', 'Tingkat 2, Plaza Angsana, Seksyen 14, 40000 Shah Alam', 3.0707, 101.5234, 150)
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

  const counterCount = await dbGet('SELECT COUNT(*) as count FROM counters');
  if (counterCount.count === 0) {
    await dbRun(`
      INSERT INTO counters (number, branch_id, officer_name, status, assigned_categories) VALUES
      (1, 'PUTRAJAYA', 'Puan Siti Norhaliza', 'ONLINE', '["MYKAD","KHAS"]'),
      (2, 'PUTRAJAYA', 'Encik Ahmad Razali', 'ONLINE', '["MYKAD"]'),
      (3, 'PUTRAJAYA', 'Puan Nurul Huda', 'ONLINE', '["KELAHIRAN"]'),
      (4, 'PUTRAJAYA', 'Encik Tan Wei Lun', 'ONLINE', '["KELAHIRAN","KAHWIN"]'),
      (5, 'PUTRAJAYA', 'Puan Kavitha Raj', 'ONLINE', '["KAHWIN"]'),
      (6, 'PUTRAJAYA', 'Encik Muhammad Fikri', 'ONLINE', '["KHAS","MYKAD"]')
    `);
  }

  console.log('✓ SQLite Database initialized successfully with default seeds.');
}

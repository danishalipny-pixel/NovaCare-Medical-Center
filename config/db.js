/**
 * NovaCare Hospital Management System - Database Configuration & Connection Pool
 * Supports Production MySQL 8.0+ / MariaDB and isolated SQLite engine for testing/local dev.
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const DB_CLIENT = (process.env.DB_CLIENT || (process.env.NODE_ENV === 'test' ? 'sqlite' : 'mysql')).toLowerCase();
const isTest = process.env.NODE_ENV === 'test';

let pool = null;
let sqliteDb = null;
let activeEngine = 'mysql';

/**
 * Initialize MySQL Connection Pool
 */
function createMySqlPool() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'novacare_hospital_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
    queueLimit: 0,
    dateStrings: true,
    decimalNumbers: true
  };

  // Cloud SSL support (AWS RDS, PlanetScale, Railway, Aiven, Render)
  if (process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('ssl=true')) {
    config.ssl = { rejectUnauthorized: false };
  }

  // Support full DATABASE_URL if provided by cloud host
  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      config.host = parsedUrl.hostname;
      config.port = parseInt(parsedUrl.port || '3306', 10);
      config.user = decodeURIComponent(parsedUrl.username);
      config.password = decodeURIComponent(parsedUrl.password);
      config.database = parsedUrl.pathname.replace(/^\//, '');
    } catch (err) {
      console.warn('[DB] Warning: Could not parse DATABASE_URL, using individual parameters.');
    }
  }

  return mysql.createPool(config);
}

/**
 * Initialize SQLite Database (Used in automated tests and local dev fallback)
 */
function createSqliteDb() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = isTest
    ? ':memory:'
    : path.resolve(__dirname, '..', 'novacare_local.db');

  const db = new sqlite3.Database(dbPath);
  return db;
}

/**
 * Execute parameterized query with standardized response format
 * Returns [rows, metadata]
 */
async function query(sql, params = []) {
  if (activeEngine === 'mysql' && pool) {
    try {
      const [rows, fields] = await pool.query(sql, params);
      return [rows, fields];
    } catch (error) {
      // If MySQL connection is refused during local exploration, fallback gracefully to SQLite
      if (error.code === 'ECONNREFUSED' && !process.env.STRICT_MYSQL && process.env.NODE_ENV !== 'production') {
        console.warn(`[DB] MySQL connection refused on ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}. Switching to local fallback SQLite store...`);
        await initDatabase('sqlite');
        return query(sql, params);
      }
      throw error;
    }
  } else if (activeEngine === 'sqlite' && sqliteDb) {
    return new Promise((resolve, reject) => {
      // Normalize common MySQL syntax variations to SQLite compatible syntax
      let cleanSql = sql
        .replace(/CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP')
        .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
        .replace(/ENGINE\s*=\s*InnoDB/gi, '')
        .replace(/DEFAULT\s+CHARSET\s*=\s*utf8mb4/gi, '')
        .replace(/COLLATE\s*=\s*utf8mb4_unicode_ci/gi, '')
        .replace(/TINYINT\(1\)/gi, 'INTEGER')
        .replace(/ENUM\([^)]+\)/gi, 'TEXT');

      const trimmed = cleanSql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('SHOW') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('DESCRIBE')) {
        sqliteDb.all(cleanSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve([rows || [], null]);
        });
      } else {
        sqliteDb.run(cleanSql, params, function (err) {
          if (err) return reject(err);
          const result = {
            insertId: this.lastID,
            affectedRows: this.changes,
            lastID: this.lastID,
            changes: this.changes
          };
          resolve([result, null]);
        });
      }
    });
  } else {
    throw new Error('Database is not initialized.');
  }
}

/**
 * Health check diagnostics (Safe, no credentials exposed)
 */
async function checkHealth() {
  const start = Date.now();
  try {
    if (activeEngine === 'mysql' && pool) {
      await pool.query('SELECT 1 AS alive');
    } else if (sqliteDb) {
      await new Promise((resolve, reject) => {
        sqliteDb.get('SELECT 1 AS alive', (err, row) => (err ? reject(err) : resolve(row)));
      });
    } else {
      return { status: 'down', engine: activeEngine, latencyMs: 0, error: 'Database uninitialized' };
    }

    return {
      status: 'connected',
      engine: activeEngine,
      latencyMs: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'error',
      engine: activeEngine,
      latencyMs: Date.now() - start,
      error: error.message || 'Connection failure'
    };
  }
}

/**
 * Initialize Database and run schema initialization
 */
async function initDatabase(forceEngine) {
  const chosenEngine = forceEngine || (DB_CLIENT === 'sqlite' || isTest ? 'sqlite' : 'mysql');
  activeEngine = chosenEngine;

  if (activeEngine === 'mysql') {
    try {
      pool = createMySqlPool();
      // Quick test ping
      const connection = await pool.getConnection();
      connection.release();
      console.log(`[DB] Connected successfully to MySQL database (${process.env.DB_NAME || 'novacare_hospital_db'})`);
      return { engine: 'mysql', pool };
    } catch (err) {
      if (process.env.NODE_ENV === 'production' || process.env.STRICT_MYSQL) {
        console.error('[DB] Critical: Failed to connect to production MySQL database:', err.message);
        throw err;
      }
      console.warn(`[DB] Warning: MySQL not available (${err.message}). Defaulting to self-contained SQLite storage for development/testing.`);
      activeEngine = 'sqlite';
    }
  }

  // SQLite Initialization
  sqliteDb = createSqliteDb();
  await setupSqliteSchema();
  console.log(`[DB] Storage active: SQLite (${isTest ? 'in-memory test' : 'local file persistent'})`);
  return { engine: 'sqlite', db: sqliteDb };
}

/**
 * Bootstrap SQLite Schema & Seed data if tables don't exist
 */
async function setupSqliteSchema() {
  const createTableStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'RECEPTIONIST',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      doctor_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      department TEXT NOT NULL,
      qualification TEXT NOT NULL,
      consultation_fee NUMERIC NOT NULL DEFAULT 0.00,
      room_no TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      available_days TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday',
      start_time TEXT NOT NULL DEFAULT '09:00:00',
      end_time TEXT NOT NULL DEFAULT '17:00:00',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uhid TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      gender TEXT NOT NULL,
      blood_group TEXT NOT NULL DEFAULT 'Unknown',
      phone TEXT NOT NULL,
      email TEXT NULL,
      address TEXT NULL,
      city TEXT NULL,
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_phone TEXT NOT NULL,
      medical_history TEXT NULL,
      allergies TEXT NULL,
      insurance_provider TEXT NULL,
      insurance_policy_no TEXT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_no TEXT NOT NULL UNIQUE,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      cancellation_reason TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultation_no TEXT NOT NULL UNIQUE,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_id INTEGER NULL,
      consultation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      symptoms TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      vitals_bp TEXT NULL,
      vitals_pulse INTEGER NULL,
      vitals_temp NUMERIC NULL,
      vitals_spo2 INTEGER NULL,
      clinical_notes TEXT NULL,
      follow_up_date TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultation_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      instructions TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS wards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ward_code TEXT NOT NULL UNIQUE,
      ward_name TEXT NOT NULL,
      ward_type TEXT NOT NULL,
      daily_charge NUMERIC NOT NULL DEFAULT 500.00,
      total_beds INTEGER NOT NULL DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ward_id INTEGER NOT NULL,
      bed_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Available',
      current_patient_id INTEGER NULL,
      admission_date DATETIME NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS bed_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bed_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      admitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      discharged_at DATETIME NULL,
      discharge_summary TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      brand_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      category TEXT NOT NULL,
      dosage_form TEXT NOT NULL,
      unit_price NUMERIC NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 50,
      expiry_date TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      patient_id INTEGER NOT NULL,
      total_amount NUMERIC NOT NULL DEFAULT 0.00,
      discount_amount NUMERIC NOT NULL DEFAULT 0.00,
      tax_amount NUMERIC NOT NULL DEFAULT 0.00,
      net_payable NUMERIC NOT NULL DEFAULT 0.00,
      paid_amount NUMERIC NOT NULL DEFAULT 0.00,
      balance_due NUMERIC NOT NULL DEFAULT 0.00,
      payment_status TEXT NOT NULL DEFAULT 'Unpaid',
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL,
      total_price NUMERIC NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT NOT NULL UNIQUE,
      invoice_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      amount NUMERIC NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      transaction_ref TEXT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      recorded_by INTEGER NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      username TEXT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NULL,
      details TEXT NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const statement of createTableStatements) {
    await new Promise((resolve, reject) => {
      sqliteDb.run(statement, (err) => (err ? reject(err) : resolve()));
    });
  }

  // Check if users exist; if not, seed initial dataset
  const [userRows] = await query('SELECT COUNT(*) AS count FROM users');
  const userCount = userRows && userRows[0] ? Number(userRows[0].count ?? userRows[0]['COUNT(*)'] ?? 0) : 0;
  if (userCount === 0) {
    await seedSqliteData();
  }
}

/**
 * Seed SQLite initial dataset
 */
async function seedSqliteData() {
  const bcrypt = require('bcryptjs');
  const adminHash = '$2b$10$mwuV6fATVgrULZFO36WVMeV.aKJfLE8lAwhhP2oBmt2B121Qzzlk.'; // Admin@123
  const doctorHash = '$2b$10$zYG3xOOjMTKRfG2hBqjuHOVVLeJpEk5sa727U8BEIgUaV0Dt0Ij.S'; // Doctor@123
  const staffHash = '$2b$10$8S0L74l77zGifCfwQlqSbOM9gAOquD6pmdtXtmRydw.q5NEss5qDW'; // Staff@123

  // Users
  await query(`INSERT OR IGNORE INTO users (id, username, email, password_hash, full_name, role, status) VALUES
    (1, 'admin', 'admin@novacare.org', '${adminHash}', 'System Administrator', 'ADMIN', 'ACTIVE'),
    (2, 'dr.sarah', 'sarah.jenkins@novacare.org', '${doctorHash}', 'Dr. Sarah Jenkins', 'DOCTOR', 'ACTIVE'),
    (3, 'dr.marcus', 'marcus.vance@novacare.org', '${doctorHash}', 'Dr. Marcus Vance', 'DOCTOR', 'ACTIVE'),
    (4, 'rec.john', 'john.reception@novacare.org', '${staffHash}', 'John Doe (Front Desk)', 'RECEPTIONIST', 'ACTIVE'),
    (5, 'nurse.emily', 'emily.nurse@novacare.org', '${staffHash}', 'Emily Stone (Head Nurse)', 'NURSE', 'ACTIVE'),
    (6, 'pharm.david', 'david.pharma@novacare.org', '${staffHash}', 'David Miller (Lead Pharmacist)', 'PHARMACIST', 'ACTIVE')`);

  // Doctors
  await query(`INSERT OR IGNORE INTO doctors (id, user_id, doctor_code, full_name, specialization, department, qualification, consultation_fee, room_no, phone, email, available_days, start_time, end_time, status) VALUES
    (1, 2, 'DOC-101', 'Dr. Sarah Jenkins', 'Interventional Cardiology', 'Cardiology', 'MD, FACC, FSCAI', 150.00, 'Suite 301', '+1-555-0101', 'sarah.jenkins@novacare.org', 'Monday,Wednesday,Friday', '09:00:00', '16:00:00', 'ACTIVE'),
    (2, 3, 'DOC-102', 'Dr. Marcus Vance', 'Neurology & Stroke Care', 'Neurology', 'MBBS, PhD, FAAN', 160.00, 'Suite 204', '+1-555-0102', 'marcus.vance@novacare.org', 'Tuesday,Thursday,Saturday', '10:00:00', '17:00:00', 'ACTIVE'),
    (3, NULL, 'DOC-103', 'Dr. Elena Rostova', 'Pediatric Medicine', 'Pediatrics', 'MD, FAAP', 120.00, 'Suite 105', '+1-555-0103', 'elena.rostova@novacare.org', 'Monday,Tuesday,Wednesday,Thursday,Friday', '08:30:00', '15:30:00', 'ACTIVE'),
    (4, NULL, 'DOC-104', 'Dr. Tariq Al-Mansoor', 'Orthopedic Surgery', 'Orthopedics', 'FRCS (Orth), MS', 180.00, 'Suite 402', '+1-555-0104', 'tariq.mansoor@novacare.org', 'Monday,Thursday', '09:00:00', '14:00:00', 'ACTIVE'),
    (5, NULL, 'DOC-105', 'Dr. Aisha Patel', 'Internal Medicine', 'General Medicine', 'MBBS, MD', 110.00, 'Suite 102', '+1-555-0105', 'aisha.patel@novacare.org', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', '09:00:00', '18:00:00', 'ACTIVE')`);

  // Patients
  await query(`INSERT OR IGNORE INTO patients (id, uhid, first_name, last_name, date_of_birth, gender, blood_group, phone, email, address, city, emergency_contact_name, emergency_contact_phone, medical_history, allergies, insurance_provider, insurance_policy_no) VALUES
    (1, 'NC-2026-0001', 'Robert', 'Sterling', '1982-04-12', 'Male', 'O+', '+1-555-0201', 'robert.sterling@example.com', '742 Evergreen Terrace', 'Springfield', 'Eleanor Sterling', '+1-555-0202', 'Hypertension (diagnosed 2018), Type 2 Diabetes', 'Penicillin', 'Blue Cross Shield', 'BC-8899214'),
    (2, 'NC-2026-0002', 'Maria', 'Rodriguez', '1990-11-23', 'Female', 'A+', '+1-555-0203', 'maria.rodriguez@example.com', '124 Conch Street', 'Pacific Grove', 'Carlos Rodriguez', '+1-555-0204', 'Mild Asthma', 'Sulfa drugs, NSAIDs', 'Aetna Global Health', 'AET-3349102'),
    (3, 'NC-2026-0003', 'Liam', 'Chen', '2015-06-08', 'Male', 'B-', '+1-555-0205', 'chen.family@example.com', '45 Elm Street', 'Oakland', 'Wei Chen', '+1-555-0206', 'None', 'Peanuts, Shellfish', 'UnitedHealthcare', 'UHC-4401928'),
    (4, 'NC-2026-0004', 'Sophia', 'Dubois', '1975-09-17', 'Female', 'AB+', '+1-555-0207', 'sophia.d@example.com', '88 Riverbend Way', 'Riverside', 'Jacques Dubois', '+1-555-0208', 'Hypothyroidism', 'None known', 'Cigna Healthcare', 'CIG-9021844'),
    (5, 'NC-2026-0005', 'James', 'Kowalski', '1968-01-30', 'Male', 'O-', '+1-555-0209', 'j.kowalski@example.com', '312 Industrial Park Rd', 'Metropolis', 'Anna Kowalski', '+1-555-0210', 'Coronary Artery Disease, Stent placement 2021', 'Aspirin (gastro-sensitive)', 'Medicare Part B', 'MED-1102938')`);

  // Wards & Beds
  await query(`INSERT OR IGNORE INTO wards (id, ward_code, ward_name, ward_type, daily_charge, total_beds) VALUES
    (1, 'WARD-ICU', 'Intensive Care Unit (ICU)', 'ICU', 750.00, 4),
    (2, 'WARD-GMW', 'General Male Medical Ward', 'General Male', 250.00, 6),
    (3, 'WARD-GFW', 'General Female Medical Ward', 'General Female', 250.00, 6),
    (4, 'WARD-PED', 'Pediatric Care Pavilion', 'Pediatric', 300.00, 4),
    (5, 'WARD-PRV', 'Executive Private Suites', 'Private Suite', 600.00, 4)`);

  await query(`INSERT OR IGNORE INTO beds (id, ward_id, bed_number, status, current_patient_id, admission_date) VALUES
    (1, 1, 'ICU-101', 'Occupied', 5, CURRENT_TIMESTAMP),
    (2, 1, 'ICU-102', 'Available', NULL, NULL),
    (3, 1, 'ICU-103', 'Available', NULL, NULL),
    (4, 1, 'ICU-104', 'Maintenance', NULL, NULL),
    (5, 2, 'GMW-201', 'Occupied', 1, CURRENT_TIMESTAMP),
    (6, 2, 'GMW-202', 'Available', NULL, NULL),
    (7, 2, 'GMW-203', 'Available', NULL, NULL),
    (8, 3, 'GFW-301', 'Occupied', 2, CURRENT_TIMESTAMP),
    (9, 3, 'GFW-302', 'Available', NULL, NULL),
    (10, 4, 'PED-401', 'Available', NULL, NULL),
    (11, 5, 'PRV-501', 'Available', NULL, NULL),
    (12, 5, 'PRV-502', 'Available', NULL, NULL)`);

  // Appointments
  const today = new Date().toISOString().split('T')[0];
  await query(`INSERT OR IGNORE INTO appointments (id, appointment_no, patient_id, doctor_id, appointment_date, start_time, end_time, reason, status) VALUES
    (1, 'APT-2026-0001', 1, 1, '${today}', '09:30:00', '10:00:00', 'Routine cardiac stress check and blood pressure management review.', 'Scheduled'),
    (2, 'APT-2026-0002', 2, 2, '${today}', '10:30:00', '11:00:00', 'Recurring migraine episodes and aura follow-up.', 'Scheduled'),
    (3, 'APT-2026-0003', 3, 3, '${today}', '11:00:00', '11:30:00', 'Pediatric seasonal allergies and respiratory wellness exam.', 'Scheduled'),
    (4, 'APT-2026-0004', 4, 5, '${today}', '14:00:00', '14:30:00', 'Annual wellness checkup and thyroid hormone titration.', 'Scheduled'),
    (5, 'APT-2026-0005', 5, 4, '${today}', '15:00:00', '15:30:00', 'Post-surgical left knee joint mobility assessment.', 'Scheduled')`);

  // Medicines
  await query(`INSERT OR IGNORE INTO medicines (id, code, brand_name, generic_name, category, dosage_form, unit_price, stock_quantity, reorder_level, expiry_date, manufacturer, status) VALUES
    (1, 'MED-1001', 'Lipitor 20mg', 'Atorvastatin Calcium', 'Cardiovascular', 'Tablet', 1.85, 420, 50, '2027-12-31', 'Pfizer Inc.', 'Available'),
    (2, 'MED-1002', 'Glucophage 500mg', 'Metformin HCl', 'Antidiabetic', 'Tablet', 0.95, 380, 50, '2028-04-30', 'Merck KGaA', 'Available'),
    (3, 'MED-1003', 'Augmentin 625mg', 'Amoxicillin + Clavulanate', 'Antibiotic', 'Tablet', 3.40, 24, 40, '2027-02-28', 'GSK Pharma', 'Low Stock'),
    (4, 'MED-1004', 'Ventolin HFA', 'Albuterol Sulfate Inhaler', 'Respiratory', 'Inhaler', 28.50, 65, 20, '2027-08-15', 'GlaxoSmithKline', 'Available'),
    (5, 'MED-1005', 'Nexium 40mg', 'Esomeprazole Magnesium', 'Gastrointestinal', 'Delayed-Release Capsule', 2.10, 190, 30, '2027-10-31', 'AstraZeneca', 'Available'),
    (6, 'MED-1006', 'Norvasc 5mg', 'Amlodipine Besylate', 'Cardiovascular', 'Tablet', 1.20, 310, 50, '2028-06-30', 'Pfizer Inc.', 'Available'),
    (7, 'MED-1007', 'Rocephin 1g', 'Ceftriaxone Sodium IV', 'Injectable Antibiotic', 'Vial', 14.50, 12, 25, '2027-01-15', 'Roche Diagnostics', 'Low Stock'),
    (8, 'MED-1008', 'Panadol Extra 500mg', 'Paracetamol + Caffeine', 'Analgesic', 'Tablet', 0.40, 650, 100, '2028-11-30', 'Haleon Healthcare', 'Available')`);

  // Invoices & Items
  await query(`INSERT OR IGNORE INTO invoices (id, invoice_no, patient_id, total_amount, discount_amount, tax_amount, net_payable, paid_amount, balance_due, payment_status, invoice_date, due_date, notes) VALUES
    (1, 'INV-2026-0001', 1, 150.00, 0.00, 7.50, 157.50, 157.50, 0.00, 'Paid', '${today}', '${today}', 'Consultation fee with Dr. Sarah Jenkins'),
    (2, 'INV-2026-0002', 2, 320.00, 20.00, 15.00, 315.00, 150.00, 165.00, 'Partial', '${today}', '${today}', 'Neurology consultation + EEG diagnostic procedure'),
    (3, 'INV-2026-0003', 5, 850.00, 50.00, 40.00, 840.00, 0.00, 840.00, 'Unpaid', '${today}', '${today}', 'ICU Day 1 accommodation + emergency IV medication')`);

  await query(`INSERT OR IGNORE INTO invoice_items (id, invoice_id, item_type, item_name, quantity, unit_price, total_price) VALUES
    (1, 1, 'Consultation', 'Cardiology Specialist Consultation', 1, 150.00, 150.00),
    (2, 2, 'Consultation', 'Neurology Specialist Consultation', 1, 160.00, 160.00),
    (3, 2, 'Procedure', 'Digital Electroencephalogram (EEG)', 1, 160.00, 160.00),
    (4, 3, 'Room_Charge', 'ICU Daily Room Charge', 1, 750.00, 750.00),
    (5, 3, 'Medicine', 'Emergency IV Stabilization Pack', 1, 100.00, 100.00)`);

  await query(`INSERT OR IGNORE INTO payments (id, payment_no, invoice_id, patient_id, amount, payment_method, transaction_ref, recorded_by, notes) VALUES
    (1, 'PAY-2026-0001', 1, 1, 157.50, 'Credit_Card', 'TXN-CC-994821', 4, 'Settled at front desk via Visa ending in 4092'),
    (2, 'PAY-2026-0002', 2, 2, 150.00, 'Insurance', 'COPAY-AETNA-7721', 4, 'Patient insurance co-pay received')`);
}

/**
 * Close database pool or connection cleanly
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (sqliteDb) {
    await new Promise((resolve) => sqliteDb.close(resolve));
    sqliteDb = null;
  }
}

module.exports = {
  query,
  checkHealth,
  initDatabase,
  close,
  getEngine: () => activeEngine
};

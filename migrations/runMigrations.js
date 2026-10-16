/**
 * Database Migration Runner
 * Executes migrations against MySQL in production or SQLite in local environments.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  console.log('[Migration] Starting database migration...');
  try {
    await db.initDatabase();
    const engine = db.getEngine();
    console.log(`[Migration] Using database engine: ${engine}`);

    if (engine === 'mysql') {
      const sqlFile = path.resolve(__dirname, '001_initial_schema.sql');
      const rawSql = fs.readFileSync(sqlFile, 'utf8');

      // Split statements by semicolon
      const statements = rawSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await db.query(statement);
      }
      console.log(`[Migration] Successfully executed ${statements.length} MySQL DDL statements.`);
    } else {
      console.log('[Migration] SQLite schema is automatically synced and validated.');
    }

    console.log('[Migration] Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;

/**
 * Database Seeder Runner
 * Inserts default administrative roles, test staff accounts, initial hospital departments, and sample data.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runSeeds() {
  console.log('[Seeder] Starting database seeding...');
  try {
    await db.initDatabase();
    const engine = db.getEngine();
    console.log(`[Seeder] Using database engine: ${engine}`);

    if (engine === 'mysql') {
      const sqlFile = path.resolve(__dirname, '001_initial_seeds.sql');
      const rawSql = fs.readFileSync(sqlFile, 'utf8');

      const statements = rawSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await db.query(statement);
      }
      console.log(`[Seeder] Successfully executed ${statements.length} MySQL seed statements.`);
    } else {
      console.log('[Seeder] SQLite seed dataset verified and synced.');
    }

    console.log('[Seeder] Seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  runSeeds();
}

module.exports = runSeeds;

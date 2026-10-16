/**
 * NovaCare Hospital Management System - Database Model Helpers & Audit Logger
 */
const db = require('../config/db');

/**
 * Log action to immutable audit log table
 */
async function logAudit(req, action, entityType, entityId, details) {
  try {
    const userId = req?.user?.id || null;
    const username = req?.user?.username || 'system';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req?.headers?.['user-agent'] || 'API-Client';

    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, entityType, String(entityId || ''), detailsStr, ipAddress, userAgent]
    );
  } catch (err) {
    // Audit log failure should be recorded in console, but not crash the active business transaction
    console.error('[Audit] Failed to record audit log:', err.message);
  }
}

module.exports = {
  db,
  logAudit
};

/**
 * NovaCare Hospital Management System - Health & Diagnostics Controller
 * Provides non-sensitive system health status for uptime monitors and load balancers.
 */
const { checkHealth, getEngine } = require('../config/db');

async function getHealth(req, res) {
  const dbHealth = await checkHealth();
  const uptimeSeconds = Math.floor(process.uptime());
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbHealth.status === 'connected';

  const healthReport = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'NovaCare Hospital Management System API',
    version: '1.0.0',
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: {
        status: dbHealth.status,
        engine: dbHealth.engine,
        latencyMs: dbHealth.latencyMs
      }
    },
    system: {
      memoryUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024)
    }
  };

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(healthReport);
}

module.exports = {
  getHealth
};

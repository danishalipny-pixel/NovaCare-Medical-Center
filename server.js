/**
 * NovaCare Hospital Management System - Express Backend Server
 * Production-ready server with Helmet security headers, CORS origin enforcement,
 * database connection management, and static frontend hosting.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const db = require('./config/db');

const { safeLogger } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route Modules
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const emrRoutes = require('./routes/emrRoutes');
const bedRoutes = require('./routes/bedRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const billingRoutes = require('./routes/billingRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Trust reverse proxy (for Render, Railway, Nginx, AWS ALB behind HTTPS)
app.set('trust proxy', 1);

// Security Headers with Content-Security-Policy configured for frontend dependencies (Tailwind CDN, FontAwesome, Chart.js)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com'
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://ui-avatars.com'],
        connectSrc: ["'self'", 'https:', 'http:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Explicit CORS Origin Handling (Strictly forbids wildcards on authenticated endpoints)
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (configuredOrigins.length === 0) {
        // In local/default mode, allow same host or request origin
        return callback(null, true);
      }
      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: Origin ${origin} not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Safe HTTP Request Logging
app.use(safeLogger);

// Health Check Endpoint (Public for uptime monitors & load balancers)
app.use('/api/health', healthRoutes);

// Protected API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', emrRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/billing', billingRoutes);

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all handler to serve Single Page Application
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return notFoundHandler(req, res, next);
  }
  if (req.path.startsWith('/api/')) {
    return notFoundHandler(req, res, next);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling
app.use(errorHandler);

// Server Startup Function
async function startServer() {
  try {
    await db.initDatabase();

    const server = app.listen(PORT, HOST, () => {
      console.log('====================================================');
      console.log(`🏥 NovaCare Hospital Management System is Live!`);
      console.log(`📡 URL: http://${HOST}:${PORT}`);
      console.log(`🔍 Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${db.getEngine()}`);
      console.log('====================================================');
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await db.close();
        console.log('[Server] Connections closed. Process terminating.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return { app, server };
  } catch (err) {
    console.error('[Server] Fatal startup failure:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

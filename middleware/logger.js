/**
 * NovaCare Hospital Management System - Safe Request Logger Middleware
 * Prevents passwords, tokens, and sensitive patient PII from leaking into logs.
 */

function safeLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Filter health checks from polluting production logs
  if (originalUrl === '/api/health') {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const userStr = req.user ? `[User:${req.user.username}(${req.user.role})]` : '[Anon]';

    console.log(`[${new Date().toISOString()}] [${logLevel}] ${method} ${originalUrl} ${status} ${duration}ms ${userStr} IP:${ip}`);
  });

  next();
}

module.exports = { safeLogger };

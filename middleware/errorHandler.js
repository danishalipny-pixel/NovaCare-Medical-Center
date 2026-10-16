/**
 * NovaCare Hospital Management System - Centralized Error Handler Middleware
 */

function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 ? res.statusCode : 500);

  // Safe logging on server side
  console.error(`[Error] [${req.method} ${req.originalUrl}] Status: ${statusCode}`, err.stack || err.message);

  // Sanitized client response
  const response = {
    success: false,
    message: err.isOperational || statusCode < 500 ? err.message : 'An internal server error occurred. Please try again.',
    timestamp: new Date().toISOString()
  };

  if (err.errors) {
    response.errors = err.errors;
  }

  // Only include debug stack trace in non-production environments when explicitly requested
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler
};

/**
 * NovaCare Hospital Management System - Authentication & RBAC Middleware
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'novacare_default_jwt_secret_change_in_production_32char';

/**
 * Verify JWT Bearer token
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. No access token provided.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      message: isExpired ? 'Access token has expired. Please log in again.' : 'Invalid access token.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Require specific roles (RBAC)
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking permissions.',
        timestamp: new Date().toISOString()
      });
    }

    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    const upperAllowed = allowedRoles.map((r) => r.toUpperCase());

    if (!upperAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] permissions. Current role: ${req.user.role}`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRoles,
  JWT_SECRET
};

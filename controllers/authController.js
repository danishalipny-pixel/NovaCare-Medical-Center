/**
 * NovaCare Hospital Management System - Authentication Controller
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAudit } = require('../models/database');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * User Login
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.',
        timestamp: new Date().toISOString()
      });
    }

    // Lookup user by username or email
    const [rows] = await db.query(
      `SELECT id, username, email, password_hash, full_name, role, status
       FROM users
       WHERE (username = ? OR email = ?) AND status = 'ACTIVE' LIMIT 1`,
      [username.trim(), username.trim().toLowerCase()]
    );

    const user = rows && rows.length > 0 ? rows[0] : null;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
        timestamp: new Date().toISOString()
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
        timestamp: new Date().toISOString()
      });
    }

    // Sign JWT (24 hour expiration)
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    // Record audit event
    await logAudit(
      { user: payload, ip: req.ip, headers: req.headers },
      'AUTH_LOGIN',
      'users',
      user.id,
      { username: user.username, role: user.role }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Current User Profile
 * GET /api/auth/me
 */
async function getCurrentUser(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, full_name, role, status, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: { user: rows[0] },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Logout
 * POST /api/auth/logout
 */
async function logout(req, res) {
  await logAudit(req, 'AUTH_LOGOUT', 'users', req.user?.id, { username: req.user?.username });

  res.json({
    success: true,
    message: 'Logged out successfully.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Register New Staff User (ADMIN only)
 * POST /api/auth/register
 */
async function registerUser(req, res, next) {
  try {
    const { username, email, password, full_name, role } = req.body;

    const allowedRoles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Must be one of [${allowedRoles.join(', ')}]`,
        timestamp: new Date().toISOString()
      });
    }

    // Check duplicate
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username.trim(), email.trim().toLowerCase()]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this username or email already exists.',
        timestamp: new Date().toISOString()
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, full_name.trim(), role]
    );

    const newId = result.insertId || result.lastID;

    await logAudit(req, 'USER_REGISTERED', 'users', newId, { username, role });

    res.status(201).json({
      success: true,
      message: 'Staff user created successfully.',
      data: {
        id: newId,
        username,
        email,
        full_name,
        role
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getCurrentUser,
  logout,
  registerUser
};

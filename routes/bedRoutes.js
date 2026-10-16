/**
 * NovaCare Hospital Management System - Wards & Bed Routes
 */
const express = require('express');
const router = express.Router();
const bedController = require('../controllers/bedController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get('/', bedController.getWardsAndBeds);

router.post(
  '/admit',
  requireRoles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  validateBody(['bed_id', 'patient_id']),
  bedController.admitPatient
);

router.post(
  '/discharge',
  requireRoles('ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  validateBody(['bed_id']),
  bedController.dischargePatient
);

module.exports = router;

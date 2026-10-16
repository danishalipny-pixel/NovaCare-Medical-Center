/**
 * NovaCare Hospital Management System - Electronic Medical Records (EMR) Routes
 */
const express = require('express');
const router = express.Router();
const emrController = require('../controllers/emrController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get(
  '/',
  requireRoles('ADMIN', 'DOCTOR', 'NURSE'),
  emrController.getConsultations
);

router.post(
  '/',
  requireRoles('ADMIN', 'DOCTOR'),
  validateBody(['patient_id', 'doctor_id', 'symptoms', 'diagnosis']),
  emrController.createConsultation
);

module.exports = router;

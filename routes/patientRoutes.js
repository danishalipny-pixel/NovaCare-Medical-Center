/**
 * NovaCare Hospital Management System - Patient Routes
 */
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// All patient endpoints require authentication
router.use(verifyToken);

router.get(
  '/',
  requireRoles('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'),
  patientController.getPatients
);

router.get(
  '/:id',
  requireRoles('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE'),
  patientController.getPatientById
);

router.post(
  '/',
  requireRoles('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  validateBody(
    ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'emergency_contact_name', 'emergency_contact_phone'],
    {
      phone: (val) => (val && val.length < 7 ? 'Phone number must be at least 7 characters' : null),
      emergency_contact_phone: (val) => (val && val.length < 7 ? 'Emergency phone must be at least 7 characters' : null)
    }
  ),
  patientController.createPatient
);

router.put(
  '/:id',
  requireRoles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  patientController.updatePatient
);

router.delete(
  '/:id',
  requireRoles('ADMIN', 'RECEPTIONIST'),
  patientController.deletePatient
);

module.exports = router;

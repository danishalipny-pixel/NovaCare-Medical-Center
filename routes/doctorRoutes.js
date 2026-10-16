/**
 * NovaCare Hospital Management System - Doctor Routes
 */
const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get('/', doctorController.getDoctors);
router.get('/:id', doctorController.getDoctorById);

router.post(
  '/',
  requireRoles('ADMIN'),
  validateBody(['full_name', 'specialization', 'department', 'qualification', 'room_no', 'phone', 'email']),
  doctorController.createDoctor
);

module.exports = router;

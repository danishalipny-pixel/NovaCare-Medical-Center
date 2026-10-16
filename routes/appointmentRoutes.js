/**
 * NovaCare Hospital Management System - Appointment Routes
 */
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get('/', appointmentController.getAppointments);

router.post(
  '/',
  requireRoles('ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  validateBody(
    ['patient_id', 'doctor_id', 'appointment_date', 'start_time', 'end_time', 'reason'],
    {
      appointment_date: (val) => (!/^\d{4}-\d{2}-\d{2}$/.test(val) ? 'Date must follow YYYY-MM-DD format.' : null),
      start_time: (val) => (!/^\d{2}:\d{2}(:\d{2})?$/.test(val) ? 'Start time must follow HH:MM format.' : null),
      end_time: (val) => (!/^\d{2}:\d{2}(:\d{2})?$/.test(val) ? 'End time must follow HH:MM format.' : null)
    }
  ),
  appointmentController.createAppointment
);

router.patch(
  '/:id/status',
  requireRoles('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  validateBody(['status']),
  appointmentController.updateAppointmentStatus
);

module.exports = router;

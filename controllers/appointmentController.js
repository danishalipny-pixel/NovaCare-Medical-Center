/**
 * NovaCare Hospital Management System - Appointment Scheduling Controller
 * Strict conflict detection prevents double-booking doctors.
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Appointments with Filters
 * GET /api/appointments
 */
async function getAppointments(req, res, next) {
  try {
    const { date, doctor_id, patient_id, status } = req.query;
    let conditions = ['1=1'];
    let params = [];

    if (date) {
      conditions.push('a.appointment_date = ?');
      params.push(date);
    }

    if (doctor_id && doctor_id !== 'ALL') {
      conditions.push('a.doctor_id = ?');
      params.push(doctor_id);
    }

    if (patient_id) {
      conditions.push('a.patient_id = ?');
      params.push(patient_id);
    }

    if (status && status !== 'ALL') {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [appointments] = await db.query(
      `SELECT a.*,
              p.first_name, p.last_name, p.uhid, p.phone AS patient_phone,
              d.full_name AS doctor_name, d.department, d.room_no, d.consultation_fee
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE ${whereClause}
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      params
    );

    res.json({
      success: true,
      data: appointments || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create New Appointment with Conflict Detection
 * POST /api/appointments
 */
async function createAppointment(req, res, next) {
  try {
    const { patient_id, doctor_id, appointment_date, start_time, end_time, reason } = req.body;

    // Verify patient exists
    const [patientRows] = await db.query(
      'SELECT id, first_name, last_name, uhid FROM patients WHERE id = ? AND is_deleted = 0',
      [patient_id]
    );
    if (!patientRows || patientRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found.',
        timestamp: new Date().toISOString()
      });
    }

    // Verify doctor exists
    const [doctorRows] = await db.query(
      'SELECT id, full_name, consultation_fee FROM doctors WHERE id = ? AND is_deleted = 0 AND status = "ACTIVE"',
      [doctor_id]
    );
    if (!doctorRows || doctorRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or currently inactive.',
        timestamp: new Date().toISOString()
      });
    }

    // Mandatory Conflict Detection Check
    // An overlapping slot occurs when: (existing_start < new_end) AND (existing_end > new_start)
    const [conflicts] = await db.query(
      `SELECT id, appointment_no, start_time, end_time
       FROM appointments
       WHERE doctor_id = ?
         AND appointment_date = ?
         AND status != 'Cancelled'
         AND (start_time < ? AND end_time > ?)
       LIMIT 1`,
      [doctor_id, appointment_date, end_time, start_time]
    );

    if (conflicts && conflicts.length > 0) {
      const conflict = conflicts[0];
      return res.status(409).json({
        success: false,
        message: `Scheduling conflict: Dr. ${doctorRows[0].full_name} already has appointment (${conflict.appointment_no}) scheduled between ${conflict.start_time} and ${conflict.end_time}.`,
        conflictDetails: {
          existingAppointmentNo: conflict.appointment_no,
          slot: `${conflict.start_time} - ${conflict.end_time}`
        },
        timestamp: new Date().toISOString()
      });
    }

    const apptNo = `APT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [result] = await db.query(
      `INSERT INTO appointments (
        appointment_no, patient_id, doctor_id, appointment_date,
        start_time, end_time, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`,
      [apptNo, patient_id, doctor_id, appointment_date, start_time, end_time, reason.trim()]
    );

    const newId = result.insertId || result.lastID;

    await logAudit(req, 'APPOINTMENT_BOOKED', 'appointments', newId, {
      appointment_no: apptNo,
      doctor: doctorRows[0].full_name,
      patient_id,
      date: appointment_date,
      time: `${start_time} - ${end_time}`
    });

    res.status(201).json({
      success: true,
      message: 'Appointment successfully scheduled.',
      data: {
        id: newId,
        appointment_no: apptNo,
        patient: `${patientRows[0].first_name} ${patientRows[0].last_name}`,
        doctor: doctorRows[0].full_name,
        appointment_date,
        start_time,
        end_time,
        status: 'Scheduled'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Appointment Status (Check-in, Complete, Cancel)
 * PATCH /api/appointments/:id/status
 */
async function updateAppointmentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, cancellation_reason } = req.body;

    const validStatuses = ['Scheduled', 'Completed', 'Cancelled', 'No-Show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of [${validStatuses.join(', ')}]`,
        timestamp: new Date().toISOString()
      });
    }

    const [existing] = await db.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        timestamp: new Date().toISOString()
      });
    }

    await db.query(
      `UPDATE appointments
       SET status = ?, cancellation_reason = COALESCE(?, cancellation_reason)
       WHERE id = ?`,
      [status, cancellation_reason || null, id]
    );

    await logAudit(req, 'APPOINTMENT_STATUS_CHANGED', 'appointments', id, {
      from: existing[0].status,
      to: status,
      cancellation_reason
    });

    res.json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointmentStatus
};

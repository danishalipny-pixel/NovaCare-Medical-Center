/**
 * NovaCare Hospital Management System - Doctor Management Controller
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Doctors
 * GET /api/doctors
 */
async function getDoctors(req, res, next) {
  try {
    const { department, status } = req.query;
    let conditions = ['is_deleted = 0'];
    let params = [];

    if (department && department !== 'ALL') {
      conditions.push('department = ?');
      params.push(department);
    }

    if (status && status !== 'ALL') {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [doctors] = await db.query(
      `SELECT id, doctor_code, full_name, specialization, department,
              qualification, consultation_fee, room_no, phone, email,
              available_days, start_time, end_time, status
       FROM doctors
       WHERE ${whereClause}
       ORDER BY department ASC, full_name ASC`,
      params
    );

    res.json({
      success: true,
      data: doctors || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Doctor by ID with Schedule
 * GET /api/doctors/:id
 */
async function getDoctorById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM doctors WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found.',
        timestamp: new Date().toISOString()
      });
    }

    // Upcoming appointments for this doctor
    const [appointments] = await db.query(
      `SELECT a.*, p.first_name, p.last_name, p.uhid, p.phone
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.doctor_id = ? AND a.appointment_date >= CURRENT_DATE
       ORDER BY a.appointment_date ASC, a.start_time ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        doctor: rows[0],
        upcomingAppointments: appointments || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create Doctor Profile
 * POST /api/doctors
 */
async function createDoctor(req, res, next) {
  try {
    const {
      full_name,
      specialization,
      department,
      qualification,
      consultation_fee = 100.0,
      room_no,
      phone,
      email,
      available_days = 'Monday,Tuesday,Wednesday,Thursday,Friday',
      start_time = '09:00:00',
      end_time = '17:00:00'
    } = req.body;

    const randomCode = Math.floor(100 + Math.random() * 900);
    const doctor_code = `DOC-${randomCode}`;

    const [result] = await db.query(
      `INSERT INTO doctors (
        doctor_code, full_name, specialization, department, qualification,
        consultation_fee, room_no, phone, email, available_days, start_time, end_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        doctor_code,
        full_name.trim(),
        specialization.trim(),
        department.trim(),
        qualification.trim(),
        parseFloat(consultation_fee),
        room_no.trim(),
        phone.trim(),
        email.trim(),
        available_days,
        start_time,
        end_time
      ]
    );

    const newId = result.insertId || result.lastID;

    await logAudit(req, 'DOCTOR_ADDED', 'doctors', newId, { doctor_code, full_name });

    res.status(201).json({
      success: true,
      message: 'Doctor profile created successfully.',
      data: { id: newId, doctor_code, full_name, department },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor
};

/**
 * NovaCare Hospital Management System - Electronic Medical Records (EMR) Controller
 * Manages clinical consultations, vitals recording, and prescription issuance.
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Consultations
 * GET /api/consultations
 */
async function getConsultations(req, res, next) {
  try {
    const { patient_id, doctor_id } = req.query;
    let conditions = ['1=1'];
    let params = [];

    if (patient_id) {
      conditions.push('c.patient_id = ?');
      params.push(patient_id);
    }
    if (doctor_id) {
      conditions.push('c.doctor_id = ?');
      params.push(doctor_id);
    }

    const [rows] = await db.query(
      `SELECT c.*,
              p.first_name, p.last_name, p.uhid,
              d.full_name AS doctor_name, d.department
       FROM consultations c
       JOIN patients p ON c.patient_id = p.id
       JOIN doctors d ON c.doctor_id = d.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.consultation_date DESC`,
      params
    );

    res.json({
      success: true,
      data: rows || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Record New Clinical Consultation & Prescriptions
 * POST /api/consultations
 */
async function createConsultation(req, res, next) {
  try {
    const {
      patient_id,
      doctor_id,
      appointment_id = null,
      symptoms,
      diagnosis,
      vitals_bp,
      vitals_pulse,
      vitals_temp,
      vitals_spo2,
      clinical_notes,
      follow_up_date,
      prescriptions = []
    } = req.body;

    const consNo = `CONS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [result] = await db.query(
      `INSERT INTO consultations (
        consultation_no, patient_id, doctor_id, appointment_id,
        symptoms, diagnosis, vitals_bp, vitals_pulse, vitals_temp, vitals_spo2,
        clinical_notes, follow_up_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consNo,
        patient_id,
        doctor_id,
        appointment_id,
        symptoms.trim(),
        diagnosis.trim(),
        vitals_bp || null,
        vitals_pulse ? parseInt(vitals_pulse, 10) : null,
        vitals_temp ? parseFloat(vitals_temp) : null,
        vitals_spo2 ? parseInt(vitals_spo2, 10) : null,
        clinical_notes || null,
        follow_up_date || null
      ]
    );

    const consultationId = result.insertId || result.lastID;

    // Insert prescription items if provided
    if (Array.isArray(prescriptions) && prescriptions.length > 0) {
      for (const rx of prescriptions) {
        if (rx.medicine_name && rx.dosage) {
          await db.query(
            `INSERT INTO prescriptions (
              consultation_id, patient_id, doctor_id, medicine_name, dosage,
              frequency, duration_days, instructions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              consultationId,
              patient_id,
              doctor_id,
              rx.medicine_name.trim(),
              rx.dosage.trim(),
              rx.frequency || 'Once daily',
              parseInt(rx.duration_days || 5, 10),
              rx.instructions || 'Take after meals'
            ]
          );
        }
      }
    }

    // If an appointment was linked, mark it completed
    if (appointment_id) {
      await db.query('UPDATE appointments SET status = "Completed" WHERE id = ?', [appointment_id]);
    }

    await logAudit(req, 'CONSULTATION_RECORDED', 'consultations', consultationId, {
      consultation_no: consNo,
      patient_id,
      doctor_id,
      diagnosis
    });

    res.status(201).json({
      success: true,
      message: 'Consultation & clinical diagnosis recorded successfully.',
      data: {
        id: consultationId,
        consultation_no: consNo,
        patient_id,
        diagnosis
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConsultations,
  createConsultation
};

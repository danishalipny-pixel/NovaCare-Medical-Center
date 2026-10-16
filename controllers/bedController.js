/**
 * NovaCare Hospital Management System - Wards & Bed Management Controller
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * Get Wards & Bed Occupancy
 * GET /api/beds
 */
async function getWardsAndBeds(req, res, next) {
  try {
    const [wards] = await db.query('SELECT * FROM wards ORDER BY id ASC');

    const [beds] = await db.query(
      `SELECT b.*, w.ward_name, w.ward_type, w.daily_charge,
              p.first_name, p.last_name, p.uhid, p.phone
       FROM beds b
       JOIN wards w ON b.ward_id = w.id
       LEFT JOIN patients p ON b.current_patient_id = p.id
       ORDER BY b.ward_id ASC, b.bed_number ASC`
    );

    res.json({
      success: true,
      data: {
        wards: wards || [],
        beds: beds || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admit Patient to Bed
 * POST /api/beds/admit
 */
async function admitPatient(req, res, next) {
  try {
    const { bed_id, patient_id } = req.body;

    // Check bed availability
    const [bedRows] = await db.query('SELECT * FROM beds WHERE id = ?', [bed_id]);
    if (!bedRows || bedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found.',
        timestamp: new Date().toISOString()
      });
    }

    if (bedRows[0].status !== 'Available') {
      return res.status(409).json({
        success: false,
        message: `Bed ${bedRows[0].bed_number} is currently ${bedRows[0].status.toLowerCase()} and cannot be assigned.`,
        timestamp: new Date().toISOString()
      });
    }

    // Check patient
    const [patientRows] = await db.query('SELECT id, first_name, last_name, uhid FROM patients WHERE id = ? AND is_deleted = 0', [patient_id]);
    if (!patientRows || patientRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
        timestamp: new Date().toISOString()
      });
    }

    // Allocate bed
    await db.query(
      `UPDATE beds SET status = 'Occupied', current_patient_id = ?, admission_date = CURRENT_TIMESTAMP WHERE id = ?`,
      [patient_id, bed_id]
    );

    await db.query(
      `INSERT INTO bed_allocations (bed_id, patient_id, admitted_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'Active')`,
      [bed_id, patient_id]
    );

    await logAudit(req, 'PATIENT_ADMITTED', 'beds', bed_id, {
      bed: bedRows[0].bed_number,
      patient_id,
      patient_name: `${patientRows[0].first_name} ${patientRows[0].last_name}`
    });

    res.json({
      success: true,
      message: `Patient ${patientRows[0].first_name} ${patientRows[0].last_name} admitted to bed ${bedRows[0].bed_number}.`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Discharge Patient from Bed
 * POST /api/beds/discharge
 */
async function dischargePatient(req, res, next) {
  try {
    const { bed_id, discharge_summary = 'Standard clinical recovery discharge' } = req.body;

    const [bedRows] = await db.query('SELECT * FROM beds WHERE id = ?', [bed_id]);
    if (!bedRows || bedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found.',
        timestamp: new Date().toISOString()
      });
    }

    const patientId = bedRows[0].current_patient_id;
    if (!patientId || bedRows[0].status !== 'Occupied') {
      return res.status(400).json({
        success: false,
        message: `Bed ${bedRows[0].bed_number} is not currently occupied.`,
        timestamp: new Date().toISOString()
      });
    }

    // Free bed
    await db.query(
      `UPDATE beds SET status = 'Available', current_patient_id = NULL, admission_date = NULL WHERE id = ?`,
      [bed_id]
    );

    // Update allocation record
    await db.query(
      `UPDATE bed_allocations
       SET status = 'Discharged', discharged_at = CURRENT_TIMESTAMP, discharge_summary = ?
       WHERE bed_id = ? AND status = 'Active'`,
      [discharge_summary, bed_id]
    );

    await logAudit(req, 'PATIENT_DISCHARGED', 'beds', bed_id, {
      bed: bedRows[0].bed_number,
      patient_id: patientId,
      discharge_summary
    });

    res.json({
      success: true,
      message: `Patient successfully discharged. Bed ${bedRows[0].bed_number} is now available.`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWardsAndBeds,
  admitPatient,
  dischargePatient
};

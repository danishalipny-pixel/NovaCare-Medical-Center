/**
 * NovaCare Hospital Management System - Patient Management Controller
 * Strict soft-deletion to preserve medical audit trails and clinical history.
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Patients with Search, Filtering & Pagination
 * GET /api/patients
 */
async function getPatients(req, res, next) {
  try {
    const { search, gender, blood_group, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let conditions = ['is_deleted = 0'];
    let params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push('(uhid LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)');
      params.push(term, term, term, term);
    }

    if (gender && gender !== 'ALL') {
      conditions.push('gender = ?');
      params.push(gender);
    }

    if (blood_group && blood_group !== 'ALL') {
      conditions.push('blood_group = ?');
      params.push(blood_group);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM patients WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Data rows
    const [patients] = await db.query(
      `SELECT id, uhid, first_name, last_name, date_of_birth, gender, blood_group,
              phone, email, city, emergency_contact_name, emergency_contact_phone,
              allergies, insurance_provider, created_at
       FROM patients
       WHERE ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      success: true,
      data: {
        patients: patients || [],
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10))
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Patient by ID (including clinical records, appointments, invoices)
 * GET /api/patients/:id
 */
async function getPatientById(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT * FROM patients WHERE id = ? AND is_deleted = 0 LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or archived.',
        timestamp: new Date().toISOString()
      });
    }

    const patient = rows[0];

    // Fetch related records for comprehensive medical profile
    const [appointments] = await db.query(
      `SELECT a.*, d.full_name AS doctor_name, d.department
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [id]
    );

    const [consultations] = await db.query(
      `SELECT c.*, d.full_name AS doctor_name
       FROM consultations c
       JOIN doctors d ON c.doctor_id = d.id
       WHERE c.patient_id = ?
       ORDER BY c.consultation_date DESC`,
      [id]
    );

    const [invoices] = await db.query(
      `SELECT * FROM invoices WHERE patient_id = ? ORDER BY id DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        patient,
        appointments: appointments || [],
        consultations: consultations || [],
        invoices: invoices || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Register New Patient
 * POST /api/patients
 */
async function createPatient(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      date_of_birth = new Date().toISOString().split('T')[0],
      gender = 'Male',
      blood_group = 'Unknown',
      phone,
      email = null,
      address = '',
      city = '',
      emergency_contact_name = 'Self / Family',
      emergency_contact_phone = phone,
      medical_history = '',
      allergies = '',
      insurance_provider = '',
      insurance_policy_no = ''
    } = req.body;

    // Generate unique UHID (Universal Health Identifier)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uhid = `NC-${new Date().getFullYear()}-${randomSuffix}`;

    const [result] = await db.query(
      `INSERT INTO patients (
        uhid, first_name, last_name, date_of_birth, gender, blood_group,
        phone, email, address, city, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, insurance_provider, insurance_policy_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uhid,
        (first_name || '').trim(),
        (last_name || '').trim(),
        date_of_birth || new Date().toISOString().split('T')[0],
        gender || 'Male',
        blood_group || 'Unknown',
        (phone || '').trim(),
        email && email.trim() ? email.trim() : null,
        address || '',
        city || '',
        emergency_contact_name && emergency_contact_name.trim() ? emergency_contact_name.trim() : 'Self / Family',
        emergency_contact_phone && emergency_contact_phone.trim() ? emergency_contact_phone.trim() : (phone || '').trim(),
        medical_history || '',
        allergies || '',
        insurance_provider || '',
        insurance_policy_no || ''
      ]
    );

    const newId = result.insertId || result.lastID;

    await logAudit(req, 'PATIENT_REGISTERED', 'patients', newId, {
      uhid,
      patient_name: `${first_name} ${last_name}`
    });

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully.',
      data: {
        id: newId,
        uhid,
        first_name,
        last_name,
        phone,
        gender,
        blood_group
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Patient Details
 * PUT /api/patients/:id
 */
async function updatePatient(req, res, next) {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      date_of_birth,
      gender,
      blood_group,
      phone,
      email,
      address,
      city,
      emergency_contact_name,
      emergency_contact_phone,
      medical_history,
      allergies,
      insurance_provider,
      insurance_policy_no
    } = req.body;

    // Check existence
    const [existing] = await db.query('SELECT * FROM patients WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
        timestamp: new Date().toISOString()
      });
    }

    await db.query(
      `UPDATE patients SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        blood_group = COALESCE(?, blood_group),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        emergency_contact_name = COALESCE(?, emergency_contact_name),
        emergency_contact_phone = COALESCE(?, emergency_contact_phone),
        medical_history = COALESCE(?, medical_history),
        allergies = COALESCE(?, allergies),
        insurance_provider = COALESCE(?, insurance_provider),
        insurance_policy_no = COALESCE(?, insurance_policy_no)
       WHERE id = ?`,
      [
        first_name,
        last_name,
        date_of_birth,
        gender,
        blood_group,
        phone,
        email,
        address,
        city,
        emergency_contact_name,
        emergency_contact_phone,
        medical_history,
        allergies,
        insurance_provider,
        insurance_policy_no,
        id
      ]
    );

    await logAudit(req, 'PATIENT_UPDATED', 'patients', id, { updated_by: req.user?.username });

    res.json({
      success: true,
      message: 'Patient information updated successfully.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft Delete Patient (Preserves Clinical Audit Trail)
 * DELETE /api/patients/:id
 */
async function deletePatient(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await db.query('SELECT uhid, first_name, last_name FROM patients WHERE id = ? AND is_deleted = 0', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or already archived.',
        timestamp: new Date().toISOString()
      });
    }

    // Soft delete to guarantee medical history is never erased
    await db.query('UPDATE patients SET is_deleted = 1 WHERE id = ?', [id]);

    await logAudit(req, 'PATIENT_ARCHIVED_SOFT_DELETE', 'patients', id, {
      patient: `${rows[0].first_name} ${rows[0].last_name}`,
      uhid: rows[0].uhid
    });

    res.json({
      success: true,
      message: 'Patient record archived safely. Medical history preserved.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient
};

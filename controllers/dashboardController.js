/**
 * NovaCare Hospital Management System - Dashboard & Analytics Controller
 * Calculates live hospital KPIs, charts, and activity streams directly from the database.
 */
const db = require('../config/db');

async function getStats(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Total Active Patients
    const [patientRows] = await db.query('SELECT COUNT(*) AS total FROM patients WHERE is_deleted = 0');
    const totalPatients = patientRows[0]?.total || 0;

    // 2. Today's Appointments
    const [apptRows] = await db.query(
      'SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = ? AND status != "Cancelled"',
      [today]
    );
    const todayAppointments = apptRows[0]?.total || 0;

    // 3. Bed Occupancy
    const [bedRows] = await db.query(
      'SELECT status, COUNT(*) AS count FROM beds GROUP BY status'
    );
    let totalBeds = 0;
    let occupiedBeds = 0;
    let availableBeds = 0;
    bedRows.forEach((row) => {
      totalBeds += row.count;
      if (row.status === 'Occupied') occupiedBeds = row.count;
      if (row.status === 'Available') availableBeds = row.count;
    });

    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // 4. Financial Statistics (Today's Collections & Total Unpaid)
    const [paymentRows] = await db.query(
      'SELECT COALESCE(SUM(amount), 0) AS today_revenue FROM payments WHERE payment_date LIKE ?',
      [`${today}%`]
    );
    const todayRevenue = Number(paymentRows[0]?.today_revenue || 0);

    const [unpaidRows] = await db.query(
      'SELECT COUNT(*) AS count, COALESCE(SUM(balance_due), 0) AS total_due FROM invoices WHERE payment_status != "Paid"'
    );
    const pendingInvoicesCount = unpaidRows[0]?.count || 0;
    const totalPendingAmount = Number(unpaidRows[0]?.total_due || 0);

    // 5. Critical Pharmacy Alerts
    const [medAlertRows] = await db.query(
      'SELECT COUNT(*) AS low_stock FROM medicines WHERE stock_quantity <= reorder_level'
    );
    const lowStockAlerts = medAlertRows[0]?.low_stock || 0;

    // 6. Active Doctors on Duty
    const [docRows] = await db.query(
      'SELECT COUNT(*) AS active_doctors FROM doctors WHERE status = "ACTIVE" AND is_deleted = 0'
    );
    const activeDoctors = docRows[0]?.active_doctors || 0;

    res.json({
      success: true,
      data: {
        totalPatients,
        todayAppointments,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        todayRevenue,
        pendingInvoicesCount,
        totalPendingAmount,
        lowStockAlerts,
        activeDoctors,
        asOf: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

async function getCharts(req, res, next) {
  try {
    // 1. Weekly Appointment Volume (Last 7 Days)
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

    const [weeklyAppts] = await db.query(
      `SELECT appointment_date, COUNT(*) AS count
       FROM appointments
       WHERE appointment_date >= ?
       GROUP BY appointment_date
       ORDER BY appointment_date ASC`,
      [sevenDaysAgo]
    );

    // 2. Department Patient Distribution
    const [deptDist] = await db.query(
      `SELECT d.department, COUNT(a.id) AS count
       FROM doctors d
       LEFT JOIN appointments a ON d.id = a.doctor_id
       GROUP BY d.department`
    );

    // 3. Bed Occupancy by Ward Type
    const [wardOccupancy] = await db.query(
      `SELECT w.ward_name, w.ward_type,
              COUNT(b.id) AS total_beds,
              SUM(CASE WHEN b.status = 'Occupied' THEN 1 ELSE 0 END) AS occupied_beds
       FROM wards w
       LEFT JOIN beds b ON w.id = b.ward_id
       GROUP BY w.id, w.ward_name, w.ward_type`
    );

    // 4. Pharmacy Stock Categories
    const [pharmaCategories] = await db.query(
      `SELECT category, COUNT(*) AS count, SUM(stock_quantity) AS total_units
       FROM medicines
       GROUP BY category`
    );

    res.json({
      success: true,
      data: {
        weeklyAppointments: weeklyAppts || [],
        departmentDistribution: deptDist || [],
        wardOccupancy: wardOccupancy || [],
        pharmacyCategories: pharmaCategories || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

async function getRecentActivity(req, res, next) {
  try {
    // Combine recent audit logs and payments for live hospital feed
    const [activity] = await db.query(
      `SELECT id, username, action, entity_type, entity_id, details, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 15`
    );

    res.json({
      success: true,
      data: activity || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getCharts,
  getRecentActivity
};

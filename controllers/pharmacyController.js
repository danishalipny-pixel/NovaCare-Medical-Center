/**
 * NovaCare Hospital Management System - Pharmacy & Inventory Controller
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Medicines with Category Filter & Search
 * GET /api/pharmacy/medicines
 */
async function getMedicines(req, res, next) {
  try {
    const { search, category, status } = req.query;
    let conditions = ['1=1'];
    let params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push('(brand_name LIKE ? OR generic_name LIKE ? OR code LIKE ?)');
      params.push(term, term, term);
    }

    if (category && category !== 'ALL') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (status && status !== 'ALL') {
      conditions.push('status = ?');
      params.push(status);
    }

    const [rows] = await db.query(
      `SELECT * FROM medicines WHERE ${conditions.join(' AND ')} ORDER BY brand_name ASC`,
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
 * Add New Medicine Item
 * POST /api/pharmacy/medicines
 */
async function createMedicine(req, res, next) {
  try {
    const {
      brand_name,
      generic_name,
      category,
      dosage_form,
      unit_price,
      stock_quantity = 0,
      reorder_level = 50,
      expiry_date,
      manufacturer
    } = req.body;

    const medCode = `MED-${Math.floor(1000 + Math.random() * 9000)}`;

    const qty = parseInt(stock_quantity, 10);
    const reorder = parseInt(reorder_level, 10);
    const status = qty <= 0 ? 'Out of Stock' : qty <= reorder ? 'Low Stock' : 'Available';

    const [result] = await db.query(
      `INSERT INTO medicines (
        code, brand_name, generic_name, category, dosage_form,
        unit_price, stock_quantity, reorder_level, expiry_date, manufacturer, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medCode,
        brand_name.trim(),
        generic_name.trim(),
        category.trim(),
        dosage_form.trim(),
        parseFloat(unit_price),
        qty,
        reorder,
        expiry_date,
        manufacturer.trim(),
        status
      ]
    );

    const newId = result.insertId || result.lastID;

    await logAudit(req, 'MEDICINE_ADDED', 'medicines', newId, { code: medCode, brand_name, stock: qty });

    res.status(201).json({
      success: true,
      message: 'Medicine added to hospital pharmacy inventory.',
      data: { id: newId, code: medCode, brand_name, status },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Dispense Medicine (Reduces Inventory)
 * POST /api/pharmacy/dispense
 */
async function dispenseMedicine(req, res, next) {
  try {
    const { medicine_id, quantity = 1, patient_id = null } = req.body;

    const [medRows] = await db.query('SELECT * FROM medicines WHERE id = ?', [medicine_id]);
    if (!medRows || medRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found in pharmacy database.',
        timestamp: new Date().toISOString()
      });
    }

    const med = medRows[0];
    const dispenseQty = parseInt(quantity, 10);

    if (med.stock_quantity < dispenseQty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory for ${med.brand_name}. Current available stock: ${med.stock_quantity} units.`,
        timestamp: new Date().toISOString()
      });
    }

    const newStock = med.stock_quantity - dispenseQty;
    const newStatus = newStock <= 0 ? 'Out of Stock' : newStock <= med.reorder_level ? 'Low Stock' : 'Available';

    await db.query(
      'UPDATE medicines SET stock_quantity = ?, status = ? WHERE id = ?',
      [newStock, newStatus, medicine_id]
    );

    await logAudit(req, 'MEDICINE_DISPENSED', 'medicines', medicine_id, {
      brand_name: med.brand_name,
      dispensed: dispenseQty,
      remaining: newStock,
      patient_id
    });

    res.json({
      success: true,
      message: `Successfully dispensed ${dispenseQty} units of ${med.brand_name}.`,
      data: {
        medicine_id,
        brand_name: med.brand_name,
        remainingStock: newStock,
        status: newStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMedicines,
  createMedicine,
  dispenseMedicine
};

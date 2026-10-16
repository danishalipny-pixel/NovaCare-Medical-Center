/**
 * NovaCare Hospital Management System - Billing & Financial Controller
 * Append-only financial ledger; financial and payment audit trail strictly preserved.
 */
const db = require('../config/db');
const { logAudit } = require('../models/database');

/**
 * List Invoices
 * GET /api/billing/invoices
 */
async function getInvoices(req, res, next) {
  try {
    const { status, patient_id } = req.query;
    let conditions = ['1=1'];
    let params = [];

    if (status && status !== 'ALL') {
      conditions.push('i.payment_status = ?');
      params.push(status);
    }
    if (patient_id) {
      conditions.push('i.patient_id = ?');
      params.push(patient_id);
    }

    const [invoices] = await db.query(
      `SELECT i.*, p.first_name, p.last_name, p.uhid, p.phone
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.id DESC`,
      params
    );

    res.json({
      success: true,
      data: invoices || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Invoice by ID (with Line Items and Payments)
 * GET /api/billing/invoices/:id
 */
async function getInvoiceById(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT i.*, p.first_name, p.last_name, p.uhid, p.phone, p.email, p.address
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       WHERE i.id = ? LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
        timestamp: new Date().toISOString()
      });
    }

    const invoice = rows[0];

    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ?',
      [id]
    );

    const [payments] = await db.query(
      `SELECT pay.*, u.full_name AS cashier_name
       FROM payments pay
       LEFT JOIN users u ON pay.recorded_by = u.id
       WHERE pay.invoice_id = ?
       ORDER BY pay.payment_date ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        invoice,
        items: items || [],
        payments: payments || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create New Hospital Invoice
 * POST /api/billing/invoices
 */
async function createInvoice(req, res, next) {
  try {
    const {
      patient_id,
      items = [],
      discount_amount = 0,
      tax_amount = 0,
      due_date,
      notes = ''
    } = req.body;

    const [patientRows] = await db.query(
      'SELECT id, first_name, last_name, uhid FROM patients WHERE id = ? AND is_deleted = 0',
      [patient_id]
    );
    if (!patientRows || patientRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one billing line item is required.',
        timestamp: new Date().toISOString()
      });
    }

    // Calculate totals
    let subtotal = 0;
    const validatedItems = items.map((item) => {
      const qty = parseInt(item.quantity || 1, 10);
      const unitPrice = parseFloat(item.unit_price || 0);
      const total = qty * unitPrice;
      subtotal += total;
      return {
        item_type: item.item_type || 'Consultation',
        item_name: item.item_name || 'Hospital Service',
        quantity: qty,
        unit_price: unitPrice,
        total_price: total
      };
    });

    const discount = parseFloat(discount_amount || 0);
    const tax = parseFloat(tax_amount || 0);
    const netPayable = Math.max(0, subtotal - discount + tax);
    const today = new Date().toISOString().split('T')[0];
    const invoiceDueDate = due_date || today;

    const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [result] = await db.query(
      `INSERT INTO invoices (
        invoice_no, patient_id, total_amount, discount_amount, tax_amount,
        net_payable, paid_amount, balance_due, payment_status,
        invoice_date, due_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 'Unpaid', ?, ?, ?)`,
      [
        invoiceNo,
        patient_id,
        subtotal,
        discount,
        tax,
        netPayable,
        netPayable,
        today,
        invoiceDueDate,
        notes
      ]
    );

    const invoiceId = result.insertId || result.lastID;

    // Insert items
    for (const itm of validatedItems) {
      await db.query(
        `INSERT INTO invoice_items (invoice_id, item_type, item_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, itm.item_type, itm.item_name, itm.quantity, itm.unit_price, itm.total_price]
      );
    }

    await logAudit(req, 'INVOICE_GENERATED', 'invoices', invoiceId, {
      invoice_no: invoiceNo,
      patient_id,
      netPayable
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: {
        id: invoiceId,
        invoice_no: invoiceNo,
        net_payable: netPayable,
        balance_due: netPayable,
        payment_status: 'Unpaid'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Record Payment against Invoice
 * POST /api/billing/payments
 */
async function recordPayment(req, res, next) {
  try {
    const { invoice_id, amount, payment_method = 'Cash', transaction_ref = '', notes = '' } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero.',
        timestamp: new Date().toISOString()
      });
    }

    const [invoiceRows] = await db.query('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
    if (!invoiceRows || invoiceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
        timestamp: new Date().toISOString()
      });
    }

    const invoice = invoiceRows[0];
    const currentPaid = parseFloat(invoice.paid_amount || 0);
    const netPayable = parseFloat(invoice.net_payable);

    const newPaid = currentPaid + payAmount;
    const newBalance = Math.max(0, netPayable - newPaid);
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

    const paymentNo = `PAY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Record payment
    const [payResult] = await db.query(
      `INSERT INTO payments (
        payment_no, invoice_id, patient_id, amount, payment_method,
        transaction_ref, recorded_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentNo,
        invoice_id,
        invoice.patient_id,
        payAmount,
        payment_method,
        transaction_ref || null,
        req.user?.id || null,
        notes || null
      ]
    );

    // Update invoice balance and status
    await db.query(
      'UPDATE invoices SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ?',
      [newPaid, newBalance, newStatus, invoice_id]
    );

    const paymentId = payResult.insertId || payResult.lastID;

    await logAudit(req, 'PAYMENT_RECORDED', 'payments', paymentId, {
      payment_no: paymentNo,
      invoice_no: invoice.invoice_no,
      amount: payAmount,
      method: payment_method,
      newBalance
    });

    res.status(201).json({
      success: true,
      message: `Payment of $${payAmount.toFixed(2)} recorded successfully. Invoice status: ${newStatus}.`,
      data: {
        payment_no: paymentNo,
        invoice_id,
        amount_paid: payAmount,
        total_paid: newPaid,
        balance_due: newBalance,
        payment_status: newStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  recordPayment
};

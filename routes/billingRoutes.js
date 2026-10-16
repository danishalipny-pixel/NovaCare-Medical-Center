/**
 * NovaCare Hospital Management System - Billing & Financial Routes
 */
const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get('/invoices', requireRoles('ADMIN', 'RECEPTIONIST'), billingController.getInvoices);
router.get('/invoices/:id', requireRoles('ADMIN', 'RECEPTIONIST'), billingController.getInvoiceById);

router.post(
  '/invoices',
  requireRoles('ADMIN', 'RECEPTIONIST'),
  validateBody(['patient_id', 'items']),
  billingController.createInvoice
);

router.post(
  '/payments',
  requireRoles('ADMIN', 'RECEPTIONIST'),
  validateBody(['invoice_id', 'amount', 'payment_method']),
  billingController.recordPayment
);

module.exports = router;

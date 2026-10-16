/**
 * NovaCare Hospital Management System - Pharmacy & Inventory Routes
 */
const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { verifyToken, requireRoles } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(verifyToken);

router.get('/', pharmacyController.getMedicines);
router.get('/medicines', pharmacyController.getMedicines);

router.post(
  '/',
  requireRoles('ADMIN', 'PHARMACIST', 'RECEPTIONIST'),
  validateBody(['brand_name', 'generic_name', 'category', 'dosage_form', 'unit_price', 'expiry_date', 'manufacturer']),
  pharmacyController.createMedicine
);

router.post(
  '/medicines',
  requireRoles('ADMIN', 'PHARMACIST', 'RECEPTIONIST'),
  validateBody(['brand_name', 'generic_name', 'category', 'dosage_form', 'unit_price', 'expiry_date', 'manufacturer']),
  pharmacyController.createMedicine
);

router.post(
  '/dispense',
  requireRoles('ADMIN', 'PHARMACIST', 'NURSE'),
  validateBody(['medicine_id', 'quantity']),
  pharmacyController.dispenseMedicine
);

module.exports = router;

/**
 * NovaCare Hospital Management System - Health Diagnostic Route
 */
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Public health check for load balancers & monitors
router.get('/', healthController.getHealth);

module.exports = router;

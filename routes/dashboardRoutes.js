/**
 * NovaCare Hospital Management System - Dashboard & Analytics Routes
 */
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

router.get('/stats', verifyToken, dashboardController.getStats);
router.get('/charts', verifyToken, dashboardController.getCharts);
router.get('/recent-activity', verifyToken, dashboardController.getRecentActivity);

module.exports = router;

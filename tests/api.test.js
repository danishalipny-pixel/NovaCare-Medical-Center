/**
 * NovaCare Hospital Management System - Automated Integration Test Suite
 * Tests APIs using Node.js native test runner (node:test) and Supertest.
 * Operates in isolated test database environment.
 */
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_security';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app } = require('../server');
const db = require('../config/db');

describe('🏥 NovaCare Hospital Management System - Live API Integration Tests', () => {
  let adminToken = '';
  let receptionistToken = '';
  let testPatientId = null;
  let testDoctorId = 1;
  let testBedId = null;
  let testInvoiceId = null;

  before(async () => {
    // Initialize isolated test database
    await db.initDatabase('sqlite');
  });

  after(async () => {
    await db.close();
  });

  // ==========================================================================
  // 1. Health Diagnostics & Assets
  // ==========================================================================
  describe('A. Health Diagnostics & Static Assets', () => {
    it('GET /api/health should return 200 with healthy database dependency status', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'healthy');
      assert.equal(res.body.dependencies.database.status, 'connected');
      assert.ok(res.body.uptime, 'Uptime should be reported');
      assert.ok(res.body.system.memoryUsedMB > 0, 'Memory usage should be reported');
      // Verify no secrets or credentials leaked
      assert.equal(res.body.password, undefined);
      assert.equal(res.body.database_url, undefined);
    });

    it('GET / should serve frontend index.html with 200 OK', async () => {
      const res = await request(app).get('/');
      assert.equal(res.status, 200);
      assert.match(res.text, /NovaCare \| Enterprise Hospital Management System/);
      assert.match(res.text, /id="view-dashboard"/);
    });
  });

  // ==========================================================================
  // 2. Authentication & Authorization (RBAC)
  // ==========================================================================
  describe('B. Authentication & RBAC Authorization', () => {
    it('POST /api/auth/login with valid admin credentials should return 200 and JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'Admin@123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token, 'Should return JWT token');
      assert.equal(res.body.data.user.role, 'ADMIN');
      adminToken = res.body.data.token;
    });

    it('POST /api/auth/login with valid receptionist credentials should return 200 and JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'rec.john', password: 'Staff@123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.role, 'RECEPTIONIST');
      receptionistToken = res.body.data.token;
    });

    it('POST /api/auth/login with incorrect password should return 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'WrongPassword999!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid credentials/);
    });

    it('GET /api/auth/me with valid Bearer token should return user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.username, 'admin');
    });

    it('GET /api/patients without token should be rejected with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/patients');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('POST /api/auth/register by non-admin should be rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          username: 'unauth_user',
          email: 'unauth@novacare.org',
          password: 'Password123',
          full_name: 'Unauthorized Staff',
          role: 'DOCTOR'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.message, /Forbidden/);
    });
  });

  // ==========================================================================
  // 3. Patient Management & Soft Deletion
  // ==========================================================================
  describe('C. Patient Registration, Retrieval & Soft Deletion', () => {
    it('POST /api/patients should register patient with UHID and return 201 Created', async () => {
      const newPatient = {
        first_name: 'Alexander',
        last_name: 'Pierce',
        date_of_birth: '1985-07-14',
        gender: 'Male',
        blood_group: 'O+',
        phone: '+1-555-8831',
        email: 'alex.pierce@example.com',
        address: '100 Medical Center Blvd',
        city: 'Metropolis',
        emergency_contact_name: 'Grace Pierce',
        emergency_contact_phone: '+1-555-8832',
        allergies: 'Ciprofloxacin',
        medical_history: 'None reported',
        insurance_provider: 'Blue Cross Shield',
        insurance_policy_no: 'BC-991204'
      };

      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(newPatient);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.uhid.startsWith('NC-'));
      testPatientId = res.body.data.id;
    });

    it('POST /api/patients with missing required fields should return 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          first_name: 'Incomplete'
          // Missing last_name, phone, emergency contact
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.errors.length > 0);
    });

    it('GET /api/patients should return list containing newly registered patient', async () => {
      const res = await request(app)
        .get('/api/patients?search=Pierce')
        .set('Authorization', `Bearer ${receptionistToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.patients.length >= 1);
      assert.equal(res.body.data.patients[0].last_name, 'Pierce');
    });

    it('GET /api/patients/:id should return complete patient record', async () => {
      const res = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.patient.first_name, 'Alexander');
      assert.ok(Array.isArray(res.body.data.appointments));
      assert.ok(Array.isArray(res.body.data.consultations));
    });

    it('PUT /api/patients/:id should update patient contact info', async () => {
      const res = await request(app)
        .put(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ phone: '+1-555-9999' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('DELETE /api/patients/:id should soft-delete patient preserving clinical history', async () => {
      const res = await request(app)
        .delete(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /archived safely/i);

      // Verify patient is excluded from active queries
      const getRes = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(getRes.status, 404);
    });
  });

  // ==========================================================================
  // 4. Appointment Scheduling & Slot Conflict Validation
  // ==========================================================================
  describe('D. Appointment Scheduling & Conflict Validation', () => {
    const testDate = '2026-11-20';

    it('POST /api/appointments should schedule valid appointment slot', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: 1,
          doctor_id: testDoctorId,
          appointment_date: testDate,
          start_time: '10:00',
          end_time: '10:30',
          reason: 'Cardiac routine follow-up'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.appointment_no);
    });

    it('POST /api/appointments with overlapping slot for same doctor must return 409 Conflict', async () => {
      // Overlapping slot: 10:15 - 10:45 overlaps with 10:00 - 10:30
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: 2,
          doctor_id: testDoctorId,
          appointment_date: testDate,
          start_time: '10:15',
          end_time: '10:45',
          reason: 'Emergency consultation request'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Scheduling conflict/);
    });
  });

  // ==========================================================================
  // 5. Inpatient Wards & Bed Allocation
  // ==========================================================================
  describe('E. Wards & Inpatient Bed Allocation', () => {
    it('GET /api/beds should return list of wards and bed statuses', async () => {
      const res = await request(app)
        .get('/api/beds')
        .set('Authorization', `Bearer ${receptionistToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.wards.length > 0);
      assert.ok(res.body.data.beds.length > 0);

      // Find an available bed for admission test
      const available = res.body.data.beds.find((b) => b.status === 'Available');
      assert.ok(available, 'Should have at least one available bed');
      testBedId = available.id;
    });

    it('POST /api/beds/admit should admit patient to available bed', async () => {
      const res = await request(app)
        .post('/api/beds/admit')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          bed_id: testBedId,
          patient_id: 2
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('POST /api/beds/admit on already occupied bed should return 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/beds/admit')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          bed_id: testBedId,
          patient_id: 3
        });

      assert.equal(res.status, 409);
      assert.match(res.body.message, /occupied/i);
    });

    it('POST /api/beds/discharge should release bed and restore status to Available', async () => {
      const res = await request(app)
        .post('/api/beds/discharge')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          bed_id: testBedId,
          discharge_summary: 'Full recovery documented.'
        });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /available/i);
    });
  });

  // ==========================================================================
  // 6. Billing & Payment Workflows
  // ==========================================================================
  describe('F. Billing & Payment Workflows', () => {
    it('POST /api/billing/invoices should generate invoice with line items', async () => {
      const invoiceData = {
        patient_id: 1,
        discount_amount: 10.0,
        tax_amount: 5.0,
        items: [
          {
            item_type: 'Consultation',
            item_name: 'Cardiology Special Review',
            quantity: 1,
            unit_price: 150.0
          },
          {
            item_type: 'Medicine',
            item_name: 'Atorvastatin 20mg 30-day pack',
            quantity: 1,
            unit_price: 30.0
          }
        ]
      };

      const res = await request(app)
        .post('/api/billing/invoices')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(invoiceData);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.invoice_no);
      // Net: 150 + 30 - 10 + 5 = 175.00
      assert.equal(res.body.data.net_payable, 175.0);
      testInvoiceId = res.body.data.id;
    });

    it('POST /api/billing/payments should record partial payment and update balance', async () => {
      const res = await request(app)
        .post('/api/billing/payments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          invoice_id: testInvoiceId,
          amount: 75.0,
          payment_method: 'Credit_Card',
          notes: 'Initial copay'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.payment_status, 'Partial');
      assert.equal(res.body.data.balance_due, 100.0);
    });

    it('POST /api/billing/payments settling remaining balance should update status to Paid', async () => {
      const res = await request(app)
        .post('/api/billing/payments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          invoice_id: testInvoiceId,
          amount: 100.0,
          payment_method: 'Cash',
          notes: 'Full balance settled'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.payment_status, 'Paid');
      assert.equal(res.body.data.balance_due, 0.0);
    });

    it('GET /api/billing/invoices/:id should return complete invoice with audit line items and payments', async () => {
      const res = await request(app)
        .get(`/api/billing/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 2);
      assert.equal(res.body.data.payments.length, 2);
      assert.equal(res.body.data.invoice.payment_status, 'Paid');
    });
  });
});

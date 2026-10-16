-- ==============================================================================
-- NovaCare Hospital Management System - Initial Seed Data
-- ==============================================================================

-- 1. Default Roles and Users
-- Passwords:
-- admin: Admin@123
-- dr.sarah: Doctor@123
-- rec.john: Staff@123
-- nurse.emily: Staff@123
-- pharm.david: Staff@123

INSERT INTO users (id, username, email, password_hash, full_name, role, status) VALUES
(1, 'admin', 'admin@novacare.org', '$2b$10$mwuV6fATVgrULZFO36WVMeV.aKJfLE8lAwhhP2oBmt2B121Qzzlk.', 'System Administrator', 'ADMIN', 'ACTIVE'),
(2, 'dr.sarah', 'sarah.jenkins@novacare.org', '$2b$10$zYG3xOOjMTKRfG2hBqjuHOVVLeJpEk5sa727U8BEIgUaV0Dt0Ij.S', 'Dr. Sarah Jenkins', 'DOCTOR', 'ACTIVE'),
(3, 'dr.marcus', 'marcus.vance@novacare.org', '$2b$10$zYG3xOOjMTKRfG2hBqjuHOVVLeJpEk5sa727U8BEIgUaV0Dt0Ij.S', 'Dr. Marcus Vance', 'DOCTOR', 'ACTIVE'),
(4, 'rec.john', 'john.reception@novacare.org', '$2b$10$8S0L74l77zGifCfwQlqSbOM9gAOquD6pmdtXtmRydw.q5NEss5qDW', 'John Doe (Front Desk)', 'RECEPTIONIST', 'ACTIVE'),
(5, 'nurse.emily', 'emily.nurse@novacare.org', '$2b$10$8S0L74l77zGifCfwQlqSbOM9gAOquD6pmdtXtmRydw.q5NEss5qDW', 'Emily Stone (Head Nurse)', 'NURSE', 'ACTIVE'),
(6, 'pharm.david', 'david.pharma@novacare.org', '$2b$10$8S0L74l77zGifCfwQlqSbOM9gAOquD6pmdtXtmRydw.q5NEss5qDW', 'David Miller (Lead Pharmacist)', 'PHARMACIST', 'ACTIVE')
ON DUPLICATE KEY UPDATE username=username;

-- 2. Doctors Directory
INSERT INTO doctors (id, user_id, doctor_code, full_name, specialization, department, qualification, consultation_fee, room_no, phone, email, available_days, start_time, end_time, status) VALUES
(1, 2, 'DOC-101', 'Dr. Sarah Jenkins', 'Interventional Cardiology', 'Cardiology', 'MD, FACC, FSCAI', 150.00, 'Suite 301', '+1-555-0101', 'sarah.jenkins@novacare.org', 'Monday,Wednesday,Friday', '09:00:00', '16:00:00', 'ACTIVE'),
(2, 3, 'DOC-102', 'Dr. Marcus Vance', 'Neurology & Stroke Care', 'Neurology', 'MBBS, PhD, FAAN', 160.00, 'Suite 204', '+1-555-0102', 'marcus.vance@novacare.org', 'Tuesday,Thursday,Saturday', '10:00:00', '17:00:00', 'ACTIVE'),
(3, NULL, 'DOC-103', 'Dr. Elena Rostova', 'Pediatric Medicine', 'Pediatrics', 'MD, FAAP', 120.00, 'Suite 105', '+1-555-0103', 'elena.rostova@novacare.org', 'Monday,Tuesday,Wednesday,Thursday,Friday', '08:30:00', '15:30:00', 'ACTIVE'),
(4, NULL, 'DOC-104', 'Dr. Tariq Al-Mansoor', 'Orthopedic Surgery', 'Orthopedics', 'FRCS (Orth), MS', 180.00, 'Suite 402', '+1-555-0104', 'tariq.mansoor@novacare.org', 'Monday,Thursday', '09:00:00', '14:00:00', 'ACTIVE'),
(5, NULL, 'DOC-105', 'Dr. Aisha Patel', 'Internal Medicine', 'General Medicine', 'MBBS, MD', 110.00, 'Suite 102', '+1-555-0105', 'aisha.patel@novacare.org', 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', '09:00:00', '18:00:00', 'ACTIVE')
ON DUPLICATE KEY UPDATE doctor_code=doctor_code;

-- 3. Initial Patients
INSERT INTO patients (id, uhid, first_name, last_name, date_of_birth, gender, blood_group, phone, email, address, city, emergency_contact_name, emergency_contact_phone, medical_history, allergies, insurance_provider, insurance_policy_no) VALUES
(1, 'NC-2026-0001', 'Robert', 'Sterling', '1982-04-12', 'Male', 'O+', '+1-555-0201', 'robert.sterling@example.com', '742 Evergreen Terrace', 'Springfield', 'Eleanor Sterling', '+1-555-0202', 'Hypertension (diagnosed 2018), Type 2 Diabetes', 'Penicillin', 'Blue Cross Shield', 'BC-8899214'),
(2, 'NC-2026-0002', 'Maria', 'Rodriguez', '1990-11-23', 'Female', 'A+', '+1-555-0203', 'maria.rodriguez@example.com', '124 Conch Street', 'Pacific Grove', 'Carlos Rodriguez', '+1-555-0204', 'Mild Asthma', 'Sulfa drugs, NSAIDs', 'Aetna Global Health', 'AET-3349102'),
(3, 'NC-2026-0003', 'Liam', 'Chen', '2015-06-08', 'Male', 'B-', '+1-555-0205', 'chen.family@example.com', '45 Elm Street', 'Oakland', 'Wei Chen', '+1-555-0206', 'None', 'Peanuts, Shellfish', 'UnitedHealthcare', 'UHC-4401928'),
(4, 'NC-2026-0004', 'Sophia', 'Dubois', '1975-09-17', 'Female', 'AB+', '+1-555-0207', 'sophia.d@example.com', '88 Riverbend Way', 'Riverside', 'Jacques Dubois', '+1-555-0208', 'Hypothyroidism', 'None known', 'Cigna Healthcare', 'CIG-9021844'),
(5, 'NC-2026-0005', 'James', 'Kowalski', '1968-01-30', 'Male', 'O-', '+1-555-0209', 'j.kowalski@example.com', '312 Industrial Park Rd', 'Metropolis', 'Anna Kowalski', '+1-555-0210', 'Coronary Artery Disease, Stent placement 2021', 'Aspirin (gastro-sensitive)', 'Medicare Part B', 'MED-1102938')
ON DUPLICATE KEY UPDATE uhid=uhid;

-- 4. Wards & Inpatient Beds
INSERT INTO wards (id, ward_code, ward_name, ward_type, daily_charge, total_beds) VALUES
(1, 'WARD-ICU', 'Intensive Care Unit (ICU)', 'ICU', 750.00, 4),
(2, 'WARD-GMW', 'General Male Medical Ward', 'General Male', 250.00, 6),
(3, 'WARD-GFW', 'General Female Medical Ward', 'General Female', 250.00, 6),
(4, 'WARD-PED', 'Pediatric Care Pavilion', 'Pediatric', 300.00, 4),
(5, 'WARD-PRV', 'Executive Private Suites', 'Private Suite', 600.00, 4)
ON DUPLICATE KEY UPDATE ward_code=ward_code;

INSERT INTO beds (id, ward_id, bed_number, status, current_patient_id, admission_date) VALUES
(1, 1, 'ICU-101', 'Occupied', 5, CURRENT_TIMESTAMP),
(2, 1, 'ICU-102', 'Available', NULL, NULL),
(3, 1, 'ICU-103', 'Available', NULL, NULL),
(4, 1, 'ICU-104', 'Maintenance', NULL, NULL),
(5, 2, 'GMW-201', 'Occupied', 1, CURRENT_TIMESTAMP),
(6, 2, 'GMW-202', 'Available', NULL, NULL),
(7, 2, 'GMW-203', 'Available', NULL, NULL),
(8, 3, 'GFW-301', 'Occupied', 2, CURRENT_TIMESTAMP),
(9, 3, 'GFW-302', 'Available', NULL, NULL),
(10, 4, 'PED-401', 'Available', NULL, NULL),
(11, 5, 'PRV-501', 'Available', NULL, NULL),
(12, 5, 'PRV-502', 'Available', NULL, NULL)
ON DUPLICATE KEY UPDATE bed_number=bed_number;

-- 5. Appointments
INSERT INTO appointments (id, appointment_no, patient_id, doctor_id, appointment_date, start_time, end_time, reason, status) VALUES
(1, 'APT-2026-0001', 1, 1, CURRENT_DATE, '09:30:00', '10:00:00', 'Routine cardiac stress check and blood pressure management review.', 'Scheduled'),
(2, 'APT-2026-0002', 2, 2, CURRENT_DATE, '10:30:00', '11:00:00', 'Recurring migraine episodes and aura follow-up.', 'Scheduled'),
(3, 'APT-2026-0003', 3, 3, CURRENT_DATE, '11:00:00', '11:30:00', 'Pediatric seasonal allergies and respiratory wellness exam.', 'Scheduled'),
(4, 'APT-2026-0004', 4, 5, CURRENT_DATE, '14:00:00', '14:30:00', 'Annual wellness checkup and thyroid hormone titration.', 'Scheduled'),
(5, 'APT-2026-0005', 5, 4, CURRENT_DATE, '15:00:00', '15:30:00', 'Post-surgical left knee joint mobility assessment.', 'Scheduled')
ON DUPLICATE KEY UPDATE appointment_no=appointment_no;

-- 6. Pharmacy / Medicines
INSERT INTO medicines (id, code, brand_name, generic_name, category, dosage_form, unit_price, stock_quantity, reorder_level, expiry_date, manufacturer, status) VALUES
(1, 'MED-1001', 'Lipitor 20mg', 'Atorvastatin Calcium', 'Cardiovascular', 'Tablet', 1.85, 420, 50, '2027-12-31', 'Pfizer Inc.', 'Available'),
(2, 'MED-1002', 'Glucophage 500mg', 'Metformin HCl', 'Antidiabetic', 'Tablet', 0.95, 380, 50, '2028-04-30', 'Merck KGaA', 'Available'),
(3, 'MED-1003', 'Augmentin 625mg', 'Amoxicillin + Clavulanate', 'Antibiotic', 'Tablet', 3.40, 24, 40, '2027-02-28', 'GSK Pharma', 'Low Stock'),
(4, 'MED-1004', 'Ventolin HFA', 'Albuterol Sulfate Inhaler', 'Respiratory', 'Inhaler', 28.50, 65, 20, '2027-08-15', 'GlaxoSmithKline', 'Available'),
(5, 'MED-1005', 'Nexium 40mg', 'Esomeprazole Magnesium', 'Gastrointestinal', 'Delayed-Release Capsule', 2.10, 190, 30, '2027-10-31', 'AstraZeneca', 'Available'),
(6, 'MED-1006', 'Norvasc 5mg', 'Amlodipine Besylate', 'Cardiovascular', 'Tablet', 1.20, 310, 50, '2028-06-30', 'Pfizer Inc.', 'Available'),
(7, 'MED-1007', 'Rocephin 1g', 'Ceftriaxone Sodium IV', 'Injectable Antibiotic', 'Vial', 14.50, 12, 25, '2027-01-15', 'Roche Diagnostics', 'Low Stock'),
(8, 'MED-1008', 'Panadol Extra 500mg', 'Paracetamol + Caffeine', 'Analgesic', 'Tablet', 0.40, 650, 100, '2028-11-30', 'Haleon Healthcare', 'Available')
ON DUPLICATE KEY UPDATE code=code;

-- 7. Invoices & Billing
INSERT INTO invoices (id, invoice_no, patient_id, total_amount, discount_amount, tax_amount, net_payable, paid_amount, balance_due, payment_status, invoice_date, due_date, notes) VALUES
(1, 'INV-2026-0001', 1, 150.00, 0.00, 7.50, 157.50, 157.50, 0.00, 'Paid', CURRENT_DATE, CURRENT_DATE, 'Consultation fee with Dr. Sarah Jenkins'),
(2, 'INV-2026-0002', 2, 320.00, 20.00, 15.00, 315.00, 150.00, 165.00, 'Partial', CURRENT_DATE, CURRENT_DATE, 'Neurology consultation + EEG diagnostic procedure'),
(3, 'INV-2026-0003', 5, 850.00, 50.00, 40.00, 840.00, 0.00, 840.00, 'Unpaid', CURRENT_DATE, CURRENT_DATE, 'ICU Day 1 accommodation + emergency IV medication')
ON DUPLICATE KEY UPDATE invoice_no=invoice_no;

INSERT INTO invoice_items (id, invoice_id, item_type, item_name, quantity, unit_price, total_price) VALUES
(1, 1, 'Consultation', 'Cardiology Specialist Consultation', 1, 150.00, 150.00),
(2, 2, 'Consultation', 'Neurology Specialist Consultation', 1, 160.00, 160.00),
(3, 2, 'Procedure', 'Digital Electroencephalogram (EEG)', 1, 160.00, 160.00),
(4, 3, 'Room_Charge', 'ICU Daily Room Charge', 1, 750.00, 750.00),
(5, 3, 'Medicine', 'Emergency IV Stabilization Pack', 1, 100.00, 100.00)
ON DUPLICATE KEY UPDATE id=id;

-- 8. Payments
INSERT INTO payments (id, payment_no, invoice_id, patient_id, amount, payment_method, transaction_ref, recorded_by, notes) VALUES
(1, 'PAY-2026-0001', 1, 1, 157.50, 'Credit_Card', 'TXN-CC-994821', 4, 'Settled at front desk via Visa ending in 4092'),
(2, 'PAY-2026-0002', 2, 2, 150.00, 'Insurance', 'COPAY-AETNA-7721', 4, 'Patient insurance co-pay received')
ON DUPLICATE KEY UPDATE payment_no=payment_no;

/**
 * NovaCare Hospital Management System - Core Frontend Application Controller
 * Connects all UI views, tables, forms, modals, and charts to real backend APIs.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentModule: 'dashboard',
    currentUser: null,
    patients: [],
    doctors: [],
    appointments: [],
    beds: [],
    wards: [],
    medicines: [],
    invoices: [],
    charts: {
      weeklyTrend: null,
      deptDist: null,
      wardOccupancy: null
    }
  };

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item flex items-center p-4 rounded-lg shadow-lg border text-sm max-w-sm ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
        : type === 'error'
        ? 'bg-rose-50 border-rose-300 text-rose-800'
        : type === 'warning'
        ? 'bg-amber-50 border-amber-300 text-amber-800'
        : 'bg-sky-50 border-sky-300 text-sky-800'
    }`;

    const icon =
      type === 'success'
        ? 'fa-check-circle'
        : type === 'error'
        ? 'fa-exclamation-circle'
        : type === 'warning'
        ? 'fa-triangle-exclamation'
        : 'fa-info-circle';

    toast.innerHTML = `
      <i class="fa-solid ${icon} mr-3 text-lg"></i>
      <div class="flex-1 font-medium">${escapeHtml(message)}</div>
      <button class="ml-3 text-gray-400 hover:text-gray-700" onclick="this.parentElement.remove()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Modal Utilities
  // ==========================================================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (['bookAppointmentModal', 'newConsultationModal', 'addBedModal', 'admitPatientModal', 'createInvoiceModal'].includes(modalId)) {
        populateModalDropdowns();
      }
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  // ==========================================================================
  // Authentication & Session
  // ==========================================================================
  async function initAuth() {
    const token = window.NovaCareApi.getToken();
    const loginModal = document.getElementById('loginModal');
    const userProfileSection = document.getElementById('userProfileSection');

    if (!token) {
      // Prompt login or show demo login
      openModal('loginModal');
      return;
    }

    try {
      const res = await window.NovaCareApi.getCurrentUser();
      state.currentUser = res.data.user;
      renderUserBadge();
      closeModal('loginModal');
      populateModalDropdowns();
      loadModule(state.currentModule);
    } catch (err) {
      window.NovaCareApi.clearAuth();
      openModal('loginModal');
    }
  }

  function renderUserBadge() {
    const nameEl = document.getElementById('currentUserName');
    const roleEl = document.getElementById('currentUserRole');
    if (nameEl && state.currentUser) {
      nameEl.textContent = state.currentUser.full_name;
    }
    if (roleEl && state.currentUser) {
      roleEl.textContent = state.currentUser.role;
    }
  }

  // Quick Demo Login Fill
  window.fillDemoCredentials = function (role) {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    if (!usernameInput || !passwordInput) return;

    if (role === 'admin') {
      usernameInput.value = 'admin';
      passwordInput.value = 'Admin@123';
    } else if (role === 'doctor') {
      usernameInput.value = 'dr.sarah';
      passwordInput.value = 'Doctor@123';
    } else if (role === 'receptionist') {
      usernameInput.value = 'rec.john';
      passwordInput.value = 'Staff@123';
    } else if (role === 'pharmacist') {
      usernameInput.value = 'pharm.david';
      passwordInput.value = 'Staff@123';
    } else if (role === 'nurse') {
      usernameInput.value = 'nurse.emily';
      passwordInput.value = 'Staff@123';
    }
    showToast(`Loaded ${role.toUpperCase()} test credentials. Click Sign In to authenticate.`, 'info');
  };

  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
      showToast('Please provide both username and password.', 'warning');
      return;
    }

    try {
      const res = await window.NovaCareApi.login(username, password);
      state.currentUser = res.data.user;
      renderUserBadge();
      closeModal('loginModal');
      showToast(`Welcome back, ${state.currentUser.full_name}!`, 'success');
      populateModalDropdowns();
      loadModule(state.currentModule);
    } catch (err) {
      showToast(err.message || 'Login failed. Please check credentials.', 'error');
    }
  }

  async function handleLogout() {
    await window.NovaCareApi.logout();
    state.currentUser = null;
    showToast('Logged out successfully.', 'info');
    openModal('loginModal');
  }

  // ==========================================================================
  // Navigation & Module Router
  // ==========================================================================
  function switchModule(moduleName) {
    state.currentModule = moduleName;

    // Update active nav pills
    document.querySelectorAll('.nav-link').forEach((link) => {
      if (link.dataset.module === moduleName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hide all module views, show selected
    document.querySelectorAll('.module-view').forEach((view) => {
      if (view.id === `view-${moduleName}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Load module data
    loadModule(moduleName);
  }

  function loadModule(moduleName) {
    switch (moduleName) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'patients':
        loadPatients();
        break;
      case 'appointments':
        loadAppointments();
        break;
      case 'doctors':
        loadDoctors();
        break;
      case 'emr':
        loadConsultations();
        break;
      case 'beds':
        loadBeds();
        break;
      case 'pharmacy':
        loadPharmacy();
        break;
      case 'billing':
        loadBilling();
        break;
      case 'diagnostics':
        loadDiagnostics();
        break;
      default:
        loadDashboardData();
    }
  }

  // ==========================================================================
  // 1. Dashboard Module
  // ==========================================================================
  async function loadDashboardData() {
    try {
      const [statsRes, chartsRes, activityRes] = await Promise.all([
        window.NovaCareApi.getDashboardStats(),
        window.NovaCareApi.getDashboardCharts(),
        window.NovaCareApi.getRecentActivity()
      ]);

      const s = statsRes.data;
      document.getElementById('kpiTotalPatients').textContent = s.totalPatients;
      document.getElementById('kpiTodayAppointments').textContent = s.todayAppointments;
      document.getElementById('kpiBedOccupancy').textContent = `${s.occupancyRate}% (${s.occupiedBeds}/${s.totalBeds})`;
      document.getElementById('kpiTodayRevenue').textContent = `$${s.todayRevenue.toFixed(2)}`;
      document.getElementById('kpiPendingInvoices').textContent = `${s.pendingInvoicesCount} ($${s.totalPendingAmount.toFixed(2)})`;
      document.getElementById('kpiLowStockAlerts').textContent = s.lowStockAlerts;

      renderDashboardCharts(chartsRes.data);
      renderRecentActivity(activityRes.data);
    } catch (err) {
      showToast('Error loading dashboard statistics: ' + err.message, 'error');
    }
  }

  function renderDashboardCharts(chartData) {
    // 1. Weekly Appointment Volume Line Chart
    const weeklyCanvas = document.getElementById('chartWeeklyTrend');
    if (weeklyCanvas && chartData.weeklyAppointments) {
      if (state.charts.weeklyTrend) state.charts.weeklyTrend.destroy();
      const labels = chartData.weeklyAppointments.map((a) => a.appointment_date);
      const data = chartData.weeklyAppointments.map((a) => a.count);

      state.charts.weeklyTrend = new Chart(weeklyCanvas, {
        type: 'line',
        data: {
          labels: labels.length > 0 ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Daily Appointments',
              data: data.length > 0 ? data : [12, 19, 15, 22, 18, 14, 8],
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.1)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointBackgroundColor: '#0284c7',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Department Patient Distribution Bar Chart
    const deptCanvas = document.getElementById('chartDeptDist');
    if (deptCanvas && chartData.departmentDistribution) {
      if (state.charts.deptDist) state.charts.deptDist.destroy();
      const labels = chartData.departmentDistribution.map((d) => d.department);
      const data = chartData.departmentDistribution.map((d) => d.count);

      state.charts.deptDist = new Chart(deptCanvas, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine'],
          datasets: [
            {
              label: 'Patients',
              data: data.length > 0 ? data : [45, 32, 28, 20, 50],
              backgroundColor: ['#0284c7', '#0d9488', '#6366f1', '#f59e0b', '#10b981'],
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Bed Occupancy Doughnut Chart
    const wardCanvas = document.getElementById('chartWardOccupancy');
    if (wardCanvas && chartData.wardOccupancy) {
      if (state.charts.wardOccupancy) state.charts.wardOccupancy.destroy();
      const labels = chartData.wardOccupancy.map((w) => w.ward_name);
      const occupiedData = chartData.wardOccupancy.map((w) => w.occupied_beds || 0);

      state.charts.wardOccupancy = new Chart(wardCanvas, {
        type: 'doughnut',
        data: {
          labels: labels.length > 0 ? labels : ['ICU', 'General Male', 'General Female', 'Pediatric', 'Private'],
          datasets: [
            {
              data: occupiedData.length > 0 ? occupiedData : [3, 4, 3, 2, 1],
              backgroundColor: ['#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981'],
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }
  }

  function renderRecentActivity(activities) {
    const listEl = document.getElementById('recentActivityList');
    if (!listEl) return;

    if (!activities || activities.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-gray-500 py-4">No recent activity logged yet.</p>';
      return;
    }

    listEl.innerHTML = activities
      .map((item) => {
        const timeAgo = formatTime(item.created_at);
        return `
        <div class="flex items-start space-x-3 p-2.5 rounded-lg hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0">
          <div class="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            <i class="fa-solid fa-hospital-user"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-800">${escapeHtml(item.action)} <span class="text-slate-500 font-normal">by ${escapeHtml(item.username)}</span></p>
            <p class="text-xs text-slate-600 truncate">${escapeHtml(item.details || item.entity_type)}</p>
            <span class="text-[10px] text-slate-400">${timeAgo}</span>
          </div>
        </div>
      `;
      })
      .join('');
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
  }

  // ==========================================================================
  // 2. Patients Module
  // ==========================================================================
  async function loadPatients() {
    const search = document.getElementById('patientSearchInput')?.value || '';
    const gender = document.getElementById('patientGenderFilter')?.value || 'ALL';
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading patient records...</td></tr>';

    try {
      const res = await window.NovaCareApi.getPatients({ search, gender });
      state.patients = res.data.patients || [];
      renderPatientTable(state.patients);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error loading patients: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderPatientTable(patients) {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    if (patients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No matching patient records found.</td></tr>';
      return;
    }

    tbody.innerHTML = patients
      .map(
        (p) => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
        <td class="py-3 px-4 font-mono font-semibold text-sky-700">${escapeHtml(p.uhid)}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(p.gender)} (${calculateAge(p.date_of_birth)} yrs)</td>
        <td class="py-3 px-4 text-slate-600"><span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">${escapeHtml(p.blood_group)}</span></td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(p.phone)}</td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(p.allergies || 'None')}</td>
        <td class="py-3 px-4 text-right space-x-2">
          <button class="px-2.5 py-1 text-xs rounded bg-sky-100 text-sky-700 hover:bg-sky-200 transition" onclick="window.viewPatient(${p.id})">
            <i class="fa-solid fa-eye mr-1"></i>View
          </button>
          <button class="px-2.5 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200 transition" onclick="window.archivePatient(${p.id}, '${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}')">
            <i class="fa-solid fa-box-archive mr-1"></i>Archive
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  function calculateAge(dobStr) {
    if (!dobStr) return 'N/A';
    const dob = new Date(dobStr);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }

  async function handleRegisterPatient(e) {
    e.preventDefault();
    const payload = {
      first_name: document.getElementById('regFirstName').value.trim(),
      last_name: document.getElementById('regLastName').value.trim(),
      date_of_birth: document.getElementById('regDob').value,
      gender: document.getElementById('regGender').value,
      blood_group: document.getElementById('regBloodGroup').value,
      phone: document.getElementById('regPhone').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      address: document.getElementById('regAddress').value.trim(),
      city: document.getElementById('regCity').value.trim(),
      emergency_contact_name: document.getElementById('regEmergencyName').value.trim(),
      emergency_contact_phone: document.getElementById('regEmergencyPhone').value.trim(),
      medical_history: document.getElementById('regMedicalHistory').value.trim(),
      allergies: document.getElementById('regAllergies').value.trim(),
      insurance_provider: document.getElementById('regInsuranceProvider').value.trim(),
      insurance_policy_no: document.getElementById('regInsurancePolicy').value.trim()
    };

    try {
      const res = await window.NovaCareApi.createPatient(payload);
      showToast(`Patient registered! UHID: ${res.data.uhid}`, 'success');
      closeModal('registerPatientModal');
      document.getElementById('registerPatientForm').reset();
      loadPatients();
      populateModalDropdowns();
    } catch (err) {
      showToast(err.message || 'Error registering patient.', 'error');
    }
  }

  window.viewPatient = async function (id) {
    try {
      const res = await window.NovaCareApi.getPatient(id);
      const { patient, appointments, consultations, invoices } = res.data;

      document.getElementById('detailUhid').textContent = patient.uhid;
      document.getElementById('detailName').textContent = `${patient.first_name} ${patient.last_name}`;
      document.getElementById('detailDob').textContent = `${patient.date_of_birth} (${calculateAge(patient.date_of_birth)} yrs)`;
      document.getElementById('detailGender').textContent = patient.gender;
      document.getElementById('detailBloodGroup').textContent = patient.blood_group;
      document.getElementById('detailPhone').textContent = patient.phone;
      document.getElementById('detailEmail').textContent = patient.email || 'N/A';
      document.getElementById('detailAddress').textContent = `${patient.address || ''}, ${patient.city || ''}`;
      document.getElementById('detailEmergency').textContent = `${patient.emergency_contact_name} (${patient.emergency_contact_phone})`;
      document.getElementById('detailHistory').textContent = patient.medical_history || 'No prior medical conditions reported.';
      document.getElementById('detailAllergies').textContent = patient.allergies || 'No known allergies reported.';
      document.getElementById('detailInsurance').textContent = patient.insurance_provider ? `${patient.insurance_provider} (${patient.insurance_policy_no})` : 'Self-Pay / None';

      openModal('patientDetailsModal');
    } catch (err) {
      showToast('Error loading patient details: ' + err.message, 'error');
    }
  };

  window.archivePatient = async function (id, name) {
    if (!confirm(`Are you sure you want to archive patient ${name}? Medical and financial audit history will be safely preserved.`)) {
      return;
    }

    try {
      await window.NovaCareApi.deletePatient(id);
      showToast(`Patient ${name} archived safely.`, 'success');
      loadPatients();
    } catch (err) {
      showToast('Error archiving patient: ' + err.message, 'error');
    }
  };

  // ==========================================================================
  // 3. Appointments Module
  // ==========================================================================
  async function loadAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading appointment schedule...</td></tr>';

    try {
      const res = await window.NovaCareApi.getAppointments();
      state.appointments = res.data || [];
      renderAppointmentsTable(state.appointments);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error loading appointments: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderAppointmentsTable(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (appointments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No scheduled appointments found.</td></tr>';
      return;
    }

    tbody.innerHTML = appointments
      .map((a) => {
        const statusBadge =
          a.status === 'Completed'
            ? 'bg-emerald-100 text-emerald-800'
            : a.status === 'Cancelled'
            ? 'bg-rose-100 text-rose-800'
            : a.status === 'No-Show'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-sky-100 text-sky-800';

        return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
          <td class="py-3 px-4 font-mono font-semibold text-sky-700">${escapeHtml(a.appointment_no)}</td>
          <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(a.first_name)} ${escapeHtml(a.last_name)}</td>
          <td class="py-3 px-4 text-slate-700">Dr. ${escapeHtml(a.doctor_name)} <span class="text-xs text-slate-500">(${escapeHtml(a.department)})</span></td>
          <td class="py-3 px-4 text-slate-600">${escapeHtml(a.appointment_date)} <span class="text-xs font-mono">(${a.start_time.slice(0, 5)} - ${a.end_time.slice(0, 5)})</span></td>
          <td class="py-3 px-4 text-slate-600 truncate max-w-xs">${escapeHtml(a.reason)}</td>
          <td class="py-3 px-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge}">${escapeHtml(a.status)}</span></td>
          <td class="py-3 px-4 text-right space-x-1">
            ${
              a.status === 'Scheduled'
                ? `
                <button class="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Mark Completed" onclick="window.updateApptStatus(${a.id}, 'Completed')">
                  <i class="fa-solid fa-check"></i>
                </button>
                <button class="px-2 py-1 text-xs rounded bg-rose-100 text-rose-700 hover:bg-rose-200" title="Cancel Appointment" onclick="window.cancelApptModal(${a.id})">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              `
                : ''
            }
          </td>
        </tr>
      `;
      })
      .join('');
  }

  async function handleBookAppointment(e) {
    e.preventDefault();
    const payload = {
      patient_id: parseInt(document.getElementById('apptPatientSelect').value, 10),
      doctor_id: parseInt(document.getElementById('apptDoctorSelect').value, 10),
      appointment_date: document.getElementById('apptDate').value,
      start_time: document.getElementById('apptStart').value,
      end_time: document.getElementById('apptEnd').value,
      reason: document.getElementById('apptReason').value.trim()
    };

    try {
      const res = await window.NovaCareApi.createAppointment(payload);
      showToast(`Appointment booked successfully! Ref: ${res.data.appointment_no}`, 'success');
      closeModal('bookAppointmentModal');
      document.getElementById('bookAppointmentForm').reset();
      loadAppointments();
    } catch (err) {
      // Highlights conflict validation directly
      if (err.status === 409) {
        showToast(`⚠️ Schedule Conflict: ${err.message}`, 'error', 6000);
      } else {
        showToast(err.message || 'Error booking appointment.', 'error');
      }
    }
  }

  window.updateApptStatus = async function (id, status) {
    try {
      await window.NovaCareApi.updateAppointmentStatus(id, status);
      showToast(`Appointment marked as ${status}.`, 'success');
      loadAppointments();
    } catch (err) {
      showToast('Error updating status: ' + err.message, 'error');
    }
  };

  window.cancelApptModal = async function (id) {
    const reason = prompt('Please enter cancellation reason for the audit trail:');
    if (reason === null) return;

    try {
      await window.NovaCareApi.updateAppointmentStatus(id, 'Cancelled', reason);
      showToast('Appointment successfully cancelled.', 'info');
      loadAppointments();
    } catch (err) {
      showToast('Error cancelling appointment: ' + err.message, 'error');
    }
  };

  function populateWardDropdown() {
    const sel = document.getElementById('bedWardSelect');
    if (!sel || !state.wards || state.wards.length === 0) return;
    sel.innerHTML = '<option value="">-- Select Inpatient Ward --</option>' +
      state.wards
        .map((w) => `<option value="${w.id}">${escapeHtml(w.ward_name)} (${escapeHtml(w.ward_type)}) - $${parseFloat(w.daily_charge).toFixed(2)}/day</option>`)
        .join('');
  }

  // Populate Doctor, Patient and Ward Selects for Modals
  async function populateModalDropdowns() {
    const token = window.NovaCareApi.getToken();
    if (!token) return;

    try {
      const [patientsRes, doctorsRes, bedsRes] = await Promise.all([
        window.NovaCareApi.getPatients({ limit: 100 }),
        window.NovaCareApi.getDoctors(),
        window.NovaCareApi.getBeds().catch(() => ({ data: { wards: [], beds: [] } }))
      ]);

      if (bedsRes?.data?.wards) {
        state.wards = bedsRes.data.wards;
        populateWardDropdown();
      }

      // Patients dropdowns
      const patientSelects = [
        document.getElementById('apptPatientSelect'),
        document.getElementById('emrPatientSelect'),
        document.getElementById('bedPatientSelect'),
        document.getElementById('invoicePatientSelect')
      ];

      patientSelects.forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Patient --</option>' +
          patientsRes.data.patients
            .map((p) => `<option value="${p.id}">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)} (${p.uhid})</option>`)
            .join('');
      });

      // Doctors dropdowns
      const doctorSelects = [
        document.getElementById('apptDoctorSelect'),
        document.getElementById('emrDoctorSelect')
      ];

      doctorSelects.forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Doctor --</option>' +
          doctorsRes.data
            .map((d) => `<option value="${d.id}">Dr. ${escapeHtml(d.full_name)} (${escapeHtml(d.specialization)})</option>`)
            .join('');
      });
    } catch (e) {
      console.warn('Could not populate modal dropdowns:', e);
    }
  }

  // ==========================================================================
  // 4. Doctors Module
  // ==========================================================================
  async function loadDoctors() {
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-3 text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading medical staff directory...</div>';

    try {
      const res = await window.NovaCareApi.getDoctors();
      state.doctors = res.data || [];
      renderDoctorsGrid(state.doctors);
    } catch (err) {
      grid.innerHTML = `<div class="col-span-3 text-center py-6 text-rose-500">Error loading doctors: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderDoctorsGrid(doctors) {
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    if (doctors.length === 0) {
      grid.innerHTML = '<div class="col-span-3 text-center py-8 text-gray-500">No doctors found in directory.</div>';
      return;
    }

    grid.innerHTML = doctors
      .map(
        (d) => `
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg">
              ${d.full_name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 class="font-semibold text-slate-800">${escapeHtml(d.full_name)}</h4>
              <p class="text-xs text-sky-600 font-medium">${escapeHtml(d.specialization)}</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-xs font-semibold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${escapeHtml(d.status)}
          </span>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
          <div class="flex justify-between">
            <span class="text-slate-400">Department:</span>
            <span class="font-medium text-slate-700">${escapeHtml(d.department)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Consultation Fee:</span>
            <span class="font-bold text-emerald-600">$${parseFloat(d.consultation_fee).toFixed(2)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">OPD Room:</span>
            <span class="font-medium text-slate-700">${escapeHtml(d.room_no)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Availability:</span>
            <span class="font-medium text-slate-700 truncate max-w-[150px]">${escapeHtml(d.available_days)}</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  }

  async function handleAddDoctor(e) {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById('docFullName').value.trim(),
      specialization: document.getElementById('docSpecialization').value.trim(),
      department: document.getElementById('docDepartment').value,
      qualification: document.getElementById('docQualification').value.trim(),
      consultation_fee: parseFloat(document.getElementById('docFee').value || 100),
      room_no: document.getElementById('docRoom').value.trim(),
      phone: document.getElementById('docPhone').value.trim(),
      email: document.getElementById('docEmail').value.trim(),
      available_days: document.getElementById('docDays').value.trim(),
      start_time: document.getElementById('docStartTime').value,
      end_time: document.getElementById('docEndTime').value
    };

    try {
      const res = await window.NovaCareApi.createDoctor(payload);
      showToast(`Doctor profile created: ${res.data.full_name} (${res.data.doctor_code})`, 'success');
      closeModal('addDoctorModal');
      document.getElementById('addDoctorForm').reset();
      loadDoctors();
      populateModalDropdowns();
    } catch (err) {
      showToast(err.message || 'Error creating doctor profile.', 'error');
    }
  }

  // ==========================================================================
  // 5. Clinical / EMR Module
  // ==========================================================================
  async function loadConsultations() {
    const tbody = document.getElementById('emrTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading clinical records...</td></tr>';

    try {
      const res = await window.NovaCareApi.getConsultations();
      renderConsultationsTable(res.data || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-500">Error loading clinical records: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderConsultationsTable(records) {
    const tbody = document.getElementById('emrTableBody');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No clinical consultation notes recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = records
      .map(
        (c) => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
        <td class="py-3 px-4 font-mono font-semibold text-sky-700">${escapeHtml(c.consultation_no)}</td>
        <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}</td>
        <td class="py-3 px-4 text-slate-700">Dr. ${escapeHtml(c.doctor_name)}</td>
        <td class="py-3 px-4 text-slate-600">${escapeHtml(c.diagnosis)}</td>
        <td class="py-3 px-4 text-xs font-mono text-slate-500">BP: ${escapeHtml(c.vitals_bp || 'N/A')} | Pulse: ${c.vitals_pulse || 'N/A'} | SpO2: ${c.vitals_spo2 ? c.vitals_spo2 + '%' : 'N/A'}</td>
        <td class="py-3 px-4 text-slate-500 text-xs">${formatTime(c.consultation_date)}</td>
      </tr>
    `
      )
      .join('');
  }

  async function handleCreateConsultation(e) {
    e.preventDefault();
    const payload = {
      patient_id: parseInt(document.getElementById('emrPatientSelect').value, 10),
      doctor_id: parseInt(document.getElementById('emrDoctorSelect').value, 10),
      symptoms: document.getElementById('emrSymptoms').value.trim(),
      diagnosis: document.getElementById('emrDiagnosis').value.trim(),
      vitals_bp: document.getElementById('emrBp').value.trim(),
      vitals_pulse: document.getElementById('emrPulse').value,
      vitals_temp: document.getElementById('emrTemp').value,
      vitals_spo2: document.getElementById('emrSpo2').value,
      clinical_notes: document.getElementById('emrNotes').value.trim(),
      prescriptions: [
        {
          medicine_name: document.getElementById('rxMedicineName').value.trim(),
          dosage: document.getElementById('rxDosage').value.trim(),
          frequency: document.getElementById('rxFrequency').value,
          duration_days: parseInt(document.getElementById('rxDuration').value || 5, 10),
          instructions: document.getElementById('rxInstructions').value.trim()
        }
      ]
    };

    try {
      const res = await window.NovaCareApi.createConsultation(payload);
      showToast(`Consultation record saved: ${res.data.consultation_no}`, 'success');
      closeModal('newConsultationModal');
      document.getElementById('newConsultationForm').reset();
      loadConsultations();
    } catch (err) {
      showToast(err.message || 'Error recording consultation.', 'error');
    }
  }

  // ==========================================================================
  // 6. Wards & Bed Management Module
  // ==========================================================================
  async function loadBeds() {
    const grid = document.getElementById('bedsGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-4 text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading inpatient beds...</div>';

    try {
      const res = await window.NovaCareApi.getBeds();
      state.wards = res.data.wards || [];
      state.beds = res.data.beds || [];
      populateWardDropdown();
      renderBedsGrid(state.beds);
    } catch (err) {
      grid.innerHTML = `<div class="col-span-4 text-center py-6 text-rose-500">Error loading beds: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderBedsGrid(beds) {
    const grid = document.getElementById('bedsGrid');
    if (!grid) return;

    if (beds.length === 0) {
      grid.innerHTML = '<div class="col-span-4 text-center py-8 text-gray-500">No beds configured.</div>';
      return;
    }

    grid.innerHTML = beds
      .map((b) => {
        const isOccupied = b.status === 'Occupied';
        const isMaintenance = b.status === 'Maintenance';
        const statusColor = isOccupied
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : isMaintenance
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-emerald-50 border-emerald-300 text-emerald-900';

        return `
        <div class="bed-card rounded-xl border p-4 shadow-sm flex flex-col justify-between ${statusColor}">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-base tracking-wide">${escapeHtml(b.bed_number)}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${
                isOccupied ? 'bg-rose-200 text-rose-800' : isMaintenance ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
              }">${escapeHtml(b.status)}</span>
            </div>
            <p class="text-xs text-slate-600 font-medium">${escapeHtml(b.ward_name)}</p>
            <p class="text-[11px] text-slate-500 mt-1">Rate: $${parseFloat(b.daily_charge).toFixed(2)}/day</p>

            ${
              isOccupied
                ? `
              <div class="mt-3 pt-2 border-t border-rose-200 text-xs">
                <p class="font-semibold text-rose-800 truncate"><i class="fa-solid fa-user-injured mr-1"></i>${escapeHtml(b.first_name)} ${escapeHtml(b.last_name)}</p>
                <p class="text-[11px] text-rose-600 font-mono">UHID: ${escapeHtml(b.uhid)}</p>
              </div>
            `
                : ''
            }
          </div>

          <div class="mt-4 pt-2">
            ${
              b.status === 'Available'
                ? `
              <button class="w-full py-1.5 px-3 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition" onclick="window.openAdmitModal(${b.id}, '${escapeHtml(b.bed_number)}')">
                <i class="fa-solid fa-bed mr-1"></i>Admit Patient
              </button>
            `
                : isOccupied
                ? `
              <button class="w-full py-1.5 px-3 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition" onclick="window.dischargeBed(${b.id}, '${escapeHtml(b.bed_number)}')">
                <i class="fa-solid fa-person-walking-arrow-right mr-1"></i>Discharge
              </button>
            `
                : `
              <span class="block text-center text-xs text-amber-700 py-1">In Maintenance</span>
            `
            }
          </div>
        </div>
      `;
      })
      .join('');
  }

  window.openAdmitModal = function (bedId, bedNo) {
    document.getElementById('admitBedId').value = bedId;
    document.getElementById('admitBedNumber').textContent = bedNo;
    openModal('admitPatientModal');
  };

  async function handleAdmitPatient(e) {
    e.preventDefault();
    const bedId = parseInt(document.getElementById('admitBedId').value, 10);
    const patientId = parseInt(document.getElementById('bedPatientSelect').value, 10);

    if (!patientId) {
      showToast('Please select a patient to admit.', 'warning');
      return;
    }

    try {
      await window.NovaCareApi.admitPatient(bedId, patientId);
      showToast('Patient successfully admitted to bed.', 'success');
      closeModal('admitPatientModal');
      loadBeds();
    } catch (err) {
      showToast(err.message || 'Error admitting patient.', 'error');
    }
  }

  window.dischargeBed = async function (bedId, bedNo) {
    const summary = prompt(`Confirm discharge for bed ${bedNo}. Enter summary notes:`, 'Discharged in stable clinical condition.');
    if (summary === null) return;

    try {
      await window.NovaCareApi.dischargePatient(bedId, summary);
      showToast(`Bed ${bedNo} successfully discharged and available.`, 'success');
      loadBeds();
    } catch (err) {
      showToast(err.message || 'Error discharging bed.', 'error');
    }
  };

  async function handleAddBed(e) {
    e.preventDefault();
    const wardId = parseInt(document.getElementById('bedWardSelect').value, 10);
    const bedNumber = document.getElementById('bedNumberInput').value.trim();

    if (!wardId || !bedNumber) {
      showToast('Please select a ward and enter a valid bed number.', 'warning');
      return;
    }

    try {
      const res = await window.NovaCareApi.createBed({ ward_id: wardId, bed_number: bedNumber });
      showToast(res.message || `Bed ${bedNumber} created successfully!`, 'success');
      closeModal('addBedModal');
      document.getElementById('addBedForm').reset();
      loadBeds();
    } catch (err) {
      showToast(err.message || 'Error creating bed.', 'error');
    }
  }

  // ==========================================================================
  // 7. Pharmacy & Inventory Module
  // ==========================================================================
  async function loadPharmacy() {
    const tbody = document.getElementById('pharmacyTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading pharmacy inventory...</td></tr>';

    try {
      const res = await window.NovaCareApi.getMedicines();
      state.medicines = res.data || [];
      renderPharmacyTable(state.medicines);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error loading pharmacy: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderPharmacyTable(medicines) {
    const tbody = document.getElementById('pharmacyTableBody');
    if (!tbody) return;

    if (medicines.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No medicines in inventory.</td></tr>';
      return;
    }

    tbody.innerHTML = medicines
      .map((m) => {
        const badge =
          m.status === 'Available'
            ? 'bg-emerald-100 text-emerald-800'
            : m.status === 'Low Stock'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-rose-100 text-rose-800';

        return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
          <td class="py-3 px-4 font-mono font-semibold text-sky-700">${escapeHtml(m.code)}</td>
          <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(m.brand_name)}</td>
          <td class="py-3 px-4 text-slate-600 italic text-xs">${escapeHtml(m.generic_name)}</td>
          <td class="py-3 px-4 text-slate-600">${escapeHtml(m.category)} (${escapeHtml(m.dosage_form)})</td>
          <td class="py-3 px-4 font-bold text-slate-800">$${parseFloat(m.unit_price).toFixed(2)}</td>
          <td class="py-3 px-4">
            <span class="font-semibold text-slate-800">${m.stock_quantity}</span>
            <span class="text-xs text-slate-400"> (Min: ${m.reorder_level})</span>
          </td>
          <td class="py-3 px-4"><span class="px-2.5 py-0.5 rounded text-xs font-semibold ${badge}">${escapeHtml(m.status)}</span></td>
        </tr>
      `;
      })
      .join('');
  }

  async function handleAddMedicine(e) {
    e.preventDefault();
    const payload = {
      brand_name: document.getElementById('medBrandName').value.trim(),
      generic_name: document.getElementById('medGenericName').value.trim(),
      category: document.getElementById('medCategory').value.trim(),
      dosage_form: document.getElementById('medDosageForm').value.trim(),
      unit_price: parseFloat(document.getElementById('medUnitPrice').value),
      stock_quantity: parseInt(document.getElementById('medStockQty').value, 10),
      reorder_level: parseInt(document.getElementById('medReorderLevel').value, 10),
      expiry_date: document.getElementById('medExpiryDate').value,
      manufacturer: document.getElementById('medManufacturer').value.trim()
    };

    try {
      const res = await window.NovaCareApi.createMedicine(payload);
      showToast(`Medicine ${payload.brand_name} added to catalog!`, 'success');
      closeModal('addMedicineModal');
      document.getElementById('addMedicineForm').reset();
      loadPharmacy();
    } catch (err) {
      showToast(err.message || 'Error adding medicine.', 'error');
    }
  }

  // ==========================================================================
  // 8. Billing & Invoicing Module
  // ==========================================================================
  async function loadBilling() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading invoices & billing ledger...</td></tr>';

    try {
      const res = await window.NovaCareApi.getInvoices();
      state.invoices = res.data || [];
      renderInvoicesTable(state.invoices);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error loading billing: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderInvoicesTable(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    if (invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No invoices generated yet.</td></tr>';
      return;
    }

    tbody.innerHTML = invoices
      .map((inv) => {
        const badge =
          inv.payment_status === 'Paid'
            ? 'bg-emerald-100 text-emerald-800'
            : inv.payment_status === 'Partial'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-rose-100 text-rose-800';

        return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
          <td class="py-3 px-4 font-mono font-semibold text-sky-700">${escapeHtml(inv.invoice_no)}</td>
          <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(inv.first_name)} ${escapeHtml(inv.last_name)}</td>
          <td class="py-3 px-4 font-bold text-slate-800">$${parseFloat(inv.net_payable).toFixed(2)}</td>
          <td class="py-3 px-4 text-emerald-600 font-semibold">$${parseFloat(inv.paid_amount).toFixed(2)}</td>
          <td class="py-3 px-4 font-bold ${parseFloat(inv.balance_due) > 0 ? 'text-rose-600' : 'text-slate-400'}">$${parseFloat(inv.balance_due).toFixed(2)}</td>
          <td class="py-3 px-4"><span class="px-2.5 py-0.5 rounded text-xs font-semibold ${badge}">${escapeHtml(inv.payment_status)}</span></td>
          <td class="py-3 px-4 text-right space-x-1">
            <button class="px-2.5 py-1 text-xs rounded bg-sky-100 text-sky-700 hover:bg-sky-200" onclick="window.viewInvoiceReceipt(${inv.id})">
              <i class="fa-solid fa-receipt mr-1"></i>Receipt
            </button>
            ${
              inv.payment_status !== 'Paid'
                ? `
              <button class="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold" onclick="window.openPaymentModal(${inv.id}, '${escapeHtml(inv.invoice_no)}', ${inv.balance_due})">
                <i class="fa-solid fa-dollar-sign mr-1"></i>Pay
              </button>
            `
                : ''
            }
          </td>
        </tr>
      `;
      })
      .join('');
  }

  async function handleCreateInvoice(e) {
    e.preventDefault();
    const patient_id = parseInt(document.getElementById('invoicePatientSelect').value, 10);
    const itemName = document.getElementById('invItemName').value.trim();
    const itemType = document.getElementById('invItemType').value;
    const unitPrice = parseFloat(document.getElementById('invItemPrice').value);
    const quantity = parseInt(document.getElementById('invItemQty').value, 10);
    const discount = parseFloat(document.getElementById('invDiscount').value || 0);

    const payload = {
      patient_id,
      discount_amount: discount,
      tax_amount: (unitPrice * quantity - discount) * 0.05, // 5% standard tax
      items: [
        {
          item_name: itemName,
          item_type: itemType,
          unit_price: unitPrice,
          quantity: quantity
        }
      ]
    };

    try {
      const res = await window.NovaCareApi.createInvoice(payload);
      showToast(`Invoice generated: ${res.data.invoice_no}`, 'success');
      closeModal('createInvoiceModal');
      document.getElementById('createInvoiceForm').reset();
      loadBilling();
    } catch (err) {
      showToast(err.message || 'Error generating invoice.', 'error');
    }
  }

  window.openPaymentModal = function (invoiceId, invoiceNo, balanceDue) {
    document.getElementById('payInvoiceId').value = invoiceId;
    document.getElementById('payInvoiceNo').textContent = invoiceNo;
    document.getElementById('payBalanceDue').textContent = `$${parseFloat(balanceDue).toFixed(2)}`;
    document.getElementById('payAmount').value = parseFloat(balanceDue).toFixed(2);
    openModal('recordPaymentModal');
  };

  async function handleRecordPayment(e) {
    e.preventDefault();
    const invoiceId = parseInt(document.getElementById('payInvoiceId').value, 10);
    const amount = parseFloat(document.getElementById('payAmount').value);
    const paymentMethod = document.getElementById('payMethod').value;
    const notes = document.getElementById('payNotes').value.trim();

    try {
      const res = await window.NovaCareApi.recordPayment({
        invoice_id: invoiceId,
        amount,
        payment_method: paymentMethod,
        notes
      });

      showToast(res.message, 'success');
      closeModal('recordPaymentModal');
      document.getElementById('recordPaymentForm').reset();
      loadBilling();
    } catch (err) {
      showToast(err.message || 'Error recording payment.', 'error');
    }
  }

  window.viewInvoiceReceipt = async function (id) {
    try {
      const res = await window.NovaCareApi.getInvoice(id);
      const { invoice, items, payments } = res.data;

      document.getElementById('rcptInvoiceNo').textContent = invoice.invoice_no;
      document.getElementById('rcptDate').textContent = invoice.invoice_date;
      document.getElementById('rcptPatientName').textContent = `${invoice.first_name} ${invoice.last_name}`;
      document.getElementById('rcptPatientUhid').textContent = invoice.uhid;
      document.getElementById('rcptTotal').textContent = `$${parseFloat(invoice.net_payable).toFixed(2)}`;
      document.getElementById('rcptPaid').textContent = `$${parseFloat(invoice.paid_amount).toFixed(2)}`;
      document.getElementById('rcptBalance').textContent = `$${parseFloat(invoice.balance_due).toFixed(2)}`;
      document.getElementById('rcptStatus').textContent = invoice.payment_status;

      const itemsBody = document.getElementById('rcptItemsBody');
      itemsBody.innerHTML = items
        .map(
          (itm) => `
        <tr class="border-b border-slate-100">
          <td class="py-2 text-slate-800 font-medium">${escapeHtml(itm.item_name)} <span class="text-xs text-slate-500">(${itm.item_type})</span></td>
          <td class="py-2 text-center text-slate-600">${itm.quantity}</td>
          <td class="py-2 text-right text-slate-600">$${parseFloat(itm.unit_price).toFixed(2)}</td>
          <td class="py-2 text-right font-bold text-slate-800">$${parseFloat(itm.total_price).toFixed(2)}</td>
        </tr>
      `
        )
        .join('');

      openModal('printableReceiptModal');
    } catch (err) {
      showToast('Error loading receipt: ' + err.message, 'error');
    }
  };

  // ==========================================================================
  // 9. Health & System Diagnostics Module
  // ==========================================================================
  async function loadDiagnostics() {
    const diagBox = document.getElementById('diagnosticsOutput');
    const badge = document.getElementById('healthStatusBadge');
    if (!diagBox) return;

    diagBox.textContent = 'Pinging /api/health endpoint...';

    try {
      const res = await window.NovaCareApi.getHealth();
      diagBox.textContent = JSON.stringify(res, null, 2);

      if (badge) {
        badge.textContent = res.status.toUpperCase();
        badge.className = `px-3 py-1 rounded-full text-xs font-bold ${
          res.status === 'healthy' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }`;
      }

      document.getElementById('diagDbStatus').textContent = `${res.dependencies.database.status} (${res.dependencies.database.engine})`;
      document.getElementById('diagLatency').textContent = `${res.dependencies.database.latencyMs} ms`;
      document.getElementById('diagUptime').textContent = res.uptime;
      document.getElementById('diagMemory').textContent = `${res.system.memoryUsedMB} MB / ${res.system.memoryTotalMB} MB`;
    } catch (err) {
      diagBox.textContent = 'Health check failed: ' + err.message;
      if (badge) {
        badge.textContent = 'DEGRADED';
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800';
      }
    }
  }

  // ==========================================================================
  // Event Bindings and Initialization
  // ==========================================================================
  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  onReady(() => {
    // Navigation links
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const mod = link.dataset.module;
        if (mod) switchModule(mod);
      });
    });

    // Form Submissions
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('registerPatientForm')?.addEventListener('submit', handleRegisterPatient);
    document.getElementById('addDoctorForm')?.addEventListener('submit', handleAddDoctor);
    document.getElementById('addBedForm')?.addEventListener('submit', handleAddBed);
    document.getElementById('bookAppointmentForm')?.addEventListener('submit', handleBookAppointment);
    document.getElementById('newConsultationForm')?.addEventListener('submit', handleCreateConsultation);
    document.getElementById('admitPatientForm')?.addEventListener('submit', handleAdmitPatient);
    document.getElementById('addMedicineForm')?.addEventListener('submit', handleAddMedicine);
    document.getElementById('createInvoiceForm')?.addEventListener('submit', handleCreateInvoice);
    document.getElementById('recordPaymentForm')?.addEventListener('submit', handleRecordPayment);

    // Patient search debounce
    let searchDebounce = null;
    document.getElementById('patientSearchInput')?.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadPatients, 300);
    });
    document.getElementById('patientGenderFilter')?.addEventListener('change', loadPatients);

    // Refresh buttons
    document.getElementById('refreshDiagnosticsBtn')?.addEventListener('click', loadDiagnostics);

    // Modal Open & Close Buttons
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.openModal;
        openModal(modalId);
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        closeModal(modalId);
      });
    });

    // Unauthorized event listener
    window.addEventListener('novacare:unauthorized', () => {
      showToast('Session expired or unauthorized. Please sign in.', 'warning');
      openModal('loginModal');
    });

    // Start App
    initAuth();
    populateModalDropdowns();
  });

  // Global export
  window.NovaCareApp = {
    showToast,
    openModal,
    closeModal,
    switchModule
  };
})();

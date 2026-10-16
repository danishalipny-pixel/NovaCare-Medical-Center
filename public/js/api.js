/**
 * NovaCare Hospital Management System - Centralized API Client
 * Manages HTTP communication with the Node.js/Express backend, JWT tokens, and errors.
 */

(function (window) {
  'use strict';

  const TOKEN_KEY = 'novacare_auth_token';
  const USER_KEY = 'novacare_user_info';

  const ApiClient = {
    /**
     * Auth Token Management
     */
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    },

    setToken: function (token, remember = true) {
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
      }
    },

    getUser: function () {
      const userStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      try {
        return userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        return null;
      }
    },

    setUser: function (user, remember = true) {
      const userStr = JSON.stringify(user);
      if (remember) {
        localStorage.setItem(USER_KEY, userStr);
      } else {
        sessionStorage.setItem(USER_KEY, userStr);
      }
    },

    clearAuth: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    },

    isAuthenticated: function () {
      return !!this.getToken();
    },

    /**
     * Core Fetch Request Wrapper
     */
    request: async function (endpoint, options = {}) {
      const url = window.NovaCareConfig.getApiUrl(endpoint);
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      };

      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOptions = {
        method: options.method || 'GET',
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      };

      try {
        const response = await fetch(url, fetchOptions);
        const data = await response.json().catch(() => ({
          success: false,
          message: `Server returned invalid JSON (Status: ${response.status})`
        }));

        if (!response.ok) {
          // If session expired or unauthorized on protected routes
          if (response.status === 401 && !endpoint.includes('/auth/login')) {
            this.clearAuth();
            window.dispatchEvent(new CustomEvent('novacare:unauthorized'));
          }

          const error = new Error(data.message || `Request failed with status ${response.status}`);
          error.status = response.status;
          error.errors = data.errors || null;
          error.data = data;
          throw error;
        }

        return data;
      } catch (err) {
        console.error(`[API Error] [${fetchOptions.method} ${endpoint}]:`, err.message);
        throw err;
      }
    },

    // ----------------------------------------------------
    // Authentication Endpoints
    // ----------------------------------------------------
    login: async function (username, password, remember = true) {
      const res = await this.request('/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      if (res.data?.token) {
        this.setToken(res.data.token, remember);
        this.setUser(res.data.user, remember);
      }
      return res;
    },

    logout: async function () {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Continue clearing local state regardless
      }
      this.clearAuth();
    },

    getCurrentUser: function () {
      return this.request('/auth/me');
    },

    // ----------------------------------------------------
    // Health & Diagnostics
    // ----------------------------------------------------
    getHealth: function () {
      return this.request('/health');
    },

    // ----------------------------------------------------
    // Dashboard Endpoints
    // ----------------------------------------------------
    getDashboardStats: function () {
      return this.request('/dashboard/stats');
    },

    getDashboardCharts: function () {
      return this.request('/dashboard/charts');
    },

    getRecentActivity: function () {
      return this.request('/dashboard/recent-activity');
    },

    // ----------------------------------------------------
    // Patient Endpoints
    // ----------------------------------------------------
    getPatients: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/patients${qs ? `?${qs}` : ''}`);
    },

    getPatient: function (id) {
      return this.request(`/patients/${id}`);
    },

    createPatient: function (patientData) {
      return this.request('/patients', {
        method: 'POST',
        body: patientData
      });
    },

    updatePatient: function (id, patientData) {
      return this.request(`/patients/${id}`, {
        method: 'PUT',
        body: patientData
      });
    },

    deletePatient: function (id) {
      return this.request(`/patients/${id}`, {
        method: 'DELETE'
      });
    },

    // ----------------------------------------------------
    // Doctor Endpoints
    // ----------------------------------------------------
    getDoctors: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/doctors${qs ? `?${qs}` : ''}`);
    },

    getDoctor: function (id) {
      return this.request(`/doctors/${id}`);
    },

    createDoctor: function (doctorData) {
      return this.request('/doctors', {
        method: 'POST',
        body: doctorData
      });
    },

    // ----------------------------------------------------
    // Appointment Endpoints
    // ----------------------------------------------------
    getAppointments: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/appointments${qs ? `?${qs}` : ''}`);
    },

    createAppointment: function (apptData) {
      return this.request('/appointments', {
        method: 'POST',
        body: apptData
      });
    },

    updateAppointmentStatus: function (id, status, cancellation_reason = null) {
      return this.request(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: { status, cancellation_reason }
      });
    },

    // ----------------------------------------------------
    // Clinical & EMR Endpoints
    // ----------------------------------------------------
    getConsultations: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/consultations${qs ? `?${qs}` : ''}`);
    },

    createConsultation: function (data) {
      return this.request('/consultations', {
        method: 'POST',
        body: data
      });
    },

    // ----------------------------------------------------
    // Wards & Bed Management Endpoints
    // ----------------------------------------------------
    getBeds: function () {
      return this.request('/beds');
    },

    admitPatient: function (bed_id, patient_id) {
      return this.request('/beds/admit', {
        method: 'POST',
        body: { bed_id, patient_id }
      });
    },

    dischargePatient: function (bed_id, discharge_summary) {
      return this.request('/beds/discharge', {
        method: 'POST',
        body: { bed_id, discharge_summary }
      });
    },

    createBed: function (bedData) {
      return this.request('/beds', {
        method: 'POST',
        body: bedData
      });
    },

    // ----------------------------------------------------
    // Pharmacy Endpoints
    // ----------------------------------------------------
    getMedicines: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/pharmacy/medicines${qs ? `?${qs}` : ''}`);
    },

    createMedicine: function (medData) {
      return this.request('/pharmacy/medicines', {
        method: 'POST',
        body: medData
      });
    },

    dispenseMedicine: function (data) {
      return this.request('/pharmacy/dispense', {
        method: 'POST',
        body: data
      });
    },

    // ----------------------------------------------------
    // Billing & Invoicing Endpoints
    // ----------------------------------------------------
    getInvoices: function (params = {}) {
      const qs = new URLSearchParams(params).toString();
      return this.request(`/billing/invoices${qs ? `?${qs}` : ''}`);
    },

    getInvoice: function (id) {
      return this.request(`/billing/invoices/${id}`);
    },

    createInvoice: function (invoiceData) {
      return this.request('/billing/invoices', {
        method: 'POST',
        body: invoiceData
      });
    },

    recordPayment: function (paymentData) {
      return this.request('/billing/payments', {
        method: 'POST',
        body: paymentData
      });
    }
  };

  window.NovaCareApi = ApiClient;
})(window);

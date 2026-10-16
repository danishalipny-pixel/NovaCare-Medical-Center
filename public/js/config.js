/**
 * NovaCare Hospital Management System - Runtime Configuration
 * Dynamically resolves the API Base URL based on deployment context.
 *
 * NOTE: Production frontend uses relative API paths when served from the same host,
 * or reads window.__APP_CONFIG__.API_BASE_URL if deployed to a decoupled CDN (e.g. Vercel/Netlify).
 * NEVER hardcodes http://localhost or http://127.0.0.1.
 */

(function (window) {
  'use strict';

  // Allow build-time or runtime injection via window.__APP_CONFIG__
  const envConfig = window.__APP_CONFIG__ || {};

  /**
   * Determine the API base URL safely across local and production environments
   */
  function resolveApiBaseUrl() {
    // 1. Explicitly configured custom API host (e.g. https://api.novacare.example.com)
    if (envConfig.API_BASE_URL && typeof envConfig.API_BASE_URL === 'string') {
      return envConfig.API_BASE_URL.replace(/\/+$/, '');
    }

    // 2. Default: Relative API route '/api' when served by the Express backend
    // This automatically works across any domain or HTTPS port without configuration
    return '/api';
  }

  window.NovaCareConfig = {
    API_BASE_URL: resolveApiBaseUrl(),
    APP_NAME: 'NovaCare Hospital Management System',
    VERSION: '1.0.0',
    CURRENCY_SYMBOL: '$',
    getApiUrl: function (endpoint) {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return `${this.API_BASE_URL}${cleanEndpoint}`;
    }
  };

  console.log(`[NovaCare Config] Loaded API Base: ${window.NovaCareConfig.API_BASE_URL}`);
})(window);

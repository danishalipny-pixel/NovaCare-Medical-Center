/**
 * NovaCare Hospital Management System - Request Validation Helper
 */

/**
 * Validates request body against required fields and optional custom rules
 * @param {Array<string>} requiredFields 
 * @param {Object} customRules Map of field to validator function returning string error or null
 */
function validateBody(requiredFields = [], customRules = {}) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    // Check required fields
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || String(body[field]).trim() === '') {
        errors.push({ field, message: `Field '${field}' is required.` });
      }
    }

    // Check custom rules
    for (const [field, validator] of Object.entries(customRules)) {
      if (body[field] !== undefined && body[field] !== null) {
        const errorMsg = validator(body[field], body);
        if (errorMsg) {
          errors.push({ field, message: errorMsg });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted errors.',
        errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = {
  validateBody
};

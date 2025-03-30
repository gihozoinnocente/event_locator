const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => {
      // Use i18n to translate validation messages
      const message = error.msg.includes('validation.')
        ? req.t(error.msg, { field: error.param })
        : error.msg;
      
      return {
        field: error.param,
        message
      };
    });
    
    return res.status(400).json({ errors: validationErrors });
  }
  
  next();
};

module.exports = validationMiddleware;
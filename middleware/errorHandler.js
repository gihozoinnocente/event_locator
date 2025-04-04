// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    // Check for specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: req.t('common:validationError'),
        errors: err.errors
      });
    }
    
    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        message: req.t('auth:unauthorized')
      });
    }
    
    // Database unique constraint error
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        message: req.t('common:duplicateEntry')
      });
    }
    
    // Default to 500 server error
    res.status(500).json({
      success: false,
      message: req.t('common:serverError')
    });
  };
  
  module.exports = errorHandler;
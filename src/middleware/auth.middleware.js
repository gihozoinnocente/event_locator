const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: req.t('auth.token_required') });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const { rows } = await db.query('SELECT id, username, email, preferred_language FROM users WHERE id = $1', [decoded.userId]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: req.t('auth.invalid_token') });
    }
    
    // Attach user to request
    req.user = rows[0];
    
    // Set user's preferred language for i18n
    if (req.user.preferred_language) {
      req.language = req.user.preferred_language;
    }
    
    next();
  } catch (error) {
    return res.status(403).json({ message: req.t('auth.invalid_token') });
  }
};

/**
 * Helper function to check if a user is authorized to modify a resource
 * @param {number} resourceUserId - User ID of the resource owner
 * @param {number} requestUserId - User ID making the request
 * @returns {boolean} - Whether the user is authorized
 */
const isAuthorized = (resourceUserId, requestUserId) => {
  return resourceUserId === requestUserId;
};

module.exports = {
  authenticateToken,
  isAuthorized
};
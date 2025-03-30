const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    const { username, email, password, latitude, longitude, preferredLanguage } = req.body;
    
    // Check if username or email already exists
    const { rows: existingRows } = await db.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingRows.length > 0) {
      const existingUser = existingRows[0];
      if (existingUser.username === username) {
        return res.status(400).json({ message: req.t('auth.user_exists') });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ message: req.t('auth.email_exists') });
      }
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate location if provided
    let locationQuery = '';
    let locationParams = [username, email, hashedPassword];
    let locationIndex = 4;
    
    if (latitude && longitude) {
      locationQuery = ', location = ST_SetSRID(ST_GeographyFromText($4), 4326)';
      locationParams.push(`POINT(${longitude} ${latitude})`);
    }
    
    // Set preferred language if provided
    let languageQuery = '';
    if (preferredLanguage) {
      languageQuery = `, preferred_language = $${locationIndex}`;
      locationParams.push(preferredLanguage);
      locationIndex++;
    }
    
    // Create user
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password${locationQuery && locationQuery.replace(',', '')}${languageQuery && languageQuery.replace(',', '')})
       VALUES ($1, $2, $3${locationQuery ? ', $4' : ''}${languageQuery ? `, $${locationIndex - 1}` : ''})
       RETURNING id, username, email`,
      locationParams
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      message: req.t('auth.register_success'),
      user: rows[0],
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const { rows } = await db.query(
      'SELECT id, username, email, password, preferred_language FROM users WHERE email = $1',
      [email]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ message: req.t('auth.invalid_credentials') });
    }
    
    const user = rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: req.t('auth.invalid_credentials') });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Remove password from response
    delete user.password;
    
    res.json({
      message: req.t('auth.login_success'),
      user,
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

module.exports = {
  register,
  login
};
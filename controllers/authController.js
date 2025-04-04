const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// Register a new user
const register = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: req.t('auth:validationError'),
        errors: errors.array()
      });
    }
    
    const { username, email, password, fullName, latitude, longitude, preferredLanguage } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByCredentials(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: req.t('auth:userExists')
      });
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      fullName,
      latitude,
      longitude,
      preferredLanguage
    });
    
    // Create JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.status(201).json({
      success: true,
      message: req.t('auth:registerSuccess'),
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        location: user.location,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: req.t('auth:validationError'),
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findByCredentials(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: req.t('auth:invalidCredentials')
      });
    }
    
    // Check password
    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: req.t('auth:invalidCredentials')
      });
    }
    
    // Create JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.status(200).json({
      success: true,
      message: req.t('auth:loginSuccess'),
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        location: await User.findById(user.id).then(u => u.location),
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        location: user.location,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};
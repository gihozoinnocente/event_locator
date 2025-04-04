const { validationResult } = require('express-validator');
const User = require('../models/User');
const Event = require('../models/Event');
const Category = require('../models/Category');

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: req.t('common:validationError'),
        errors: errors.array()
      });
    }
    
    const { fullName, latitude, longitude, preferredLanguage } = req.body;
    
    // Update user
    const updatedUser = await User.update(req.user.id, {
      fullName,
      latitude,
      longitude,
      preferredLanguage
    });
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: req.t('user:notFound')
      });
    }
    
    res.status(200).json({
      success: true,
      message: req.t('user:updateSuccess'),
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        location: updatedUser.location,
        preferredLanguage: updatedUser.preferred_language
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update user category preferences
const updateCategoryPreferences = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: req.t('common:validationError'),
        errors: errors.array()
      });
    }
    
    const { categoryIds } = req.body;
    
    // Validate that all categories exist
    if (categoryIds && categoryIds.length > 0) {
      const allCategories = await Category.getAll();
      const validCategoryIds = allCategories.map(cat => cat.id);
      
      const invalidCategories = categoryIds.filter(id => !validCategoryIds.includes(id));
      if (invalidCategories.length > 0) {
        return res.status(400).json({
          success: false,
          message: req.t('category:invalidCategories'),
          invalidCategories
        });
      }
    }
    
    // Update preferences
    const updatedPreferences = await User.updateCategoryPreferences(req.user.id, categoryIds);
    
    res.status(200).json({
      success: true,
      message: req.t('user:preferencesUpdated'),
      preferences: updatedPreferences
    });
  } catch (error) {
    next(error);
  }
};

// Get user category preferences
const getCategoryPreferences = async (req, res, next) => {
  try {
    const preferences = await User.getCategoryPreferences(req.user.id);
    
    res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    next(error);
  }
};

// Save event as favorite
const saveEventAsFavorite = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    // Save event as favorite
    await Event.saveAsFavorite(req.user.id, eventId);
    
    res.status(200).json({
      success: true,
      message: req.t('user:eventSaved')
    });
  } catch (error) {
    next(error);
  }
};

// Remove event from favorites
const removeEventFromFavorites = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    // Remove event from favorites
    await Event.removeFromFavorites(req.user.id, eventId);
    
    res.status(200).json({
      success: true,
      message: req.t('user:eventRemoved')
    });
  } catch (error) {
    next(error);
  }
};

// Get favorite events
const getFavoriteEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const favorites = await Event.getFavorites(req.user.id, page, limit);
    
    res.status(200).json({
      success: true,
      data: favorites
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  updateCategoryPreferences,
  getCategoryPreferences,
  saveEventAsFavorite,
  removeEventFromFavorites,
  getFavoriteEvents
};
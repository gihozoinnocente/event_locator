const { validationResult } = require('express-validator');
const Event = require('../models/Event');
const Category = require('../models/Category');
const Review = require('../models/Review');
const notificationService = require('../services/notificationService');

// Create a new event
const createEvent = async (req, res, next) => {
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
    
    const { title, description, latitude, longitude, address, startTime, endTime, categoryIds } = req.body;
    
    // Create event
    const event = await Event.create({
      title,
      description,
      latitude,
      longitude,
      address,
      startTime,
      endTime,
      creatorId: req.user.id,
      categoryIds
    });
    
    // Queue notifications to interested users
    await notificationService.notifyNewEvent(event);
    
    res.status(201).json({
      success: true,
      message: req.t('event:createSuccess'),
      event
    });
  } catch (error) {
    next(error);
  }
};

// Get all events with pagination
const getAllEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const events = await Event.getAll(page, limit);
    
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific event
const getEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
};

// Update an event
const updateEvent = async (req, res, next) => {
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
    
    const { eventId } = req.params;
    const { title, description, latitude, longitude, address, startTime, endTime, categoryIds } = req.body;
    
    // Find event and check ownership
    const existingEvent = await Event.findById(eventId);
    
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    if (existingEvent.creator_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: req.t('auth:notAuthorized')
      });
    }
    
    // Update event
    const updatedEvent = await Event.update(eventId, {
      title,
      description,
      latitude,
      longitude,
      address,
      startTime,
      endTime,
      categoryIds
    });
    
    // Notify about updated event
    await notificationService.notifyEventUpdate(updatedEvent);
    
    res.status(200).json({
      success: true,
      message: req.t('event:updateSuccess'),
      event: updatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// Delete an event
const deleteEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    // Find event and check ownership
    const existingEvent = await Event.findById(eventId);
    
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    if (existingEvent.creator_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: req.t('auth:notAuthorized')
      });
    }
    
    // Delete event
    await Event.delete(eventId);
    
    res.status(200).json({
      success: true,
      message: req.t('event:deleteSuccess')
    });
  } catch (error) {
    next(error);
  }
};

// Get events by category
const getEventsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: req.t('category:notFound')
      });
    }
    
    // Get events
    const events = await Category.getEvents(categoryId, page, limit);
    
    res.status(200).json({
      success: true,
      category,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// Add a review to an event
const addReview = async (req, res, next) => {
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
    
    const { eventId } = req.params;
    const { rating, comment } = req.body;
    
    // Check if event exists
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    // Create review
    const review = await Review.create({
      eventId,
      userId: req.user.id,
      rating,
      comment
    });
    
    res.status(201).json({
      success: true,
      message: req.t('review:createSuccess'),
      review
    });
  } catch (error) {
    next(error);
  }
};

// Get reviews for an event
const getEventReviews = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if event exists
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: req.t('event:notFound')
      });
    }
    
    // Get reviews
    const reviews = await Review.getByEventId(eventId, page, limit);
    
    // Get review statistics
    const statistics = await Review.getStatistics(eventId);
    
    res.status(200).json({
      success: true,
      data: reviews,
      statistics
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventsByCategory,
  addReview,
  getEventReviews
};
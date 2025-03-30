const db = require('../config/database');
const redisClient = require('../config/redis');
const { generatePoint, extractCoordinates, formatEvent, validateCoordinates } = require('../utils/helpers');
const { isAuthorized } = require('../middleware/auth.middleware');

/**
 * Create a new event
 */
const createEvent = async (req, res) => {
  try {
    const { title, description, latitude, longitude, address, startDate, endDate, categories } = req.body;
    const userId = req.user.id;
    
    // Validate coordinates
    if (!validateCoordinates(latitude, longitude)) {
      return res.status(400).json({ message: req.t('validation.invalid_coordinates') });
    }
    
    // Generate PostGIS point
    const point = generatePoint(latitude, longitude);
    
    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert event
      const { rows: eventRows } = await client.query(
        `INSERT INTO events (
          title, description, location, address, start_date, end_date, created_by
        ) VALUES (
          $1, $2, ST_SetSRID(ST_GeographyFromText($3), 4326), $4, $5, $6, $7
        ) RETURNING id, title, description, location, address, start_date, end_date, created_by, created_at, updated_at`,
        [title, description, point, address, startDate, endDate, userId]
      );
      
      const event = eventRows[0];
      
      // Insert categories if provided
      let eventCategories = [];
      if (categories && categories.length > 0) {
        // Insert categories
        const categoryValues = categories.map((categoryId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        const categoryParams = [event.id, ...categories];
        
        await client.query(
          `INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`,
          categoryParams
        );
        
        // Get category details
        const { rows: categoryRows } = await client.query(
          `SELECT c.id, c.name 
           FROM categories c 
           WHERE c.id IN (${categories.map((_, index) => `$${index + 1}`).join(', ')})`,
          categories
        );
        
        eventCategories = categoryRows;
      }
      
      await client.query('COMMIT');
      
      // Format event for response
      const formattedEvent = formatEvent(event, eventCategories);
      
      // Queue notification for users with matching preferences
      await queueEventNotifications(event.id, categories);
      
      res.status(201).json({
        message: req.t('events.created'),
        event: formattedEvent
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Get all events with optional filtering
 */
const getEvents = async (req, res) => {
  try {
    const { 
      latitude, longitude, radius = process.env.DEFAULT_SEARCH_RADIUS,
      categories, startDate, endDate, search, limit = 20, offset = 0
    } = req.query;
    
    // Base query
    let query = `
      SELECT e.id, e.title, e.description, e.location, e.address, 
             e.start_date, e.end_date, e.created_by, e.created_at, e.updated_at
      FROM events e
    `;
    
    let countQuery = `
      SELECT COUNT(*) FROM events e
    `;
    
    // Parameters for query
    const params = [];
    let paramIndex = 1;
    
    // WHERE conditions
    const conditions = [];
    
    // Add location-based filtering if coordinates provided
    if (latitude && longitude && validateCoordinates(latitude, longitude)) {
      const point = generatePoint(latitude, longitude);
      
      // Add distance column to query
      query = `
        SELECT e.id, e.title, e.description, e.location, e.address, 
               e.start_date, e.end_date, e.created_by, e.created_at, e.updated_at,
               ST_Distance(e.location, ST_SetSRID(ST_GeographyFromText($${paramIndex}), 4326)) as distance
        FROM events e
      `;
      
      params.push(point);
      
      // Add distance filter
      conditions.push(`ST_DWithin(e.location, ST_SetSRID(ST_GeographyFromText($${paramIndex}), 4326), $${paramIndex + 1})`);
      params.push(radius);
      paramIndex += 2;
    }
    
    // Add category filtering if provided
    if (categories && categories.length > 0) {
      const categoryIds = categories.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      
      if (categoryIds.length > 0) {
        // Join with event_categories
        query += `
          JOIN event_categories ec ON e.id = ec.event_id
        `;
        countQuery += `
          JOIN event_categories ec ON e.id = ec.event_id
        `;
        
        // Add category filter
        const categoryPlaceholders = categoryIds.map((_, index) => `$${paramIndex + index}`).join(', ');
        conditions.push(`ec.category_id IN (${categoryPlaceholders})`);
        params.push(...categoryIds);
        paramIndex += categoryIds.length;
      }
    }
    
    // Add date filtering if provided
    if (startDate) {
      conditions.push(`e.start_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      conditions.push(`e.end_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    // Add text search if provided
    if (search) {
      conditions.push(`(e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Combine conditions
    if (conditions.length > 0) {
      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      query += ` ${whereClause}`;
      countQuery += ` ${whereClause}`;
    }
    
    // Add GROUP BY if using categories to prevent duplicates
    if (categories && categories.length > 0) {
      query += ` GROUP BY e.id`;
      countQuery += ` GROUP BY e.id`;
    }
    
    // Add sorting
    if (latitude && longitude) {
      query += ` ORDER BY distance ASC`;
    } else {
      query += ` ORDER BY e.start_date ASC`;
    }
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    // Execute query
    const { rows: eventRows } = await db.query(query, params);
    
    // Get count of total events
    const { rows: countRows } = await db.query(countQuery, params.slice(0, -2));
    const totalEvents = countRows.length;
    
    // Get categories for each event
    const eventIds = eventRows.map(event => event.id);
    let eventCategories = {};
    
    if (eventIds.length > 0) {
      const { rows: categoryRows } = await db.query(
        `SELECT ec.event_id, c.id, c.name
         FROM event_categories ec
         JOIN categories c ON ec.category_id = c.id
         WHERE ec.event_id IN (${eventIds.map((_, index) => `$${index + 1}`).join(', ')})`,
        eventIds
      );
      
      // Group categories by event
      categoryRows.forEach(row => {
        if (!eventCategories[row.event_id]) {
          eventCategories[row.event_id] = [];
        }
        eventCategories[row.event_id].push({ id: row.id, name: row.name });
      });
    }
    
    // Format events for response
    const formattedEvents = eventRows.map(event => formatEvent(event, eventCategories[event.id] || []));
    
    res.json({
      events: formattedEvents,
      total: totalEvents,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Get event by ID
 */
const getEventById = async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Get event
    const { rows: eventRows } = await db.query(
      `SELECT e.id, e.title, e.description, e.location, e.address, 
              e.start_date, e.end_date, e.created_by, e.created_at, e.updated_at
       FROM events e
       WHERE e.id = $1`,
      [eventId]
    );
    
    if (eventRows.length === 0) {
      return res.status(404).json({ message: req.t('events.not_found') });
    }
    
    const event = eventRows[0];
    
    // Get event categories
    const { rows: categoryRows } = await db.query(
      `SELECT c.id, c.name
       FROM categories c
       JOIN event_categories ec ON c.id = ec.category_id
       WHERE ec.event_id = $1`,
      [eventId]
    );
    
    // Get event ratings
    const { rows: ratingRows } = await db.query(
      `SELECT r.id, r.rating, r.review, r.created_at, u.username
       FROM event_ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [eventId]
    );
    
    // Calculate average rating
    let averageRating = null;
    if (ratingRows.length > 0) {
      averageRating = ratingRows.reduce((sum, rating) => sum + rating.rating, 0) / ratingRows.length;
    }
    
    // Format event for response
    const formattedEvent = formatEvent(event, categoryRows);
    
    res.json({
      ...formattedEvent,
      ratings: ratingRows.map(r => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        username: r.username,
        createdAt: r.created_at
      })),
      averageRating
    });
  } catch (error) {
    console.error('Error getting event by ID:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Update event
 */
const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const { title, description, latitude, longitude, address, startDate, endDate, categories } = req.body;
    
    // Check if event exists and user has permission
    const { rows: eventRows } = await db.query(
      'SELECT id, created_by FROM events WHERE id = $1',
      [eventId]
    );
    
    if (eventRows.length === 0) {
      return res.status(404).json({ message: req.t('events.not_found') });
    }
    
    if (!isAuthorized(eventRows[0].created_by, userId)) {
      return res.status(403).json({ message: req.t('events.unauthorized') });
    }
    
    // Start transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Prepare update fields
      let updateQuery = 'UPDATE events SET ';
      const updateValues = [];
      const updateFields = [];
      
      if (title) {
        updateFields.push(`title = $${updateValues.length + 1}`);
        updateValues.push(title);
      }
      
      if (description !== undefined) {
        updateFields.push(`description = $${updateValues.length + 1}`);
        updateValues.push(description);
      }
      
      if (latitude && longitude) {
        // Validate coordinates
        if (!validateCoordinates(latitude, longitude)) {
          return res.status(400).json({ message: req.t('validation.invalid_coordinates') });
        }
        
        const point = generatePoint(latitude, longitude);
        updateFields.push(`location = ST_SetSRID(ST_GeographyFromText($${updateValues.length + 1}), 4326)`);
        updateValues.push(point);
      }
      
      if (address) {
        updateFields.push(`address = $${updateValues.length + 1}`);
        updateValues.push(address);
      }
      
      if (startDate) {
        updateFields.push(`start_date = $${updateValues.length + 1}`);
        updateValues.push(startDate);
      }
      
      if (endDate) {
        updateFields.push(`end_date = $${updateValues.length + 1}`);
        updateValues.push(endDate);
      }
      
      updateFields.push(`updated_at = $${updateValues.length + 1}`);
      updateValues.push(new Date());
      
      // If there are fields to update
      if (updateFields.length > 0) {
        updateQuery += updateFields.join(', ');
        updateQuery += ` WHERE id = $${updateValues.length + 1} RETURNING id, title, description, location, address, start_date, end_date, created_by, created_at, updated_at`;
        updateValues.push(eventId);
        
        // Update event
        const { rows: updatedRows } = await client.query(updateQuery, updateValues);
        
        // If we need to update categories
        if (categories && Array.isArray(categories)) {
          // Delete existing categories
          await client.query(
            'DELETE FROM event_categories WHERE event_id = $1',
            [eventId]
          );
          
          // Insert new categories if provided
          if (categories.length > 0) {
            const categoryValues = categories.map((categoryId, index) => 
              `($1, $${index + 2})`
            ).join(', ');
            
            const categoryParams = [eventId, ...categories];
            
            await client.query(
              `INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`,
              categoryParams
            );
          }
        }
        
        // Get updated categories
        const { rows: categoryRows } = await client.query(
          `SELECT c.id, c.name
           FROM categories c
           JOIN event_categories ec ON c.id = ec.category_id
           WHERE ec.event_id = $1`,
          [eventId]
        );
        
        await client.query('COMMIT');
        
        // Format event for response
        const formattedEvent = formatEvent(updatedRows[0], categoryRows);
        
        // Queue notification for event update
        await queueEventUpdateNotifications(eventId);
        
        res.json({
          message: req.t('events.updated'),
          event: formattedEvent
        });
      } else {
        await client.query('COMMIT');
        res.json({ message: req.t('events.updated') });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Delete event
 */
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    
    // Check if event exists and user has permission
    const { rows } = await db.query(
      'SELECT id, created_by FROM events WHERE id = $1',
      [eventId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: req.t('events.not_found') });
    }
    
    if (!isAuthorized(rows[0].created_by, userId)) {
      return res.status(403).json({ message: req.t('events.unauthorized') });
    }
    
    // Delete event (cascade will handle related records)
    await db.query(
      'DELETE FROM events WHERE id = $1',
      [eventId]
    );
    
    res.json({ message: req.t('events.deleted') });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Rate event
 */
const rateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    const { rating, review } = req.body;
    
    // Check if event exists
    const { rows: eventRows } = await db.query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );
    
    if (eventRows.length === 0) {
      return res.status(404).json({ message: req.t('events.not_found') });
    }
    
    // Check if user has already rated this event
    const { rows: ratingRows } = await db.query(
      'SELECT id FROM event_ratings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    
    if (ratingRows.length > 0) {
      return res.status(400).json({ message: req.t('events.already_rated') });
    }
    
    // Insert rating
    const { rows } = await db.query(
      `INSERT INTO event_ratings (event_id, user_id, rating, review)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, review, created_at`,
      [eventId, userId, rating, review]
    );
    
    res.status(201).json({
      message: req.t('events.rating_created'),
      rating: rows[0]
    });
  } catch (error) {
    console.error('Error rating event:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Toggle favorite event
 */
const toggleFavorite = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id;
    
    // Check if event exists
    const { rows: eventRows } = await db.query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );
    
    if (eventRows.length === 0) {
      return res.status(404).json({ message: req.t('events.not_found') });
    }
    
    // Check if event is already in favorites
    const { rows: favoriteRows } = await db.query(
      'SELECT 1 FROM user_favorite_events WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    
    // Toggle favorite status
    if (favoriteRows.length > 0) {
      // Remove from favorites
      await db.query(
        'DELETE FROM user_favorite_events WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      
      res.json({ message: req.t('events.favorite_removed') });
    } else {
      // Add to favorites
      await db.query(
        'INSERT INTO user_favorite_events (event_id, user_id) VALUES ($1, $2)',
        [eventId, userId]
      );
      
      res.json({ message: req.t('events.favorite_added') });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ message: req.t('server_error') });
  }
};

/**
 * Queue notifications for users with matching preferences for a new event
 */
const queueEventNotifications = async (eventId, categories) => {
  try {
    // Skip if no categories
    if (!categories || categories.length === 0) return;
    
    // Get users with matching preferences
    const { rows: userRows } = await db.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.preferred_language
       FROM users u
       JOIN user_category_preferences ucp ON u.id = ucp.user_id
       WHERE ucp.category_id IN (${categories.map((_, index) => `$${index + 1}`).join(', ')})`,
      categories
    );
    
    // Get event details
    const { rows: eventRows } = await db.query(
      'SELECT id, title, start_date FROM events WHERE id = $1',
      [eventId]
    );
    
    if (eventRows.length === 0) return;
    const event = eventRows[0];
    
    // Queue notifications for each user
    for (const user of userRows) {
      const notification = {
        type: 'new_event',
        userId: user.id,
        username: user.username,
        email: user.email,
        language: user.preferred_language,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.start_date,
        timestamp: new Date().toISOString()
      };
      
      // Publish to Redis
      await redisClient.publish('notifications', JSON.stringify(notification));
      
      // For scheduled notifications (closer to event date), store in Redis
      const eventDate = new Date(event.start_date);
      const now = new Date();
      const daysBefore = 1; // Notify 1 day before event
      
      // Calculate notification date
      const notificationDate = new Date(eventDate);
      notificationDate.setDate(notificationDate.getDate() - daysBefore);
      
      // If notification date is in the future, schedule it
      if (notificationDate > now) {
        const scheduledNotification = {
          ...notification,
          type: 'upcoming_event',
        };
        
        // Store in Redis with expiration
        const key = `scheduled:${event.id}:${user.id}`;
        const expirationSeconds = Math.floor((notificationDate - now) / 1000);
        
        await redisClient.set(key, JSON.stringify(scheduledNotification), {
          EX: expirationSeconds
        });
      }
    }
  } catch (error) {
    console.error('Error queueing event notifications:', error);
  }
};

/**
 * Queue notifications for event updates
 */
const queueEventUpdateNotifications = async (eventId) => {
  try {
    // Get users who favorited the event
    const { rows: userRows } = await db.query(
      `SELECT u.id, u.username, u.email, u.preferred_language
       FROM users u
       JOIN user_favorite_events ufe ON u.id = ufe.user_id
       WHERE ufe.event_id = $1`,
      [eventId]
    );
    
    // Get event details
    const { rows: eventRows } = await db.query(
      'SELECT id, title, start_date FROM events WHERE id = $1',
      [eventId]
    );
    
    if (eventRows.length === 0) return;
    const event = eventRows[0];
    
    // Queue notifications for each user
    for (const user of userRows) {
      const notification = {
        type: 'event_update',
        userId: user.id,
        username: user.username,
        email: user.email,
        language: user.preferred_language,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.start_date,
        timestamp: new Date().toISOString()
      };
      
      // Publish to Redis
      await redisClient.publish('notifications', JSON.stringify(notification));
    }
  } catch (error) {
    console.error('Error queueing event update notifications:', error);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  rateEvent,
  toggleFavorite
};
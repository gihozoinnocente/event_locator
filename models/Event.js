const db = require('../config/database');

class Event {
  // Find an event by ID
  static async findById(id) {
    try {
      // Get the event details
      const eventResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        WHERE e.id = $1`,
        [id]
      );
      
      if (eventResult.rows.length === 0) return null;
      
      const event = eventResult.rows[0];
      
      // Parse the location
      const locationData = JSON.parse(event.location);
      event.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      // Get the event categories
      const categoriesResult = await db.query(
        `SELECT c.id, c.name, c.description
        FROM categories c
        JOIN event_categories ec ON c.id = ec.category_id
        WHERE ec.event_id = $1`,
        [id]
      );
      
      event.categories = categoriesResult.rows;
      
      // Get the event ratings
      const ratingsResult = await db.query(
        `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
        FROM reviews
        WHERE event_id = $1`,
        [id]
      );
      
      event.ratings = {
        averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
        reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
      };
      
      return event;
    } catch (error) {
      throw error;
    }
  }

  // Create a new event
  static async create(eventData) {
    const { title, description, latitude, longitude, address, startTime, endTime, creatorId, categoryIds } = eventData;
    
    try {
      // Start a transaction
      await db.query('BEGIN');
      
      // Insert the event
      const eventResult = await db.query(
        `INSERT INTO events 
        (title, description, location, address, start_time, end_time, creator_id)
        VALUES 
        ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8)
        RETURNING id, title, description, ST_AsGeoJSON(location) as location, address, start_time, end_time, creator_id, created_at`,
        [title, description, longitude, latitude, address, startTime, endTime, creatorId]
      );
      
      const event = eventResult.rows[0];
      const eventId = event.id;
      
      // Parse the location
      const locationData = JSON.parse(event.location);
      event.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      // Insert event categories
      if (categoryIds && categoryIds.length > 0) {
        const categoryValues = categoryIds.map(categoryId => `(${eventId}, ${categoryId})`).join(', ');
        await db.query(`INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`);
        
        // Get the categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [eventId]
        );
        
        event.categories = categoriesResult.rows;
      } else {
        event.categories = [];
      }
      
      // Commit the transaction
      await db.query('COMMIT');
      
      return event;
    } catch (error) {
      // Rollback the transaction in case of error
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Update an event
  static async update(id, updateData) {
    const { title, description, latitude, longitude, address, startTime, endTime, categoryIds } = updateData;
    
    try {
      // Start a transaction
      await db.query('BEGIN');
      
      // Update event details
      let query = 'UPDATE events SET ';
      const values = [];
      const queryParts = [];
      
      let paramIndex = 1;
      
      if (title) {
        queryParts.push(`title = $${paramIndex}`);
        values.push(title);
        paramIndex++;
      }
      
      if (description) {
        queryParts.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }
      
      if (latitude && longitude) {
        queryParts.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography`);
        values.push(longitude, latitude);
        paramIndex += 2;
      }
      
      if (address) {
        queryParts.push(`address = $${paramIndex}`);
        values.push(address);
        paramIndex++;
      }
      
      if (startTime) {
        queryParts.push(`start_time = $${paramIndex}`);
        values.push(startTime);
        paramIndex++;
      }
      
      if (endTime) {
        queryParts.push(`end_time = $${paramIndex}`);
        values.push(endTime);
        paramIndex++;
      }
      
      queryParts.push(`updated_at = CURRENT_TIMESTAMP`);
      
      query += queryParts.join(', ');
      query += ` WHERE id = $${paramIndex} RETURNING id, title, description, ST_AsGeoJSON(location) as location, address, start_time, end_time, creator_id, updated_at`;
      values.push(id);
      
      const eventResult = await db.query(query, values);
      
      if (eventResult.rows.length === 0) {
        // Rollback and return null if event not found
        await db.query('ROLLBACK');
        return null;
      }
      
      const event = eventResult.rows[0];
      
      // Parse the location
      const locationData = JSON.parse(event.location);
      event.location = {
        latitude: locationData.coordinates[1],
        longitude: locationData.coordinates[0]
      };
      
      // Update categories if provided
      if (categoryIds) {
        // First, delete existing categories
        await db.query('DELETE FROM event_categories WHERE event_id = $1', [id]);
        
        // Then, insert new categories if there are any
        if (categoryIds.length > 0) {
          const categoryValues = categoryIds.map(categoryId => `(${id}, ${categoryId})`).join(', ');
          await db.query(`INSERT INTO event_categories (event_id, category_id) VALUES ${categoryValues}`);
        }
        
        // Get the updated categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [id]
        );
        
        event.categories = categoriesResult.rows;
      }
      
      // Commit the transaction
      await db.query('COMMIT');
      
      return event;
    } catch (error) {
      // Rollback the transaction in case of error
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Delete an event
  static async delete(id) {
    try {
      const result = await db.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get all events (with pagination)
  static async getAll(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get events
      const eventsResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        ORDER BY e.start_time
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      // Get total count
      const countResult = await db.query('SELECT COUNT(*) FROM events');
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Search for events based on location, radius, and categories
  static async search(params) {
    const { latitude, longitude, radius = 10, categoryIds, startDate, endDate, page = 1, limit = 10 } = params;
    
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at,
        ST_Distance(e.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance
        FROM events e
        JOIN users u ON e.creator_id = u.id
      `;
      
      let countQuery = `
        SELECT COUNT(*) 
        FROM events e
      `;
      
      // Add category filter if provided
      if (categoryIds && categoryIds.length > 0) {
        query += `
          JOIN event_categories ec ON e.id = ec.event_id
          WHERE ec.category_id IN (${categoryIds.join(',')})
        `;
        
        countQuery += `
          JOIN event_categories ec ON e.id = ec.event_id
          WHERE ec.category_id IN (${categoryIds.join(',')})
        `;
        
        // Add location filter
        query += ` AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)`;
        countQuery += ` AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)`;
      } else {
        // Add location filter without categories
        query += ` WHERE ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)`;
        countQuery += ` WHERE ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)`;
      }
      
      // Add date filter if provided
      if (startDate) {
        query += ` AND e.start_time >= $4`;
        countQuery += ` AND e.start_time >= $4`;
      }
      
      if (endDate) {
        query += ` AND e.end_time <= ${startDate ? '5' : '4'}`;
        countQuery += ` AND e.end_time <= ${startDate ? '5' : '4'}`;
      }
      
      // Order by distance and add pagination
      query += ` ORDER BY distance LIMIT ${startDate && endDate ? '6' : startDate || endDate ? '5' : '4'} OFFSET ${startDate && endDate ? '7' : startDate || endDate ? '6' : '5'}`;
      
      // Prepare query parameters
      const queryParams = [longitude, latitude, radius];
      if (startDate) queryParams.push(startDate);
      if (endDate) queryParams.push(endDate);
      queryParams.push(limit, offset);
      
      // Prepare count parameters
      const countParams = [longitude, latitude, radius];
      if (startDate) countParams.push(startDate);
      if (endDate) countParams.push(endDate);
      
      // Execute the queries
      const eventsResult = await db.query(query, queryParams);
      const countResult = await db.query(countQuery, countParams);
      
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Save an event as favorite
  static async saveAsFavorite(userId, eventId) {
    try {
      await db.query(
        'INSERT INTO saved_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, eventId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Remove an event from favorites
  static async removeFromFavorites(userId, eventId) {
    try {
      await db.query(
        'DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2',
        [userId, eventId]
      );
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get user's favorite events
  static async getFavorites(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get events
      const eventsResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at, se.created_at as saved_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        JOIN saved_events se ON e.id = se.event_id
        WHERE se.user_id = $1
        ORDER BY se.created_at DESC
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM saved_events WHERE user_id = $1',
        [userId]
      );
      
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Process each event
      const events = await Promise.all(eventsResult.rows.map(async (event) => {
        // Parse the location
        const locationData = JSON.parse(event.location);
        event.location = {
          latitude: locationData.coordinates[1],
          longitude: locationData.coordinates[0]
        };
        
        // Get the event categories
        const categoriesResult = await db.query(
          `SELECT c.id, c.name, c.description
          FROM categories c
          JOIN event_categories ec ON c.id = ec.category_id
          WHERE ec.event_id = $1`,
          [event.id]
        );
        
        event.categories = categoriesResult.rows;
        
        // Get the event ratings
        const ratingsResult = await db.query(
          `SELECT AVG(rating) as average_rating, COUNT(*) as review_count
          FROM reviews
          WHERE event_id = $1`,
          [event.id]
        );
        
        event.ratings = {
          averageRating: parseFloat(ratingsResult.rows[0].average_rating) || 0,
          reviewCount: parseInt(ratingsResult.rows[0].review_count) || 0
        };
        
        return event;
      }));
      
      return {
        events,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Event;
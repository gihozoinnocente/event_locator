const db = require('../config/database');

class Category {
  // Get all categories
  static async getAll() {
    try {
      const result = await db.query(
        'SELECT id, name, description, created_at FROM categories ORDER BY name'
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Find a category by ID
  static async findById(id) {
    try {
      const result = await db.query(
        'SELECT id, name, description, created_at FROM categories WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) return null;
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Create a new category (admin only)
  static async create(categoryData) {
    const { name, description } = categoryData;
    
    try {
      const result = await db.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
        [name, description]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update a category (admin only)
  static async update(id, updateData) {
    const { name, description } = updateData;
    
    try {
      let query = 'UPDATE categories SET ';
      const values = [];
      const queryParts = [];
      
      let paramIndex = 1;
      
      if (name) {
        queryParts.push(`name = $${paramIndex}`);
        values.push(name);
        paramIndex++;
      }
      
      if (description) {
        queryParts.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }
      
      query += queryParts.join(', ');
      query += ` WHERE id = $${paramIndex} RETURNING id, name, description, created_at`;
      values.push(id);
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) return null;
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete a category (admin only)
  static async delete(id) {
    try {
      const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get events by category
  static async getEvents(categoryId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get events
      const eventsResult = await db.query(
        `SELECT e.id, e.title, e.description, ST_AsGeoJSON(e.location) as location, 
        e.address, e.start_time, e.end_time, e.creator_id, u.username as creator_name,
        e.created_at, e.updated_at
        FROM events e
        JOIN users u ON e.creator_id = u.id
        JOIN event_categories ec ON e.id = ec.event_id
        WHERE ec.category_id = $1
        ORDER BY e.start_time
        LIMIT $2 OFFSET $3`,
        [categoryId, limit, offset]
      );
      
      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM events e JOIN event_categories ec ON e.id = ec.event_id WHERE ec.category_id = $1',
        [categoryId]
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

module.exports = Category;
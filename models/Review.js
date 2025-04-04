const db = require('../config/database');

class Review {
  // Create a new review
  static async create(reviewData) {
    const { eventId, userId, rating, comment } = reviewData;
    
    try {
      const result = await db.query(
        `INSERT INTO reviews 
        (event_id, user_id, rating, comment)
        VALUES 
        ($1, $2, $3, $4)
        ON CONFLICT (event_id, user_id) 
        DO UPDATE SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, event_id, user_id, rating, comment, created_at, updated_at`,
        [eventId, userId, rating, comment]
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get reviews for an event
  static async getByEventId(eventId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      // Get reviews
      const reviewsResult = await db.query(
        `SELECT r.id, r.event_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at, u.username
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3`,
        [eventId, limit, offset]
      );
      
      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM reviews WHERE event_id = $1',
        [eventId]
      );
      
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        reviews: reviewsResult.rows,
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

  // Get a specific review
  static async findById(id) {
    try {
      const result = await db.query(
        `SELECT r.id, r.event_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at, u.username
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) return null;
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete a review
  static async delete(id, userId) {
    try {
      const result = await db.query(
        'DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get review statistics for an event
  static async getStatistics(eventId) {
    try {
      const result = await db.query(
        `SELECT 
          AVG(rating) as average_rating,
          COUNT(*) as total_reviews,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
        FROM reviews
        WHERE event_id = $1`,
        [eventId]
      );
      
      const stats = result.rows[0];
      
      // Calculate percentages
      if (stats.total_reviews > 0) {
        stats.five_star_percent = (stats.five_star / stats.total_reviews) * 100;
        stats.four_star_percent = (stats.four_star / stats.total_reviews) * 100;
        stats.three_star_percent = (stats.three_star / stats.total_reviews) * 100;
        stats.two_star_percent = (stats.two_star / stats.total_reviews) * 100;
        stats.one_star_percent = (stats.one_star / stats.total_reviews) * 100;
      } else {
        stats.five_star_percent = 0;
        stats.four_star_percent = 0;
        stats.three_star_percent = 0;
        stats.two_star_percent = 0;
        stats.one_star_percent = 0;
      }
      
      return stats;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Review;
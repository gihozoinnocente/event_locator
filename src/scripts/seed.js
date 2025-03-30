/**
 * Database Seed Script
 * 
 * This script populates the database with sample data for testing and development.
 * Run with: node src/scripts/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { generatePoint } = require('../utils/helpers');

// Sample data
const users = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin123',
    latitude: 40.7128,
    longitude: -74.0060,
    preferredLanguage: 'en'
  },
  {
    username: 'john',
    email: 'john@example.com',
    password: 'john123',
    latitude: 40.7282,
    longitude: -73.7949,
    preferredLanguage: 'en'
  },
  {
    username: 'maria',
    email: 'maria@example.com',
    password: 'maria123',
    latitude: 40.6782,
    longitude: -73.9442,
    preferredLanguage: 'es'
  }
];

const categories = [
  { name: 'Music' },
  { name: 'Sports' },
  { name: 'Food' },
  { name: 'Arts' },
  { name: 'Technology' },
  { name: 'Business' },
  { name: 'Education' },
  { name: 'Health' }
];

const events = [
  {
    title: 'Tech Conference 2025',
    description: 'Annual technology conference showcasing the latest innovations.',
    latitude: 40.7128,
    longitude: -74.0060,
    address: '123 Tech Blvd, New York, NY',
    startDate: '2025-05-15T09:00:00Z',
    endDate: '2025-05-17T18:00:00Z',
    categories: [5, 6, 7], // Technology, Business, Education
    createdBy: 1 // admin
  },
  {
    title: 'Summer Music Festival',
    description: 'Outdoor music festival featuring local and international artists.',
    latitude: 40.7282,
    longitude: -73.7949,
    address: '456 Park Ave, New York, NY',
    startDate: '2025-07-20T14:00:00Z',
    endDate: '2025-07-20T23:00:00Z',
    categories: [1, 4], // Music, Arts
    createdBy: 2 // john
  },
  {
    title: 'Charity Marathon',
    description: 'Annual charity run to raise funds for children\'s hospital.',
    latitude: 40.6782,
    longitude: -73.9442,
    address: '789 Runner\'s Path, Brooklyn, NY',
    startDate: '2025-09-10T07:00:00Z',
    endDate: '2025-09-10T12:00:00Z',
    categories: [2, 8], // Sports, Health
    createdBy: 3 // maria
  },
  {
    title: 'Food & Wine Exhibition',
    description: 'Taste the finest culinary creations and wine selections from top chefs.',
    latitude: 40.7411,
    longitude: -73.9897,
    address: '321 Culinary Lane, New York, NY',
    startDate: '2025-06-05T11:00:00Z',
    endDate: '2025-06-07T20:00:00Z',
    categories: [3], // Food
    createdBy: 1 // admin
  },
  {
    title: 'Startup Networking Event',
    description: 'Connect with entrepreneurs, investors, and tech enthusiasts.',
    latitude: 40.7603,
    longitude: -73.9685,
    address: '555 Innovation St, New York, NY',
    startDate: '2025-04-25T18:00:00Z',
    endDate: '2025-04-25T21:00:00Z',
    categories: [5, 6], // Technology, Business
    createdBy: 2 // john
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    console.log('Starting database seed...');
    
    const client = await db.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      console.log('Seeding categories...');
      // Insert categories
      for (const category of categories) {
        await client.query(
          'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [category.name]
        );
      }
      
      // Get category IDs
      const { rows: categoryRows } = await client.query('SELECT id, name FROM categories');
      const categoryMap = {};
      categoryRows.forEach(row => {
        categoryMap[row.name] = row.id;
      });
      
      console.log('Seeding users...');
      // Insert users
      for (const user of users) {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        
        // Generate PostGIS point
        const point = generatePoint(user.latitude, user.longitude);
        
        // Insert user
        const { rows } = await client.query(
          `INSERT INTO users (username, email, password, location, preferred_language)
           VALUES ($1, $2, $3, ST_SetSRID(ST_GeographyFromText($4), 4326), $5)
           ON CONFLICT (username) DO UPDATE
           SET email = $2, password = $3, location = ST_SetSRID(ST_GeographyFromText($4), 4326), preferred_language = $5
           RETURNING id`,
          [user.username, user.email, hashedPassword, point, user.preferredLanguage]
        );
        
        user.id = rows[0].id;
        
        // Add some category preferences
        const preferredCategories = Array.from({ length: 3 }, () => Math.floor(Math.random() * categories.length) + 1);
        
        for (const categoryId of preferredCategories) {
          await client.query(
            'INSERT INTO user_category_preferences (user_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user.id, categoryId]
          );
        }
      }
      
      console.log('Seeding events...');
      // Insert events
      for (const event of events) {
        // Generate PostGIS point
        const point = generatePoint(event.latitude, event.longitude);
        
        // Insert event
        const { rows } = await client.query(
          `INSERT INTO events (title, description, location, address, start_date, end_date, created_by)
           VALUES ($1, $2, ST_SetSRID(ST_GeographyFromText($3), 4326), $4, $5, $6, $7)
           RETURNING id`,
          [
            event.title,
            event.description,
            point,
            event.address,
            event.startDate,
            event.endDate,
            event.createdBy
          ]
        );
        
        const eventId = rows[0].id;
        
        // Add event categories
        for (const categoryId of event.categories) {
          await client.query(
            'INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)',
            [eventId, categoryId]
          );
        }
        
        // Add some ratings
        const ratingUsers = users.filter(u => u.id !== event.createdBy);
        for (const user of ratingUsers) {
          const rating = Math.floor(Math.random() * 5) + 1;
          const review = rating > 3 
            ? `Great event! ${rating}/5 stars.` 
            : `Needs improvement. ${rating}/5 stars.`;
          
          await client.query(
            'INSERT INTO event_ratings (event_id, user_id, rating, review) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [eventId, user.id, rating, review]
          );
        }
        
        // Add some favorites
        const randomUser = users[Math.floor(Math.random() * users.length)];
        await client.query(
          'INSERT INTO user_favorite_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [randomUser.id, eventId]
        );
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('Database seed completed successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close database connection
    await db.end();
  }
};

// Run the seed function if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
const redis = require('redis');
const User = require('../models/User');
const db = require('../config/database');
require('dotenv').config();

// Create Redis client
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
    
    // Subscribe to channels
    await subscribeToChannels();
  } catch (error) {
    console.error('Redis connection error:', error);
  }
})();

// Subscribe to notification channels
const subscribeToChannels = async () => {
  const subscriber = redisClient.duplicate();
  
  try {
    await subscriber.connect();
    
    // Subscribe to new event notifications
    await subscriber.subscribe('event:new', async (message) => {
      try {
        const eventData = JSON.parse(message);
        await processNewEventNotification(eventData);
      } catch (error) {
        console.error('Error processing new event notification:', error);
      }
    });
    
    // Subscribe to event update notifications
    await subscriber.subscribe('event:update', async (message) => {
      try {
        const eventData = JSON.parse(message);
        await processEventUpdateNotification(eventData);
      } catch (error) {
        console.error('Error processing event update notification:', error);
      }
    });
    
    // Subscribe to upcoming event reminders
    await subscriber.subscribe('event:reminder', async (message) => {
      try {
        const reminderData = JSON.parse(message);
        await processEventReminderNotification(reminderData);
      } catch (error) {
        console.error('Error processing event reminder notification:', error);
      }
    });
    
    console.log('Subscribed to notification channels');
  } catch (error) {
    console.error('Error subscribing to channels:', error);
  }
};

// Process new event notification
const processNewEventNotification = async (eventData) => {
  try {
    const { event } = eventData;
    
    // Find users who might be interested based on categories and location
    const interestedUsers = await findInterestedUsers(event);
    
    // Create notifications for interested users
    await Promise.all(interestedUsers.map(async (user) => {
      // Create notification record
      await db.query(
        `INSERT INTO notifications (user_id, event_id, message) 
         VALUES ($1, $2, $3)`,
        [user.id, event.id, `New event "${event.title}" matching your interests is happening near you.`]
      );
    }));
  } catch (error) {
    console.error('Error in processNewEventNotification:', error);
  }
};

// Process event update notification
const processEventUpdateNotification = async (eventData) => {
  try {
    const { event } = eventData;
    
    // Find users who have saved this event
    const savedEventsResult = await db.query(
      `SELECT user_id FROM saved_events WHERE event_id = $1`,
      [event.id]
    );
    
    const userIds = savedEventsResult.rows.map(row => row.user_id);
    
    // Create notifications for users who saved the event
    await Promise.all(userIds.map(async (userId) => {
      await db.query(
        `INSERT INTO notifications (user_id, event_id, message) 
         VALUES ($1, $2, $3)`,
        [userId, event.id, `Event "${event.title}" that you saved has been updated.`]
      );
    }));
  } catch (error) {
    console.error('Error in processEventUpdateNotification:', error);
  }
};

// Process event reminder notification
const processEventReminderNotification = async (reminderData) => {
  try {
    const { eventId, reminderType } = reminderData;
    
    // Get event details
    const eventResult = await db.query(
      `SELECT id, title, start_time FROM events WHERE id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return;
    }
    
    const event = eventResult.rows[0];
    
    // Find users who saved this event
    const savedEventsResult = await db.query(
      `SELECT user_id FROM saved_events WHERE event_id = $1`,
      [eventId]
    );
    
    const userIds = savedEventsResult.rows.map(row => row.user_id);
    
    // Create reminder notifications
    let message;
    if (reminderType === 'day') {
      message = `Reminder: Event "${event.title}" is happening tomorrow.`;
    } else if (reminderType === 'hour') {
      message = `Reminder: Event "${event.title}" is starting in an hour.`;
    }
    
    await Promise.all(userIds.map(async (userId) => {
      await db.query(
        `INSERT INTO notifications (user_id, event_id, message) 
         VALUES ($1, $2, $3)`,
        [userId, eventId, message]
      );
    }));
  } catch (error) {
    console.error('Error in processEventReminderNotification:', error);
  }
};

// Find users who might be interested in an event
const findInterestedUsers = async (event) => {
  try {
    const { id: eventId, location, categories } = event;
    
    // Extract category IDs
    const categoryIds = categories.map(cat => cat.id);
    
    // Find users with matching category preferences within a certain radius
    const usersResult = await db.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.preferred_language
       FROM users u
       JOIN user_category_preferences ucp ON u.id = ucp.user_id
       WHERE 
         ucp.category_id = ANY($1::int[]) 
         AND ST_DWithin(u.location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4 * 1000)
         AND u.id != $5`,
      [categoryIds, location.longitude, location.latitude, process.env.NOTIFICATION_RADIUS || 20, event.creator_id]
    );
    
    return usersResult.rows;
  } catch (error) {
    console.error('Error in findInterestedUsers:', error);
    return [];
  }
};

// Notify users about a new event
const notifyNewEvent = async (event) => {
  try {
    // Publish to Redis channel
    await redisClient.publish('event:new', JSON.stringify({ event }));
    return true;
  } catch (error) {
    console.error('Error in notifyNewEvent:', error);
    return false;
  }
};

// Notify users about an event update
const notifyEventUpdate = async (event) => {
  try {
    // Publish to Redis channel
    await redisClient.publish('event:update', JSON.stringify({ event }));
    return true;
  } catch (error) {
    console.error('Error in notifyEventUpdate:', error);
    return false;
  }
};

// Schedule event reminders
const scheduleEventReminder = async (eventId, startTime) => {
  try {
    const eventTime = new Date(startTime).getTime();
    const currentTime = new Date().getTime();
    
    // Calculate time differences
    const dayBefore = eventTime - 24 * 60 * 60 * 1000; // 24 hours before
    const hourBefore = eventTime - 60 * 60 * 1000; // 1 hour before
    
    // Schedule day-before reminder if there's still time
    if (dayBefore > currentTime) {
      const dayReminderDelay = dayBefore - currentTime;
      setTimeout(async () => {
        await redisClient.publish('event:reminder', JSON.stringify({ 
          eventId, 
          reminderType: 'day' 
        }));
      }, dayReminderDelay);
    }
    
    // Schedule hour-before reminder if there's still time
    if (hourBefore > currentTime) {
      const hourReminderDelay = hourBefore - currentTime;
      setTimeout(async () => {
        await redisClient.publish('event:reminder', JSON.stringify({ 
          eventId, 
          reminderType: 'hour' 
        }));
      }, hourReminderDelay);
    }
    
    return true;
  } catch (error) {
    console.error('Error in scheduleEventReminder:', error);
    return false;
  }
};

// Get notifications for a user
const getUserNotifications = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get notifications
    const notificationsResult = await db.query(
      `SELECT n.id, n.event_id, n.message, n.is_read, n.created_at, e.title as event_title
       FROM notifications n
       JOIN events e ON n.event_id = e.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
      [userId]
    );
    
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      notifications: notificationsResult.rows,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    throw error;
  }
};

// Mark a notification as read
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
    return true;
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    return false;
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (userId) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error);
    return false;
  }
};

module.exports = {
  notifyNewEvent,
  notifyEventUpdate,
  scheduleEventReminder,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
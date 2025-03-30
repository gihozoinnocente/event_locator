require('dotenv').config();
const redisClient = require('../config/redis');

/**
 * Notification Worker
 * 
 * This worker listens to the Redis pub/sub channel for notifications
 * and processes them. In a real-world application, this would send
 * emails, push notifications, or other types of alerts to users.
 */

// Process a notification
const processNotification = async (notification) => {
  try {
    console.log(`Processing ${notification.type} notification for user ${notification.userId}`);
    
    // In a real application, this would send emails or push notifications
    // For now, we'll just log the notification
    
    switch (notification.type) {
      case 'new_event':
        console.log(`New event notification: "${notification.eventTitle}" to user ${notification.username} (${notification.email})`);
        // sendEmail(notification.email, `New Event: ${notification.eventTitle}`, emailTemplate, notification.language);
        break;
        
      case 'event_update':
        console.log(`Event update notification: "${notification.eventTitle}" to user ${notification.username} (${notification.email})`);
        // sendEmail(notification.email, `Event Updated: ${notification.eventTitle}`, emailTemplate, notification.language);
        break;
        
      case 'upcoming_event':
        console.log(`Upcoming event reminder: "${notification.eventTitle}" to user ${notification.username} (${notification.email})`);
        // sendEmail(notification.email, `Reminder: ${notification.eventTitle} is tomorrow!`, emailTemplate, notification.language);
        break;
        
      default:
        console.log(`Unknown notification type: ${notification.type}`);
    }
  } catch (error) {
    console.error('Error processing notification:', error);
  }
};

// Start the worker
const startWorker = async () => {
  try {
    // Connect to Redis
    await redisClient.connect();
    
    console.log('Notification worker connected to Redis');
    
    // Subscribe to the notifications channel
    await redisClient.subscribe('notifications', (message) => {
      try {
        const notification = JSON.parse(message);
        processNotification(notification);
      } catch (error) {
        console.error('Error parsing notification message:', error);
      }
    });
    
    console.log('Notification worker subscribed to notifications channel');
    
    // Handle worker shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down notification worker');
      await redisClient.quit();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting notification worker:', error);
    process.exit(1);
  }
};

// Check for expired scheduled notifications (in a real application, this would be a separate worker)
const checkScheduledNotifications = async () => {
  try {
    // This is a simplified approach - in a real system, you'd use Redis Keyspace Notifications or a separate scheduling system
    const keys = await redisClient.keys('scheduled:*');
    
    for (const key of keys) {
      const notification = JSON.parse(await redisClient.get(key));
      
      // Process the notification
      await processNotification(notification);
      
      // Delete the key
      await redisClient.del(key);
    }
  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
};

// Start the worker if this file is run directly
if (require.main === module) {
  startWorker();
  
  // Check for scheduled notifications every minute
  setInterval(checkScheduledNotifications, 60 * 1000);
}

module.exports = {
  startWorker,
  processNotification
};
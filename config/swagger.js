const swaggerJsDoc = require('swagger-jsdoc');

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Locator API',
      version: '1.0.0',
      description: 'A RESTful API for location-based event discovery',
      license: {
        name: 'ISC License',
        url: 'https://opensource.org/licenses/ISC'
      },
      contact: {
        name: 'Developer',
        url: 'https://yourdomain.com',
        email: 'developer@yourdomain.com'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            preferredLanguage: { type: 'string' }
          }
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' }
              }
            },
            address: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            creator_id: { type: 'integer' },
            creator_name: { type: 'string' },
            categories: {
              type: 'array',
              items: { 
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            },
            ratings: {
              type: 'object',
              properties: {
                averageRating: { type: 'number' },
                reviewCount: { type: 'integer' }
              }
            }
          }
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            event_id: { type: 'integer' },
            user_id: { type: 'integer' },
            username: { type: 'string' },
            rating: { type: 'integer' },
            comment: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            event_id: { type: 'integer' },
            event_title: { type: 'string' },
            message: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  msg: { type: 'string' },
                  param: { type: 'string' },
                  location: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

module.exports = swaggerSpec;
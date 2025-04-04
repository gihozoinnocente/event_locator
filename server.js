const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const i18nextFsBackend = require('i18next-fs-backend');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

// Initialize Express app
const app = express();

// Import middleware and configurations
const errorHandler = require('./middleware/errorHandler');
require('./config/passport')(passport);

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const searchRoutes = require('./routes/search');

// Setup i18n
i18next
  .use(i18nextFsBackend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },
    detection: {
      order: ['querystring', 'cookie', 'header'],
      caches: ['cookie'],
    },
  });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(passport.initialize());
app.use(i18nextMiddleware.handle(i18next));

// Setup i18n
const setupI18n = require('./config/i18n');
app.use(setupI18n());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/search', searchRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Event Locator API Documentation",
  customfavIcon: "",
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  }
}));

// Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Internationalization guide
app.get('/api/i18n-guide', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Event Locator - Internationalization Guide</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          h2 { color: #0056b3; margin-top: 30px; }
          code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
          pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .example { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #0056b3; }
        </style>
      </head>
      <body>
        <h1>Event Locator - Internationalization Guide</h1>
        
        <p>This API supports multiple languages through i18next. Here's how you can test and use the internationalization features:</p>
        
        <h2>Supported Languages</h2>
        <ul>
          <li><strong>English (en)</strong> - Default</li>
          <li><strong>Spanish (es)</strong></li>
          <li><strong>French (fr)</strong></li>
        </ul>
        
        <h2>Testing Internationalization</h2>
        
        <h3>1. Using Accept-Language Header</h3>
        <p>Set the <code>Accept-Language</code> header in your requests:</p>
        <pre>Accept-Language: es</pre>
        
        <div class="example">
          <strong>Example:</strong><br>
          <code>curl -X GET http://localhost:5000/api/auth/i18n-test -H "Accept-Language: es"</code>
        </div>
        
        <h3>2. Using Query Parameter</h3>
        <p>Add the <code>lng</code> query parameter to your requests:</p>
        <pre>http://localhost:5000/api/auth/i18n-test?lng=fr</pre>
        
        <h3>3. Setting User Preferences</h3>
        <p>Users can set their preferred language during registration or by updating their profile:</p>
        <pre>
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "fullName": "Test User",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "preferredLanguage": "fr"
}</pre>
        
        <h2>Sample Response Comparison</h2>
        
        <table>
          <tr>
            <th>Language</th>
            <th>Welcome Message</th>
          </tr>
          <tr>
            <td>English (en)</td>
            <td>Welcome to Event Locator!</td>
          </tr>
          <tr>
            <td>Spanish (es)</td>
            <td>¡Bienvenido a Event Locator!</td>
          </tr>
          <tr>
            <td>French (fr)</td>
            <td>Bienvenue sur Event Locator !</td>
          </tr>
        </table>
        
        <h2>Quick Test</h2>
        <p>Use the dedicated endpoint to test internationalization:</p>
        <pre>GET /api/auth/i18n-test</pre>
        <p>This endpoint returns the welcome message and other translations in the requested language.</p>
        
        <h2>Translation Files</h2>
        <p>The translation files are located in the <code>locales</code> directory, organized by language code:</p>
        <pre>
locales/
├── en/                  # English translations
│   └── common.json      
├── es/                  # Spanish translations
│   └── common.json      
└── fr/                  # French translations
    └── common.json</pre>
        
        <p><a href="/api-docs">Return to API Documentation</a></p>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For testing purposes
module.exports = app;
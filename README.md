# Event Locator Application

A multi-user event locator application allowing users to discover events based on location and preferences. This application is built with Node.js, Express, PostgreSQL with PostGIS for geospatial capabilities, and Redis for asynchronous task processing.

## Features

- **User Management**: Secure user registration and login with password hashing. Users can set their location and preferred event categories.
- **Event Management**: Create, read, update, and delete events, including event details, location (latitude/longitude), date/time, and categories.
- **Location-Based Search**: Search functionality that allows users to find events within a specified radius of their location.
- **Category Filtering**: Filter events based on categories.
- **Multilingual Support (i18n)**: Support for multiple languages in the user interface.
- **Notification System**: Redis-based queue to send notifications about upcoming events that match user preferences.
- **Additional Features**:
  - Event ratings and reviews
  - Favoriting events
  - Comprehensive filtering and sorting options

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with PostGIS extension for geospatial data
- **Message Queue**: Redis Pub/Sub for asynchronous event notifications
- **Authentication**: JWT (JSON Web Tokens), bcrypt for password hashing
- **Internationalization**: i18next for multi-language support
- **Testing**: Jest for unit testing
- **Validation**: express-validator for input validation

## Prerequisites

Before running this application, make sure you have the following installed:

1. Node.js (v14 or higher)
2. PostgreSQL with PostGIS extension
3. Redis server
4. Git (optional)

## Installation

1. Clone the repository (or download the source code)

```bash
git clone https://github.com/yourusername/event-locator-app.git
cd event-locator-app
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory and add the following variables (modify as needed):

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_locator
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Default Radius for Location Search (in meters)
DEFAULT_SEARCH_RADIUS=10000
```

4. Set up the PostgreSQL database

```bash
# Create the database
createdb event_locator

# Install PostGIS extension (if not already installed)
# Run this command in your PostgreSQL client:
# CREATE EXTENSION postgis;
```

5. Start the application

```bash
# Start the development server
npm run dev

# Start the notification worker (in a separate terminal)
node src/workers/notification.worker.js
```

## Project Structure

```
event-locator-app/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── locales/          # i18n translation files
│   ├── middleware/       # Custom middleware
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── workers/          # Background workers
│   └── server.js         # Main application entry point
├── tests/                # Test files
├── .env                  # Environment variables (create this)
├── .gitignore            # Git ignore file
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in a user

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/location` - Update user location
- `PUT /api/users/preferences` - Update user category preferences
- `GET /api/users/favorites` - Get user's favorite events

### Events

- `POST /api/events` - Create a new event
- `GET /api/events` - Get all events with filtering options
- `GET /api/events/:id` - Get event by ID
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `POST /api/events/:id/rate` - Rate an event
- `POST /api/events/:id/favorite` - Toggle favorite status of an event

### Categories

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create a new category
- `PUT /api/categories/:id` - Update a category
- `DELETE /api/categories/:id` - Delete a category

## Testing

Run tests using Jest:

```bash
npm test
```

## Database Schema

The application uses the following database tables:

1. **users**: Stores user information, including their geographic location
2. **categories**: Event categories (e.g., Music, Sports, Business)
3. **events**: Event details, including location, date/time, and description
4. **event_categories**: Junction table for events and categories (many-to-many)
5. **user_category_preferences**: Junction table for user category preferences
6. **event_ratings**: User ratings and reviews for events
7. **user_favorite_events**: Junction table for user favorite events

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## License

This project is licensed under the ISC License.
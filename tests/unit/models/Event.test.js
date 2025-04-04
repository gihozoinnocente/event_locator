const Event = require('../../../models/Event');
const db = require('../../../config/database');

// Mock the database module
jest.mock('../../../config/database');

describe('Event Model', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return an event when found', async () => {
      // Mock location data
      const mockLocation = {
        coordinates: [10.1234, 20.5678]
      };
      
      // Mock database responses
      // First query - event details
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Test Event',
          description: 'Test Description',
          location: JSON.stringify(mockLocation),
          address: '123 Test St',
          start_time: new Date('2023-01-01T12:00:00Z'),
          end_time: new Date('2023-01-01T14:00:00Z'),
          creator_id: 1,
          creator_name: 'testuser',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });
      
      // Second query - event categories
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Music', description: 'Music events' },
          { id: 2, name: 'Sports', description: 'Sports events' }
        ]
      });
      
      // Third query - event ratings
      db.query.mockResolvedValueOnce({
        rows: [{ average_rating: '4.5', review_count: '10' }]
      });

      const event = await Event.findById(1);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT e.id, e.title'),
        [1]
      );
      expect(event).toHaveProperty('id', 1);
      expect(event).toHaveProperty('title', 'Test Event');
      expect(event.location).toEqual({
        latitude: 20.5678,
        longitude: 10.1234
      });
      expect(event.categories).toHaveLength(2);
      expect(event.categories[0]).toHaveProperty('name', 'Music');
      expect(event.ratings).toHaveProperty('averageRating', 4.5);
      expect(event.ratings).toHaveProperty('reviewCount', 10);
    });

    it('should return null when event not found', async () => {
      // Mock empty database response
      db.query.mockResolvedValue({
        rows: []
      });

      const event = await Event.findById(999);

      // Assertions
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [999]
      );
      expect(event).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new event and return it', async () => {
      // Mock database transaction methods
      db.query
        // First call - BEGIN transaction
        .mockResolvedValueOnce({})
        // Second call - INSERT event
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            title: 'New Event',
            description: 'New Description',
            location: JSON.stringify({ coordinates: [10.1234, 20.5678] }),
            address: '123 New St',
            start_time: new Date('2023-02-01T15:00:00Z'),
            end_time: new Date('2023-02-01T17:00:00Z'),
            creator_id: 1,
            created_at: new Date()
          }]
        })
        // Third call - INSERT categories
        .mockResolvedValueOnce({})
        // Fourth call - SELECT categories
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Music', description: 'Music events' },
            { id: 3, name: 'Tech', description: 'Tech events' }
          ]
        })
        // Fifth call - COMMIT transaction
        .mockResolvedValueOnce({});

      const eventData = {
        title: 'New Event',
        description: 'New Description',
        latitude: 20.5678,
        longitude: 10.1234,
        address: '123 New St',
        startTime: '2023-02-01T15:00:00Z',
        endTime: '2023-02-01T17:00:00Z',
        creatorId: 1,
        categoryIds: [1, 3]
      };

      const newEvent = await Event.create(eventData);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(5);
      expect(db.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(db.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          'New Event',
          'New Description',
          10.1234,
          20.5678,
          '123 New St'
        ])
      );
      expect(db.query).toHaveBeenNthCalledWith(5, 'COMMIT');
      expect(newEvent).toHaveProperty('id', 1);
      expect(newEvent).toHaveProperty('title', 'New Event');
      expect(newEvent.location).toEqual({
        latitude: 20.5678,
        longitude: 10.1234
      });
      expect(newEvent.categories).toHaveLength(2);
      expect(newEvent.categories[0]).toHaveProperty('name', 'Music');
      expect(newEvent.categories[1]).toHaveProperty('name', 'Tech');
    });

    it('should rollback transaction on error', async () => {
      // Mock BEGIN transaction
      db.query.mockResolvedValueOnce({});
      
      // Mock error on INSERT
      const error = new Error('Database error');
      db.query.mockRejectedValueOnce(error);
      
      // Mock ROLLBACK
      db.query.mockResolvedValueOnce({});

      const eventData = {
        title: 'New Event',
        description: 'New Description',
        latitude: 20.5678,
        longitude: 10.1234,
        address: '123 New St',
        startTime: '2023-02-01T15:00:00Z',
        endTime: '2023-02-01T17:00:00Z',
        creatorId: 1,
        categoryIds: [1, 3]
      };

      // Assertions
      await expect(Event.create(eventData)).rejects.toThrow('Database error');
      expect(db.query).toHaveBeenCalledWith('BEGIN');
      expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('search', () => {
    it('should search for events based on location and filters', async () => {
      // Mock database responses
      db.query
        // First call - SELECT events
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              title: 'Nearby Event',
              description: 'Event Description',
              location: JSON.stringify({ coordinates: [10.1234, 20.5678] }),
              address: '123 Test St',
              start_time: new Date('2023-03-01T12:00:00Z'),
              end_time: new Date('2023-03-01T14:00:00Z'),
              creator_id: 1,
              creator_name: 'testuser',
              created_at: new Date(),
              updated_at: new Date(),
              distance: 2.5
            }
          ]
        })
        // Second call - COUNT events
        .mockResolvedValueOnce({
          rows: [{ count: '1' }]
        })
        // Third call - SELECT categories
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Music', description: 'Music events' }
          ]
        })
        // Fourth call - SELECT ratings
        .mockResolvedValueOnce({
          rows: [{ average_rating: '4.0', review_count: '5' }]
        });

      const searchParams = {
        latitude: 20.6000,
        longitude: 10.2000,
        radius: 5,
        categoryIds: [1],
        page: 1,
        limit: 10
      };

      const results = await Event.search(searchParams);

      // Assertions
      expect(db.query).toHaveBeenCalledTimes(4);
      expect(results.events).toHaveLength(1);
      expect(results.events[0]).toHaveProperty('title', 'Nearby Event');
      expect(results.events[0]).toHaveProperty('distance', 2.5);
      expect(results.events[0].location).toEqual({
        latitude: 20.5678,
        longitude: 10.1234
      });
      expect(results.events[0].categories).toHaveLength(1);
      expect(results.events[0].categories[0]).toHaveProperty('name', 'Music');
      expect(results.pagination).toHaveProperty('total', 1);
      expect(results.pagination).toHaveProperty('page', 1);
      expect(results.pagination).toHaveProperty('limit', 10);
      expect(results.pagination).toHaveProperty('pages', 1);
    });
  });
});
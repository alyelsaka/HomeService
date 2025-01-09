const request = require('supertest');
const app = require('./server'); // Import the Express app
const db = require('./config/database'); // Import your database connection

// Helper function to clear the database before each test
async function clearDatabase() {
    // Delete rows from child tables first
    await db.query('DELETE FROM service_requests');
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM payments');
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM reviews');
    await db.query('DELETE FROM system_reports');

    // Now delete rows from parent tables
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM worker_profiles');
    await db.query('DELETE FROM services');
}

// Test Suite
describe('HomeServices API Tests', () => {
    let server; // To store the server instance
    let token; // To store the JWT token for authenticated requests
    let workerId = 1; // To store the ID of a worker for testing
    let serviceId; // To store the ID of a service for testing
    let bookingId; // To store the ID of a booking for testing

    // Start the server before running tests
    beforeAll(async () => {
        await clearDatabase(); // Clear the database before starting tests
        server = app.listen(5003); // Use a different port for testing
    });

    // Stop the server after running tests
    afterAll(async () => {
        await db.end(); // Close the database connection
        server.close(); // Close the server
    });

    // Test 1: User Registration
    it('should register a new user', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({
                full_name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                user_type: 'client',
                phonenumber: '1234567890'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe('Registration successful. Await admin approval if you are a worker.');
        console.log('Test 1: User registration passed.');
    });

    // Test 2: User Login
    it('should login a user and return a token', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'john@example.com',
                password: 'password123'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.token).toBeDefined();
        token = response.body.token; // Save the token for future requests
        console.log('Test 2: User login passed.');
    });

    // Test 3: Fetch Services
    it('should fetch services', async () => {
        const response = await request(app)
            .get('/api/services');

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 3: Fetch services passed.');
    });

    // Test 4: Fetch Bookings by Role (Client)
    it('should fetch client bookings', async () => {
        const response = await request(app)
            .get('/api/bookings/client')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 4: Fetch client bookings passed.');
    }, 10000); // Increase timeout for this test

    // Test 5: Fetch Bookings by Role (Worker)
    it('should fetch worker bookings', async () => {
        const response = await request(app)
            .get('/api/bookings/worker')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 5: Fetch worker bookings passed.');
    }, 10000); // Increase timeout for this test

    // Test 6: Create a New Service
    it('should create a new service', async () => {
        // Ensure the worker exists in the database
        await db.query('INSERT INTO users (id, full_name, email, password, user_type) VALUES (?, ?, ?, ?, ?)', [
            workerId,
            'Worker Name',
            'worker@example.com',
            'password123',
            'worker'
        ]);

        const response = await request(app)
            .post('/api/services')
            .send({
                rate_per_hour: 50.00,
                name: 'Plumbing Repair',
                worker_id: workerId,
                availability_start: '09:00',
                availability_end: '17:00',
                is_active: true
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe('Service created successfully!');
        serviceId = response.body.serviceId;
        console.log('Test 6: Create service passed.');
    });

    // Test 7: Fetch Available Services
    it('should fetch available services', async () => {
        const response = await request(app)
            .get('/api/services/available')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 7: Fetch available services passed.');
    });

    // Test 8: Book a Service
    it('should book a service', async () => {
        const response = await request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${token}`)
            .send({
                service_id: serviceId,
                booking_date: '2023-10-01',
                start_time: '10:00:00',
                end_time: '12:00:00'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Service booked successfully!');
        bookingId = response.body.bookingId;
        console.log('Test 8: Book service passed.');
    });

    // Test 9: Cancel a Booking
    it('should cancel a booking', async () => {
        const response = await request(app)
            .delete(`/api/bookings/cancel/${bookingId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Booking canceled successfully!');
        console.log('Test 9: Cancel booking passed.');
    });

    // Test 10: Reschedule a Booking
    it('should reschedule a booking', async () => {
        const response = await request(app)
            .put(`/api/bookings/reschedule/${bookingId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                newDate: '2023-10-02',
                newTime: '14:00:00'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Booking rescheduled successfully!');
        console.log('Test 10: Reschedule booking passed.');
    });

    // Test 11: Fetch Pending Workers
    it('should fetch pending workers', async () => {
        const response = await request(app)
            .get('/api/admin/workers/pending')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 11: Fetch pending workers passed.');
    });

    // Test 12: Approve a Worker
    it('should approve a worker', async () => {
        const response = await request(app)
            .post(`/api/admin/workers/approve/${workerId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Worker approved successfully!');
        console.log('Test 12: Approve worker passed.');
    });

    // Test 13: Reject a Worker
    it('should reject a worker', async () => {
        const response = await request(app)
            .post(`/api/admin/workers/reject/${workerId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Worker rejected successfully!');
        console.log('Test 13: Reject worker passed.');
    });

    // Test 14: Fetch Admin Reports
    it('should fetch admin reports', async () => {
        const response = await request(app)
            .get('/api/admin/reports')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 14: Fetch admin reports passed.');
    });

    // Test 15: Add a New Service (Worker)
    it('should add a new service as a worker', async () => {
        const response = await request(app)
            .post('/api/worker/services')
            .set('Authorization', `Bearer ${token}`)
            .send({
                worker_id: workerId,
                rate_per_hour: 60.00,
                availability_start: '09:00',
                availability_end: '17:00',
                is_active: true,
                description: 'Expert plumbing services'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe('Service added successfully!');
        console.log('Test 15: Add a new service as a worker passed.');
    });

    // Test 16: Fetch Worker Services
    it('should fetch worker services', async () => {
        const response = await request(app)
            .get('/api/worker/services')
            .query({ worker_id: workerId });

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThanOrEqual(0);
        console.log('Test 16: Fetch worker services passed.');
    });

    // Test 17: Fetch Worker Profile
    it('should fetch worker profile', async () => {
        const response = await request(app)
            .get('/api/worker/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toBeDefined();
        console.log('Test 17: Fetch worker profile passed.');
    });

    // Test 18: Create Worker Profile
    it('should create a worker profile', async () => {
        const response = await request(app)
            .post('/api/worker/create-profile')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(201);
        expect(response.body.message).toBe('Worker profile created successfully!');
        console.log('Test 18: Create worker profile passed.');
    });

    // Test 19: Fetch Worker ID
    it('should fetch worker ID', async () => {
        const response = await request(app)
            .get('/api/worker/id')
            .query({ user_id: workerId });

        expect(response.statusCode).toBe(200);
        expect(response.body.workerId).toBeDefined();
        console.log('Test 19: Fetch worker ID passed.');
    });

    // Test 20: Logout
    it('should logout the user', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Logout successful.');
        console.log('Test 20: Logout passed.');
    });
});
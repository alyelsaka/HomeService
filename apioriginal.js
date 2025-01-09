const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticate = require('../middleware/authenticate');

// Fetch services from the database
router.get('/services', (req, res) => {
    db.query('SELECT id, name, price AS rate_per_hour FROM services', (err, results) => {
        if (err) {
            console.error('Error fetching services:', err);
            return res.status(500).json({ message: 'Failed to fetch services.' });
        }
        res.json(results);
    });
});

// Fetch bookings based on the user role
router.get('/bookings/:role', authenticate, (req, res) => {
    const { role } = req.params; // Get role from request parameters
    const userId = req.user.userId; // Use logged-in user's ID from the token

    if (role === 'client') {
        // Fetch client bookings
        db.query(
            `SELECT bookings.id, services.name AS service, bookings.booking_date AS date, bookings.start_time, bookings.end_time, bookings.rate_per_hour, bookings.total_price
            FROM bookings
            JOIN services ON bookings.service_id = services.id
            WHERE bookings.client_id = ?`,
            [userId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching client bookings:', err);
                    return res.status(500).json({ message: 'Failed to fetch client bookings.' });
                }
                res.json(results);
            }
        );
    } else if (role === 'worker') {
        // Fetch worker bookings
        db.query(
            `SELECT bookings.id, services.name AS service, bookings.booking_date AS date, bookings.start_time, bookings.end_time, bookings.rate_per_hour, bookings.total_price
            FROM bookings
            JOIN services ON bookings.service_id = services.id
            WHERE bookings.worker_id = ?`,
            [userId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching worker bookings:', err);
                    return res.status(500).json({ message: 'Failed to fetch worker bookings.' });
                }
                res.json(results);
            }
        );
    } else {
        res.status(400).json({ message: 'Invalid role specified.' });
    }
});

// Create a new service
router.post('/services', async (req, res) => {
    try {
        const { rate_per_hour, name, worker_id, availability_start, availability_end, is_active } = req.body;

        // Only rate_per_hour is required
        if (!rate_per_hour) {
            return res.status(400).json({ message: 'Rate per hour is required.' });
        }

        // Set default values for optional fields
        const serviceName = name || 'General Service';
        const workerId = worker_id || null; // No default worker ID since no authentication
        const status = 'available';
        const availabilityStart = availability_start || '09:00';
        const availabilityEnd = availability_end || '17:00';
        const isActive = is_active || true;

        // Insert the service into the database
        const [result] = await db.query(
            'INSERT INTO services (name, price, worker_id, availability_start, availability_end, is_active, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [serviceName, rate_per_hour, workerId, availabilityStart, availabilityEnd, isActive, status]
        );

        res.status(201).json({
            message: 'Service created successfully!',
            serviceId: result.insertId,
        });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ message: 'Failed to create service.' });
    }
});

// Fetch available services
router.get('/services/available', authenticate, async (req, res) => {
    try {
        const [services] = await db.query(
            `SELECT services.id, services.name, services.price AS rate_per_hour, users.full_name AS worker_name
            FROM services
            JOIN users ON services.worker_id = users.id
            WHERE services.status = 'available'`
        );
        res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ message: 'Failed to fetch services.' });
    }
});

// Book a service
router.post('/bookings', authenticate, async (req, res) => {
    try {
        const { service_id, booking_date, start_time, end_time } = req.body;
        const clientId = req.user.userId;

        console.log('Booking Request:', { service_id, booking_date, start_time, end_time, clientId });

        // Validate input
        if (!service_id || !booking_date || !start_time || !end_time) {
            console.error('Missing required fields:', req.body);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Fetch service details to ensure it exists and is available
        const [service] = await db.query('SELECT * FROM services WHERE id = ?', [service_id]);
        if (!service.length) {
            console.error('Service not found:', service_id);
            return res.status(404).json({ message: 'Service not found.' });
        }

        // Check if the service is already booked
        if (service[0].status !== 'available') {
            console.error('Service not available:', service_id);
            return res.status(400).json({ message: 'Service is not available for booking.' });
        }

        // Calculate the duration in hours
        const start = new Date(`1970-01-01T${start_time}`);
        const end = new Date(`1970-01-01T${end_time}`);
        const durationInHours = (end - start) / (1000 * 60 * 60); // Convert milliseconds to hours

        // Fetch the rate_per_hour (stored as price in the services table)
        const ratePerHour = service[0].price;

        // Calculate the total price
        const totalPrice = durationInHours * ratePerHour;

        // Insert booking into the database
        const [result] = await db.query(
            'INSERT INTO bookings (client_id, service_id, booking_date, start_time, end_time, rate_per_hour, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [clientId, service_id, booking_date, start_time, end_time, ratePerHour, 'pending']
        );

        // Update the service status to 'booked'
        await db.query('UPDATE services SET status = ? WHERE id = ?', ['booked', service_id]);

        console.log('Booking successful:', result);

        res.status(200).json({
            message: 'Service booked successfully!',
            bookingId: result.insertId,
            totalPrice: totalPrice, // Return the calculated total price
        });
    } catch (error) {
        console.error('Error booking service:', error);
        res.status(500).json({ message: 'Failed to book service.' });
    }
});

// Fetch client bookings
router.get('/bookings', authenticate, async (req, res) => {
    try {
        const clientId = req.user.userId;

        const [bookings] = await db.query(
            `SELECT 
                bookings.id, 
                services.name AS service, 
                bookings.booking_date AS date, 
                bookings.start_time, 
                bookings.end_time, 
                bookings.rate_per_hour,
                bookings.total_price,
                users.phonenumber AS worker_phone
            FROM bookings
            JOIN services ON bookings.service_id = services.id
            JOIN users ON bookings.worker_id = users.id
            WHERE bookings.client_id = ?`,
            [clientId]
        );

        console.log('Bookings Response:', bookings);
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Failed to fetch bookings.' });
    }
});

// Cancel a booking
router.delete('/bookings/cancel/:bookingId', authenticate, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const workerId = req.user.userId;

        // Check if the booking belongs to the worker
        const [booking] = await db.query(
            'SELECT * FROM bookings WHERE id = ? AND worker_id = ?',
            [bookingId, workerId]
        );

        if (!booking.length) {
            return res.status(404).json({ message: 'Booking not found or you do not have permission to cancel it.' });
        }

        // Delete the booking
        await db.query('DELETE FROM bookings WHERE id = ?', [bookingId]);

        res.json({ message: 'Booking canceled successfully!' });
    } catch (error) {
        console.error('Error canceling booking:', error);
        res.status(500).json({ message: 'Failed to cancel booking.' });
    }
});
// Fetch pending workers for admin approval
router.get('/admin/workers/pending', authenticate, async (req, res) => {
    try {
        const [workers] = await db.query(
            `SELECT users.id, users.full_name, users.email, users.phonenumber, worker_profiles.service_type, worker_profiles.experience_years
            FROM worker_profiles
            JOIN users ON worker_profiles.user_id = users.id
            WHERE users.status = 'pending'`
        );
        res.json(workers);
    } catch (error) {
        console.error('Error fetching pending workers:', error);
        res.status(500).json({ message: 'Failed to fetch pending workers.' });
    }
});

// Approve a worker
router.post('/admin/workers/approve/:workerId', authenticate, async (req, res) => {
    try {
        const { workerId } = req.params;

        // Update worker status to 'active'
        await db.query('UPDATE users SET status = ? WHERE id = ?', ['active', workerId]);

        res.json({ message: 'Worker approved successfully!' });
    } catch (error) {
        console.error('Error approving worker:', error);
        res.status(500).json({ message: 'Failed to approve worker.' });
    }
});

// Reject a worker
router.post('/admin/workers/reject/:workerId', authenticate, async (req, res) => {
    try {
        const { workerId } = req.params;

        // Use a transaction to ensure atomicity
        await db.beginTransaction();

        // Delete from worker_profiles
        await db.query('DELETE FROM worker_profiles WHERE user_id = ?', [workerId]);

        // Delete from users
        await db.query('DELETE FROM users WHERE id = ?', [workerId]);

        await db.commit();

        res.json({ message: 'Worker rejected successfully!' });
    } catch (error) {
        await db.rollback();
        console.error('Error rejecting worker:', error);
        res.status(500).json({ message: 'Failed to reject worker.' });
    }
});

// Fetch admin reports
router.get('/admin/reports', authenticate, async (req, res) => {
    try {
        const [reports] = await db.query(
            `SELECT id, title, description, created_at
            FROM system_reports
            ORDER BY created_at DESC`
        );
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Failed to fetch reports.' });
    }
});

// Add a new service with worker's service type, availability, and active status
router.post('/worker/services', authenticate, async (req, res) => {
    try {
        const { worker_id, rate_per_hour, availability_start, availability_end, is_active, description } = req.body;

        // Validate required fields
        if (!worker_id || !rate_per_hour || !availability_start || !availability_end || !description) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Fetch worker's service type from the database
        const [workerProfile] = await db.query(
            'SELECT service_type FROM worker_profiles WHERE user_id = ?',
            [worker_id]
        );

        if (!workerProfile.length) {
            return res.status(404).json({ message: 'Worker profile not found.' });
        }

        const serviceType = workerProfile[0].service_type;

        // Insert the service into the database
        const [result] = await db.query(
            'INSERT INTO services (name, description, price, worker_id, availability_start, availability_end, is_active, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                serviceType, // Use the worker's service type as the service name
                description, // Description provided by the worker
                rate_per_hour, // Rate per hour provided by the worker
                worker_id,
                availability_start,
                availability_end,
                is_active || 1, // Default to active if not provided
                'available', // Default status
            ]
        );

        res.status(201).json({
            message: 'Service added successfully!',
            serviceId: result.insertId,
        });
    } catch (error) {
        console.error('Error adding service:', error);
        res.status(500).json({ message: 'Failed to add service. Please check the server logs.' });
    }
});

// Fetch worker's services
router.get('/worker/services', async (req, res) => {
    try {
        const { worker_id } = req.query;

        // Fetch services for the worker
        const [services] = await db.query(
            `SELECT id, name, price, availability_start, availability_end, status
             FROM services
             WHERE worker_id = ?`,
            [worker_id]
        );

        res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ message: 'Failed to fetch services.' });
    }
});

// Fetch worker ID based on user ID
router.get('/worker/id', async (req, res) => {
    try {
        const { user_id } = req.query;

        // Fetch the worker's ID from the database
        const [worker] = await db.query(
            'SELECT id FROM users WHERE id = ? AND user_type = "worker"',
            [user_id]
        );

        if (worker.length > 0) {
            res.json({ workerId: worker[0].id });
        } else {
            res.status(404).json({ message: 'Worker not found.' });
        }
    } catch (error) {
        console.error('Error fetching worker ID:', error);
        res.status(500).json({ message: 'Failed to fetch worker ID.' });
    }
});

// Automatically create a worker profile if it doesn't exist
router.post('/worker/create-profile', authenticate, async (req, res) => {
    try {
        const workerId = req.user.userId; // Get the logged-in worker's ID

        // Check if the worker profile already exists
        const [existingProfile] = await db.query(
            'SELECT * FROM worker_profiles WHERE user_id = ?',
            [workerId]
        );

        if (existingProfile.length > 0) {
            return res.status(200).json({ message: 'Worker profile already exists.' });
        }

        // Create a default worker profile
        const [result] = await db.query(
            'INSERT INTO worker_profiles (user_id, service_type, experience_years, status, rate_per_hour, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [workerId, 'plumber', 0, 'available', 0.00, 1] // Default values
        );

        res.status(201).json({
            message: 'Worker profile created successfully!',
            profileId: result.insertId,
        });
    } catch (error) {
        console.error('Error creating worker profile:', error);
        res.status(500).json({ message: 'Failed to create worker profile.' });
    }
});

// Fetch worker's profile
router.get('/worker/profile', authenticate, async (req, res) => {
    try {
        const workerId = req.user.userId; // Get the logged-in worker's ID

        // Fetch worker's profile from the database
        const [workerProfile] = await db.query(
            `SELECT users.id, users.full_name, users.email, users.phonenumber, worker_profiles.service_type
            FROM users
            JOIN worker_profiles ON users.id = worker_profiles.user_id
            WHERE users.id = ?`,
            [workerId]
        );

        if (!workerProfile.length) {
            return res.status(404).json({ message: 'Worker profile not found.' });
        }

        res.json(workerProfile[0]); // Return the worker's profile
    } catch (error) {
        console.error('Error fetching worker profile:', error);
        res.status(500).json({ message: 'Failed to fetch worker profile.' });
    }
});

module.exports = router;
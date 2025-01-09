const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Updated Authentication Middleware to use cookies
const authenticate = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1]; // Get token from cookie or header
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err); // Debugging
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user;
        next();
    });
};

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, user_type, phonenumber, service_type, experience_years } = req.body;

        // Validate input
        if (!full_name || !email || !password || !user_type || !phonenumber) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if user already exists
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password, user_type, phonenumber, status) VALUES (?, ?, ?, ?, ?, ?)',
            [full_name, email, hashedPassword, user_type, phonenumber, user_type === 'worker' ? 'pending' : 'active']
        );

        // If the user is a worker, insert into worker_profiles
        if (user_type === 'worker') {
            await db.query(
                'INSERT INTO worker_profiles (user_id, service_type, experience_years) VALUES (?, ?, ?)',
                [result.insertId, service_type, experience_years]
            );
        }

        res.status(201).json({
            message: 'Registration successful. Await admin approval if you are a worker.'
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Registration failed due to an internal error.' });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Retrieve user from database
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Check approval for workers
        if (user.user_type === 'worker' && user.status !== 'active') {
            return res.status(403).json({ message: 'Your account is awaiting admin approval.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, userType: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set the token in a cookie
        res.cookie('token', token, {
            httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
            secure: process.env.NODE_ENV === 'production', // Ensure cookies are only sent over HTTPS in production
            sameSite: 'strict', // Prevent CSRF attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Determine redirect URL based on user type
        const redirectUrl = getRedirectUrl(user.user_type);

        // Respond with success, token, and redirect URL
        res.json({
            message: 'Login successful.',
            redirectUrl,
            token,
            user: {
                id: user.id,
                name: user.full_name,
                role: user.user_type
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Login failed due to an internal error.' });
    }
});

// User Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful.' });
});

// Fetch logged-in user's details
router.get('/user', authenticate, async (req, res) => {
    try {
        // Fetch the user's details from the database
        const [user] = await db.query('SELECT id, full_name AS name, email, user_type FROM users WHERE id = ?', [req.user.userId]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ user: user[0] });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Failed to fetch user data.' });
    }
});

// Admin Endpoint to Approve Workers
router.post('/admin/approve-worker', async (req, res) => {
    try {
        const { workerId } = req.body;
        await db.query('UPDATE users SET status = "active" WHERE id = ?', [workerId]);
        res.json({ message: 'Worker approved successfully.' });
    } catch (error) {
        console.error('Worker Approval Error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Payment Endpoints

// Process Card Payments
router.post('/payments/process', async (req, res) => {
    try {
        const { cardNumber, expiryDate, cvv, amount, bookingId } = req.body;

        // Validate payment details
        if (!cardNumber || !expiryDate || !cvv || !amount || !bookingId) {
            return res.status(400).json({ message: 'All payment details are required.' });
        }

        // Simulate payment processing (replace with actual payment gateway integration)
        const paymentSuccess = simulatePaymentProcessing(cardNumber, expiryDate, cvv, amount);

        if (paymentSuccess) {
            await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['paid', bookingId]);
            res.json({ message: 'Payment processed successfully!' });
        } else {
            res.status(400).json({ message: 'Payment failed. Please try again.' });
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ message: 'Payment processing failed due to an internal error.' });
    }
});

// Confirm Cash Payments
router.post('/payments/cash', authenticate, async (req, res) => {
    try {
        const { bookingId } = req.body;

        // Validate booking ID
        if (!bookingId) {
            return res.status(400).json({ message: 'Booking ID is required.' });
        }

        // Check if the booking exists and belongs to the user
        const [booking] = await db.query('SELECT * FROM bookings WHERE id = ? AND client_id = ?', [bookingId, req.user.userId]);
        if (!booking.length) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Update booking status to 'pending_payment'
        await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['pending_payment', bookingId]);

        res.json({ message: 'Cash payment confirmed. Payment will be collected on service.' });
    } catch (error) {
        console.error('Cash payment confirmation error:', error);
        res.status(500).json({ message: 'Cash payment confirmation failed due to an internal error.' });
    }
});

// Helper function to get the redirect URL based on user type
function getRedirectUrl(userType) {
    switch (userType) {
        case 'admin':
            return '/dashboard-admin.html';
        case 'worker':
            return '/dashboard-worker.html';
        case 'client':
            return '/dashboard-client.html';
        default:
            return '/';
    }
}

// Fetch pending workers
router.get('/admin/workers/pending', async (req, res) => {
    try {
        const [workers] = await db.query(
            `SELECT users.id, users.full_name, users.email, worker_profiles.service_type, worker_profiles.experience_years
            FROM users
            JOIN worker_profiles ON users.id = worker_profiles.user_id
            WHERE users.user_type = 'worker' AND users.status = 'pending'`
        );
        res.json(workers);
    } catch (error) {
        console.error('Error fetching pending workers:', error);
        res.status(500).json({ message: 'Failed to fetch pending workers.' });
    }
});

// Approve a worker
router.post('/admin/workers/approve/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;
        await db.query('UPDATE users SET status = "active" WHERE id = ?', [workerId]);
        res.json({ message: 'Worker approved successfully!' });
    } catch (error) {
        console.error('Error approving worker:', error);
        res.status(500).json({ message: 'Failed to approve worker.' });
    }
});

// Reject a worker
router.post('/admin/workers/reject/:workerId', async (req, res) => {
    try {
        const { workerId } = req.params;

        // Use a transaction to ensure atomicity
        await db.beginTransaction();

        // Delete from worker_profiles
        await db.query('DELETE FROM worker_profiles WHERE user_id = ?', [workerId]);

        // Delete from bookings
        await db.query('DELETE FROM bookings WHERE worker_id = ?', [workerId]);

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

// Update worker availability
router.post('/worker/availability', authenticate, async (req, res) => {
    try {
        const { start, end } = req.body;
        const userId = req.user.userId;

        await db.query(
            'UPDATE worker_profiles SET availability_start = ?, availability_end = ? WHERE user_id = ?',
            [start, end, userId]
        );

        res.json({ message: 'Availability updated successfully!' });
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ message: 'Failed to update availability.' });
    }
});

// Update worker rate per hour
router.post('/worker/rate', authenticate, async (req, res) => {
    try {
        const { rate } = req.body;
        const userId = req.user.userId;

        await db.query(
            'UPDATE worker_profiles SET rate_per_hour = ? WHERE user_id = ?',
            [rate, userId]
        );

        res.json({ message: 'Rate updated successfully!' });
    } catch (error) {
        console.error('Error updating rate:', error);
        res.status(500).json({ message: 'Failed to update rate.' });
    }
});

// Update worker active status
router.post('/worker/active', authenticate, async (req, res) => {
    try {
        const { isActive } = req.body;
        const userId = req.user.userId;

        await db.query(
            'UPDATE worker_profiles SET is_active = ? WHERE user_id = ?',
            [isActive, userId]
        );

        res.json({ message: 'Active status updated successfully!' });
    } catch (error) {
        console.error('Error updating active status:', error);
        res.status(500).json({ message: 'Failed to update active status.' });
    }
});

// Fetch available workers
router.get('/workers/available', async (req, res) => {
    try {
        const { serviceType, availabilityStart, availabilityEnd } = req.query;

        let query = 
            `SELECT users.id, users.full_name, worker_profiles.service_type, worker_profiles.rate_per_hour, worker_profiles.availability_start, worker_profiles.availability_end
            FROM users
            JOIN worker_profiles ON users.id = worker_profiles.user_id
            WHERE worker_profiles.is_active = TRUE`;

        if (serviceType) {
            query += ` AND worker_profiles.service_type = '${serviceType}'`;
        }
        if (availabilityStart && availabilityEnd) {
            query += ` AND worker_profiles.availability_start <= '${availabilityStart}' AND worker_profiles.availability_end >= '${availabilityEnd}'`;
        }

        const [workers] = await db.query(query);
        res.json(workers);
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ message: 'Failed to fetch workers.' });
    }
});

// Fetch available services
router.get('/services/available', async (req, res) => {
    try {
        const [services] = await db.query(
            `SELECT services.id, services.name, services.price, users.full_name AS worker_name
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

// Book a worker
router.post('/workers/book', authenticate, async (req, res) => {
    try {
        const { workerId } = req.body;
        const clientId = req.user.userId;

        // Fetch worker availability
        const [worker] = await db.query('SELECT * FROM worker_profiles WHERE user_id = ?', [workerId]);
        if (!worker.length) {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        // Insert booking
        await db.query(
            'INSERT INTO bookings (client_id, worker_id, service_type, booking_date, start_time, end_time, rate_per_hour, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [clientId, workerId, worker[0].service_type, new Date(), worker[0].availability_start, worker[0].availability_end, worker[0].rate_per_hour, 'pending']
        );

        res.json({ message: 'Worker booked successfully!' });
    } catch (error) {
        console.error('Error booking worker:', error);
        res.status(500).json({ message: 'Failed to book worker.' });
    }
});
router.post('/workers/book', authenticate, async (req, res) => {
    try {
        const { workerId, serviceId } = req.body;
        const clientId = req.user.userId;

        const [worker] = await db.query(
            `SELECT * FROM worker_profiles WHERE user_id = ?`,
            [workerId]
        );

        if (!worker.length) {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        const [service] = await db.query(
            `SELECT * FROM services WHERE id = ?`,
            [serviceId]
        );

        if (!service.length) {
            return res.status(404).json({ message: 'Service not found.' });
        }

        await db.query(
            `INSERT INTO bookings (
                service_id, client_id, worker_id, booking_date, start_time, end_time, status, service_type, rate_per_hour
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                serviceId,
                clientId,
                workerId,
                new Date(),
                worker[0].availability_start,
                worker[0].availability_end,
                'pending',
                worker[0].service_type,
                worker[0].rate_per_hour
            ]
        );

        res.json({ message: 'Worker booked successfully!' });
    } catch (error) {
        console.error('Error booking worker:', error);
        res.status(500).json({ message: 'Failed to book worker.' });
    }
});
// Simulate payment processing
function simulatePaymentProcessing(cardNumber, expiryDate, cvv, amount) {
    // Simulate a successful payment for demonstration purposes
    return true;
}
// Add a new service
router.post('/services', authenticate, async (req, res) => {
    try {
        const { name, price, availability_start, availability_end, description } = req.body;
        const workerId = req.user.userId; // Get the worker's ID from the authenticated user

        // Validate input
        if (!name || !price || !availability_start || !availability_end || !description) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Insert the new service into the database
        await db.query(
            'INSERT INTO services (name, price, availability_start, availability_end, status, worker_id, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, availability_start, availability_end, 'available', workerId, description]
        );

        res.status(201).json({ message: 'Service added successfully!' });
    } catch (error) {
        console.error('Error adding service:', error);
        res.status(500).json({ message: 'Failed to add service.' });
    }
});

module.exports = router;
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const db = require('./config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware and setup
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5002',
    credentials: true,
}));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure all required environment variables are present
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

console.log('Environment Variables Loaded:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASS:', process.env.DB_PASS ? '********' : 'Not Set');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('PORT:', process.env.PORT || 5002);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '********' : 'Not Set');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:5002');

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// Use routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes); // Mount API routes under /api

// Authentication Middleware
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

// Root Route
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err.message);
            res.status(500).send('Error loading the homepage.');
        }
    });
});

// Define the router
const router = express.Router();

// Worker Booking Route
router.post('/workers/book', authenticate, async (req, res) => {
    try {
        const { workerId, serviceId } = req.body;
        const clientId = req.user.userId;

        // Fetch worker details
        const [worker] = await db.query(
            `SELECT * FROM worker_profiles WHERE user_id = ?`,
            [workerId]
        );

        if (!worker.length) {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        // Fetch service details
        const [service] = await db.query(
            `SELECT * FROM services WHERE id = ?`,
            [serviceId]
        );

        if (!service.length) {
            return res.status(404).json({ message: 'Service not found.' });
        }

        // Insert booking into the database
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

// Mount the router under the /api path
app.use('/api', router);

// Export the app for testing
module.exports = app;

// Start the server only if this file is run directly (not when imported)
if (require.main === module) {
    const PORT = process.env.PORT || 5002;

    // Test database connection
    db.query('SELECT 1')
        .then(() => {
            console.log('Connected to the MySQL database successfully.');

            // Start the server only after the database connection is successful
            const server = app.listen(PORT, () => {
                console.log(`Server is running on http://localhost:${PORT}`);
            });

            // Graceful shutdown
            process.on('SIGINT', () => {
                console.log('\nGracefully shutting down...');
                server.close(() => {
                    console.log('Server has been shut down.');
                    process.exit(0);
                });
            });

            process.on('SIGTERM', () => {
                console.log('\nProcess terminated.');
                server.close(() => {
                    console.log('Server has been shut down.');
                    process.exit(0);
                });
            });
        })
        .catch((err) => {
            console.error('Error connecting to the database:', err.message);
            process.exit(1);
        });
}

// Authentication Routes
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

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

        // Return success response with token and user type
        res.json({ message: 'Login successful.', token, userType: user.user_type });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Login failed.' });
    }
});

// User Registration
app.post('/auth/register', async (req, res) => {
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

// Fetch logged-in user's details
app.get('/auth/user', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [user] = await db.query('SELECT id, full_name AS name, email, user_type FROM users WHERE id = ?', [userId]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({ user: user[0] });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Failed to fetch user data.' });
    }
});

// Fetch available workers
app.get('/auth/workers/available', authenticate, async (req, res) => {
    try {
        const [workers] = await db.query(
            `SELECT 
                users.id, 
                users.full_name, 
                users.email, 
                worker_profiles.service_type, 
                worker_profiles.rate_per_hour, 
                worker_profiles.availability_start, 
                worker_profiles.availability_end
            FROM users
            JOIN worker_profiles ON users.id = worker_profiles.user_id
            WHERE users.user_type = 'worker' AND users.status = 'active'`
        );
        console.log('Workers Data:', workers); // Debugging: Log the fetched data
        res.json(workers);
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ message: 'Failed to fetch workers.' });
    }
});

// Fetch available services
app.get('/auth/services/available', authenticate, async (req, res) => {
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

// Fetch client bookings
app.get('/bookings', authenticate, async (req, res) => {
    try {
        const clientId = req.user.userId;

        const [bookings] = await db.query(
            `SELECT bookings.id, services.name AS service, bookings.booking_date AS date, bookings.start_time, bookings.end_time, bookings.rate_per_hour AS price
            FROM bookings
            JOIN services ON bookings.service_id = services.id
            WHERE bookings.client_id = ?`,
            [clientId]
        );

        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ message: 'Failed to fetch bookings.' });
    }
});
// Password Reset Endpoint
app.post('/auth/reset-password', async (req, res) => {
    try {
        const { email, phonenumber, newPassword } = req.body;

        // Validate input
        if (!email || !phonenumber || !newPassword) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if the user exists with the provided email and phone number
        const [users] = await db.query('SELECT * FROM users WHERE email = ? AND phonenumber = ?', [email, phonenumber]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found or phone number does not match.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

        res.json({ message: 'Password reset successful!' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
});
// Cancel a booking
app.delete('/api/bookings/cancel/:bookingId', authenticate, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const workerId = req.user.userId; // Get the logged-in worker's ID

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

// Fetch client payments
app.get('/payments', authenticate, async (req, res) => {
    try {
        const clientId = req.user.userId;

        const [payments] = await db.query('SELECT * FROM payments WHERE service_request_id IN (SELECT id FROM service_requests WHERE client_id = ?)', [clientId]);

        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Failed to fetch payments.' });
    }
});

// Fetch client notifications
app.get('/notifications', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [notifications] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [userId]);

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});

// Fetch reviews
app.get('/reviews', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [reviews] = await db.query(
            `SELECT reviews.id, services.name AS service, reviews.rating, reviews.comment, reviews.created_at
            FROM reviews
            JOIN bookings ON reviews.booking_id = bookings.id
            JOIN services ON bookings.service_id = services.id
            WHERE bookings.client_id = ?`,
            [userId]
        );

        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Failed to fetch reviews.' });
    }
});

// Admin Endpoint to Approve Workers
app.post('/auth/admin/workers/approve/:workerId', authenticate, async (req, res) => {
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
app.post('/auth/admin/workers/reject/:workerId', authenticate, async (req, res) => {
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
app.post('/auth/worker/availability', authenticate, async (req, res) => {
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
app.post('/auth/worker/rate', authenticate, async (req, res) => {
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
app.post('/auth/worker/active', authenticate, async (req, res) => {
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

// Fetch pending workers
app.get('/auth/admin/workers/pending', authenticate, async (req, res) => {
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

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({ message: 'Page not found.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ message: 'Something went wrong.' });
});

// Fetch all services
app.get('/services/all', authenticate, async (req, res) => {
    try {
        const [services] = await db.query(
            `SELECT services.id, services.name, services.price, users.full_name AS worker_name
            FROM services
            JOIN users ON services.worker_id = users.id`
        );
        res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ message: 'Failed to fetch services.' });
    }
});

// Delete a service
app.delete('/services/delete/:serviceId', authenticate, async (req, res) => {
    try {
        const { serviceId } = req.params;
        await db.query('DELETE FROM services WHERE id = ?', [serviceId]);
        res.json({ message: 'Service deleted successfully!' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ message: 'Failed to delete service.' });
    }
});

// Fetch admin reports
app.get('/admin/reports', authenticate, async (req, res) => {
    try {
        const [reports] = await db.query('SELECT * FROM system_reports');
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Failed to fetch reports.' });
    }
});

// Logout route for client
app.post('/auth/logout', (req, res) => {
    // Clear the token cookie
    res.clearCookie('token');
    res.status(200).json({ message: 'Logout successful' });
});
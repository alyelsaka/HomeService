// Updated Server.js with full connectivity
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

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
console.log('PORT:', process.env.PORT || 3000);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '********' : 'Not Set');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Helper Functions
function authenticateRole(role) {
    return (req, res, next) => {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ message: 'Forbidden' });
            if (user.userType !== role) return res.status(403).json({ message: 'Forbidden' });
            req.user = user;
            next();
        });
    };
}

// Root Route: Serve default index.html
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'indx.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving indx.html:', err.message);
            res.status(500).send('Error loading the homepage.');
        }
    });
});

// Test database connection
db.query('SELECT 1')
    .then(() => {
        console.log('Connected to the MySQL database successfully.');

        // Start the server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        }).on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please use a different port.`);
                process.exit(1);
            } else {
                console.error('Error starting server:', err.message);
                process.exit(1);
            }
        });
    })
    .catch((err) => {
        console.error('Error connecting to the database:', err.message);
        process.exit(1);
    });

// Authentication Routes
app.post('/auth/login', async (req, res) => {
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

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, userType: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set cookie with the token
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });

        // Determine redirect URL based on user role
        let redirectUrl;
        switch (user.user_type) {
            case 'admin':
                redirectUrl = '/dashboard-admin.html';
                break;
            case 'worker':
                redirectUrl = '/dashboard-worker.html';
                break;
            case 'client':
                redirectUrl = '/dashboard-client.html';
                break;
            default:
                redirectUrl = '/';
        }

        // Respond with success and redirect URL
        res.json({
            message: 'Login successful.',
            redirectUrl,
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

// Registration Route
app.post('/auth/register', async (req, res) => {
    try {
        const { full_name, email, password, user_type, service_type, experience_years } = req.body;

        // Validate input
        if (!full_name || !email || !password || !user_type) {
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
            'INSERT INTO users (full_name, email, password, user_type, status) VALUES (?, ?, ?, ?, ?)',
            [
                full_name,
                email,
                hashedPassword,
                user_type,
                user_type === 'worker' ? 'pending' : 'active' // Workers require admin approval
            ]
        );

        // If the user is a worker, insert into worker_profiles table
        if (user_type === 'worker') {
            if (!service_type || !experience_years) {
                return res.status(400).json({ message: 'Service type and experience years are required for workers.' });
            }

            await db.query(
                'INSERT INTO worker_profiles (user_id, service_type, experience_years) VALUES (?, ?, ?)',
                [
                    result.insertId, // Get the newly inserted user ID
                    service_type,
                    experience_years
                ]
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

// Admin Routes
app.get('/admin/verifications', authenticateRole('admin'), async (req, res) => {
    try {
        const [workers] = await db.query(
            'SELECT id, full_name, email FROM users WHERE user_type = ? AND status = ?',
            ['worker', 'pending']
        );
        res.json(workers);
    } catch (error) {
        console.error('Verification Fetch Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.post('/admin/approve-worker', authenticateRole('admin'), async (req, res) => {
    try {
        const { workerId } = req.body;
        await db.query('UPDATE users SET approved = 1 WHERE id = ?', [workerId]);
        res.json({ message: 'Worker approved successfully' });
    } catch (error) {
        console.error('Worker Approval Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Client Routes
app.get('/api/services', async (req, res) => {
    try {
        const [services] = await db.query('SELECT id, name, price, rating, booked FROM services WHERE booked = 0');
        res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ message: 'Failed to fetch services from the database.' });
    }
});

app.post('/services/book', authenticateRole('client'), async (req, res) => {
    try {
        const { serviceId } = req.body;
        const clientId = req.user.userId;

        // Mark service as booked
        await db.query(
            'UPDATE services SET status = ?, booked_by = ? WHERE id = ?',
            ['booked', clientId, serviceId]
        );
        res.json({ message: 'Service booked successfully' });
    } catch (error) {
        console.error('Service Booking Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
app.get('/admin/reports', authenticateRole('admin'), async (req, res) => {
    try {
        const [reports] = await db.query('SELECT id, title, description FROM system_reports');
        res.json(reports);
    } catch (error) {
        console.error('System Reports Fetch Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Worker Routes
app.get('/worker/bookings', authenticateRole('worker'), async (req, res) => {
    try {
        const workerId = req.user.userId;
        const [bookings] = await db.query('SELECT * FROM services WHERE booked = 1 AND worker_id = ?', [workerId]);
        res.json(bookings);
    } catch (error) {
        console.error('Worker Bookings Fetch Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/worker/availability', authenticateRole('worker'), async (req, res) => {
    try {
        const { availability } = req.body;
        const workerId = req.user.workerId; // Example correction

erId;

        // Update worker availability
        await db.query('UPDATE users SET availability = ? WHERE id = ?', [availability, workerId]);
        res.json({ message: 'Availability updated successfully' });
    } catch (error) {
        console.error('Worker Availability Update Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Payment Endpoints
app.post('/payments/process', async (req, res) => {
    try {
        const { cardNumber, expiryDate, cvv, amount, bookingId } = req.body;

        // Validate payment details
        if (!cardNumber || !expiryDate || !cvv || !amount || !bookingId) {
            return res.status(400).json({ message: 'All payment details are required.' });
        }

        // Simulate payment processing (replace with actual payment gateway integration)
        const paymentSuccess = true; // Assume payment is successful for this example

        if (paymentSuccess) {
            // Update booking status to 'paid'
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

app.post('/payments/cash', async (req, res) => {
    try {
        const { bookingId } = req.body;

        // Validate booking ID
        if (!bookingId) {
            return res.status(400).json({ message: 'Booking ID is required.' });
        }

        // Update booking status to 'pending_payment'
        await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['pending_payment', bookingId]);

        res.json({ message: 'Cash payment confirmed. Payment will be collected on service.' });
    } catch (error) {
        console.error('Cash payment confirmation error:', error);
        res.status(500).json({ message: 'Cash payment confirmation failed due to an internal error.' });
    }
});

// Logout Route
app.post('/auth/logout', (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set to true in production
            sameSite: 'strict', // Prevent CSRF attacks
        });

        // Respond with success
        res.json({ message: 'Logout successful.' });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ message: 'Logout failed due to an internal error.' });
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

// Graceful shutdown for process termination
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nProcess terminated.');
    process.exit(0);
});
// Logout Route
// Logout Route
app.post('/auth/logout', (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set to true in production
            sameSite: 'strict', // Prevent CSRF attacks
        });

        // Respond with success
        res.json({ message: 'Logout successful.' });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({ message: 'Logout failed due to an internal error.' });
    }
});
// Updated auth.js with enhanced functionality
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, user_type } = req.body;

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
        await db.query(
            'INSERT INTO users (full_name, email, password, user_type, approved) VALUES (?, ?, ?, ?, ?)',
            [
                full_name,
                email,
                hashedPassword,
                user_type,
                user_type === 'worker' ? 0 : 1 // Workers require admin approval
            ]
        );

        res.status(201).json({
            message: 'Registration successful. Await admin approval if you are a worker.'
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Registration failed due to an internal error.' });
    }
});

// User Login
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
        if (user.user_type === 'worker' && user.approved === 0) {
            return res.status(403).json({ message: 'Your account is awaiting admin approval.' });
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
        const redirectUrl = getRedirectUrl(user.user_type);

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

// User Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful.' });
});

// Admin Endpoint to Approve Workers
router.post('/admin/approve-worker', async (req, res) => {
    try {
        const { workerId } = req.body;
        await db.query('UPDATE users SET approved = 1 WHERE id = ?', [workerId]);
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

        // Simulate payment processing
        const paymentSuccess = true; // Replace with actual payment gateway integration

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

// Confirm Cash Payments
router.post('/payments/cash', async (req, res) => {
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

module.exports = router;
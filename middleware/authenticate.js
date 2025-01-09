const jwt = require('jsonwebtoken');
require('dotenv').config();

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
        req.user = user; // Attach the decoded user object to the request
        next();
    });
};

module.exports = authenticate;
const jwt = require('jsonwebtoken');

const authMiddleware = {
    verifyToken: (req, res, next) => {
        const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            res.status(401).json({ message: 'Invalid token' });
        }
    },

    checkUserType: (allowedTypes) => {
        return (req, res, next) => {
            if (!allowedTypes.includes(req.user.userType)) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }
            next();
        };
    }
};

module.exports = authMiddleware;
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASS || 'NewSecurePassword',
    database: process.env.DB_NAME || 'home_services',
};

console.log('Database Config:', dbConfig);

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Export the pool for use in other parts of the application
module.exports = pool;

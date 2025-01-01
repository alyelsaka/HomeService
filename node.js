const bcrypt = require('bcrypt');

(async () => {
    const hashedPassword = '$2b$10$hashedPasswordValue'; // Replace with the actual hashed password from the database
    const isValid = await bcrypt.compare('123', hashedPassword);
    console.log('Password is valid:', isValid);
})();
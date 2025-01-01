const bcrypt = require('bcrypt');

(async () => {
    try {
        const password = '123'; // Set the password to '123'

        // Step 1: Generate a hashed password
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Hashed Password:', hashedPassword);

        // Step 2: Verify the password against the hashed value
        const isValid = await bcrypt.compare(password, hashedPassword);
        console.log('Password is valid:', isValid);
    } catch (error) {
        console.error('Error hashing or verifying password:', error);
    }
})();
const bcrypt = require('bcrypt');

const passwords = ['worker1', 'worker2', 'worker3', 'worker4', 'worker5'];

(async () => {
    for (const [index, password] of passwords.entries()) {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(`Hashed Password ${index + 1}:`, hashedPassword);
    }
})();

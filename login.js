document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include', // Ensure cookies are sent with the request
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Login successful. Redirecting to dashboard...');

            // Redirect to the appropriate dashboard based on user type
            if (data.userType === 'admin') {
                window.location.href = '/admin-dashboard.html';
            } else if (data.userType === 'worker') {
                window.location.href = '/dashboard-worker.html';
            } else if (data.userType === 'client') {
                window.location.href = '/dashboard-client.html';
            } else {
                window.location.href = '/'; // Default redirect
            }
        } else {
            const errorData = await response.json();
            console.error('Login failed. Server response:', errorData);
            alert(`Login failed: ${errorData.message || 'Please check your credentials.'}`);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed due to an internal error.');
    }
});
document.addEventListener("DOMContentLoaded", () => {
    fetchWorkerData();
    loadBookings();
    setupAvailabilityUpdate();
    setupRateUpdate();
    setupActiveStatusToggle();
});

// Function to get the token from the cookie
function getTokenFromCookie() {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';').map(cookie => cookie.trim());
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    if (tokenCookie) {
        return tokenCookie.split('=')[1];
    }
    return null;
}

// Fetch worker data
async function fetchWorkerData() {
    try {
        const token = getTokenFromCookie(); // Get token from cookie
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/auth/user', {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include', // Ensure cookies are sent with the request
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('workerNamePlaceholder').textContent = data.user?.name || 'Worker';
        } else {
            window.location.href = '/login.html'; // Redirect to login if token is invalid
        }
    } catch (error) {
        console.error('Error fetching worker data:', error);
    }
}

// Load worker bookings
function loadBookings() {
    const token = getTokenFromCookie(); // Get token from cookie
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    fetch('/worker/bookings', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(response => response.json())
        .then(bookings => {
            const container = document.getElementById('bookingsContainer');
            container.innerHTML = bookings.length
                ? bookings.map(booking => `
                    <div class="booking-card">
                        <h3>${booking.service}</h3>
                        <p>Client: ${booking.client_name}</p>
                        <p>Date: ${booking.date}</p>
                        <p>Time: ${booking.start_time} - ${booking.end_time}</p>
                        <p>Rate: $${booking.rate_per_hour}/hour</p>
                        <button onclick="markComplete(${booking.id})">Mark as Complete</button>
                        <button onclick="cancelBooking(${booking.id})">Cancel</button>
                    </div>`).join('')
                : '<p>No bookings yet.</p>';
        })
        .catch(error => {
            console.error('Error loading bookings:', error);
            document.getElementById('bookingsContainer').innerHTML = '<p>Failed to load bookings.</p>';
        });
}

// Mark booking as complete
function markComplete(bookingId) {
    const token = getTokenFromCookie(); // Get token from cookie
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    fetch(`/worker/bookings/complete/${bookingId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(() => loadBookings())
        .catch(error => console.error('Error marking booking complete:', error));
}

// Cancel a booking
function cancelBooking(bookingId) {
    const token = getTokenFromCookie(); // Get token from cookie
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    fetch(`/worker/bookings/cancel/${bookingId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(() => loadBookings())
        .catch(error => console.error('Error canceling booking:', error));
}

// Setup availability form submission
function setupAvailabilityUpdate() {
    const availabilityForm = document.getElementById('availability-form');
    if (!availabilityForm) return;

    availabilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = getTokenFromCookie(); // Get token from cookie
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const start = document.getElementById('start-time').value;
        const end = document.getElementById('end-time').value;

        try {
            const response = await fetch('/worker/availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ start, end })
            });

            if (response.ok) {
                alert('Availability updated successfully!');
            } else {
                alert('Failed to update availability.');
            }
        } catch (error) {
            console.error('Error updating availability:', error);
        }
    });
}

// Setup rate per hour form submission
function setupRateUpdate() {
    const rateForm = document.getElementById('rate-form');
    if (!rateForm) return;

    rateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = getTokenFromCookie(); // Get token from cookie
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const rate = document.getElementById('rate').value;

        try {
            const response = await fetch('/worker/rate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rate })
            });

            if (response.ok) {
                alert('Rate updated successfully!');
            } else {
                alert('Failed to update rate.');
            }
        } catch (error) {
            console.error('Error updating rate:', error);
        }
    });
}

// Setup active status toggle
function setupActiveStatusToggle() {
    const activeToggle = document.getElementById('active-toggle');
    if (!activeToggle) return;

    activeToggle.addEventListener('change', async (e) => {
        const token = getTokenFromCookie(); // Get token from cookie
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const isActive = e.target.checked;

        try {
            const response = await fetch('/worker/active', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isActive })
            });

            if (response.ok) {
                alert('Active status updated successfully!');
            } else {
                alert('Failed to update active status.');
            }
        } catch (error) {
            console.error('Error updating active status:', error);
        }
    });
}

// Logout function
function logout() {
    const token = getTokenFromCookie(); // Get token from cookie
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(() => {
            // Clear the token cookie
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/login.html';
        })
        .catch(error => console.error('Error during logout:', error));
}
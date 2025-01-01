document.addEventListener("DOMContentLoaded", () => {
    fetchWorkerData();
    loadBookings();
    setupAvailabilityUpdate();
});

// Fetch worker data
async function fetchWorkerData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/auth/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('workerNamePlaceholder').textContent = data.user?.name || 'Worker';
        } else {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error fetching worker data:', error);
    }
}

// Load worker bookings
function loadBookings() {
    fetch('/worker/bookings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
    fetch(`/worker/bookings/complete/${bookingId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(() => loadBookings())
        .catch(error => console.error('Error marking booking complete:', error));
}

// Cancel a booking
function cancelBooking(bookingId) {
    fetch(`/worker/bookings/cancel/${bookingId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(() => loadBookings())
        .catch(error => console.error('Error canceling booking:', error));
}

// Setup availability form submission
function setupAvailabilityUpdate() {
    const availabilityForm = document.getElementById('availability-form');
    if (!availabilityForm) return; // Ensure form exists

    availabilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = document.getElementById('start-time').value;
        const end = document.getElementById('end-time').value;

        try {
            const response = await fetch('/worker/availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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

// Logout function
function logout() {
    fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(() => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        })
        .catch(error => console.error('Error during logout:', error));
}

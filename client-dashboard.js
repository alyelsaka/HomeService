document.addEventListener("DOMContentLoaded", () => {
    fetchUserData(); // Fetch and display the logged-in user's data
    loadServices(); // Load available services
    loadBookings(); // Load upcoming bookings
    loadNotifications(); // Load notifications
    loadReviews(); // Load service reviews
});

// Fetch user data after login
async function fetchUserData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/auth/user', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('username').textContent = data.user?.name || 'User';
        } else {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

// Load available services
function loadServices() {
    fetch('/services/available')
        .then(response => response.json())
        .then(services => {
            const container = document.getElementById('services-container');
            container.innerHTML = services.length
                ? services.map(service => `
                    <div class="service-card">
                        <h3>${service.name}</h3>
                        <p>Provider: ${service.worker_name}</p>
                        <p>Price: $${service.price}</p>
                        <button onclick="bookService(${service.id})">Book Now</button>
                    </div>`).join('')
                : '<p>No services available.</p>';
        })
        .catch(error => console.error('Error loading services:', error));
}

// Book a service
async function bookService(serviceId) {
    try {
        const response = await fetch('/services/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ serviceId })
        });

        if (response.ok) {
            alert('Service booked successfully!');
            loadServices();
            loadBookings();
        } else {
            alert('Error booking service.');
        }
    } catch (error) {
        console.error('Error booking service:', error);
    }
}

// Additional functions for bookings, notifications, reviews, and logout remain the same as provided.


// Load upcoming bookings
function loadBookings() {
    fetch('/bookings')
        .then(response => response.json())
        .then(bookings => {
            const container = document.getElementById('bookings-container');
            container.innerHTML = ''; // Clear existing bookings
            bookings.forEach(booking => {
                const card = document.createElement('div');
                card.classList.add('booking-card');
                card.innerHTML = `
                    <h3>${booking.service}</h3>
                    <p>Date: ${booking.date}</p>
                    <p>Time: ${booking.time}</p>
                    <p>Price: $${booking.price}</p>
                    <button onclick="rescheduleBooking(${booking.id})">Reschedule</button>
                    <button onclick="cancelBooking(${booking.id})">Cancel</button>
                `;
                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error loading bookings:', error);
        });
}

// Reschedule a booking
function rescheduleBooking(bookingId) {
    alert(`Rescheduling booking ID: ${bookingId}`);
    // Add logic for rescheduling
}

// Cancel a booking
function cancelBooking(bookingId) {
    fetch(`/bookings/cancel/${bookingId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(result => {
            if (response.ok) {
                alert(result.message);
                loadBookings(); // Refresh bookings
            } else {
                alert(result.message || 'Failed to cancel booking.');
            }
        })
        .catch(error => {
            console.error('Error cancelling booking:', error);
        });
}

// Load notifications
function loadNotifications() {
    fetch('/notifications')
        .then(response => response.json())
        .then(notifications => {
            const container = document.getElementById('notifications-container');
            container.innerHTML = ''; // Clear existing notifications
            notifications.forEach(notification => {
                const card = document.createElement('div');
                card.classList.add('notification-card');
                card.innerHTML = `
                    <p>${notification.message}</p>
                    <p>${notification.timestamp}</p>
                `;
                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
        });
}

// Load service reviews
function loadReviews() {
    fetch('/reviews')
        .then(response => response.json())
        .then(reviews => {
            const container = document.getElementById('reviews-container');
            container.innerHTML = ''; // Clear existing reviews
            reviews.forEach(review => {
                const card = document.createElement('div');
                card.classList.add('review-card');
                card.innerHTML = `
                    <h3>${review.service}</h3>
                    <p>Rating: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p>
                    <p>${review.comment}</p>
                `;
                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error loading reviews:', error);
        });
}

// Logout function
function logout() {
    fetch('/auth/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(() => {
            localStorage.removeItem('token'); // Clear token
            window.location.href = '/login.html'; // Redirect to login page
        })
        .catch(error => {
            console.error('Logout failed:', error);
        });
}

// Handle search services
function searchServices() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) {
        alert('Please enter a search term.');
        return;
    }
    alert(`Searching for: ${query}`);
    // Add logic to fetch and display search results
}
// Wait for DOM to load before executing any script
document.addEventListener("DOMContentLoaded", () => {
    fetchClientData();
    searchServices();
    loadBookings();
    loadReviews();
    loadPaymentMethods();
});

//fetching client data
async function fetchClientData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        // Fetch the user's data from the backend
        const response = await fetch('/auth/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            // Update the client's name in the top right corner
            document.getElementById('clientNamePlaceholder').textContent = data.user?.name || 'Client';
        } else {
            // If the token is invalid, redirect to the login page
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error fetching client data:', error);
    }
}

// Search for services
async function searchServices() {
    const searchTerm = document.getElementById('serviceSearchInput').value;
    const container = document.getElementById('servicesContainer');
    container.innerHTML = '<p>Loading services...</p>';
    try {
        const response = await fetch(`/services/search?query=${searchTerm}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        container.innerHTML = ''; // Clear existing content
        data.forEach(service => {
            const card = document.createElement('div');
            card.classList.add('service-card');
            card.innerHTML = `
                <div class="service-header">
                    <h3>${service.name}</h3>
                </div>
                <div class="service-details">
                    <p><i class="fas fa-user"></i> Provider: ${service.provider}</p>
                    <p><i class="fas fa-star"></i> Rating: ${service.rating}</p>
                    <p><i class="fas fa-clock"></i> Availability: ${service.availability}</p>
                </div>
                <div class="service-actions">
                    <button onclick="bookService(${service.id})">Book Now</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error searching services:', error);
    }
}

// Book a service
async function bookService(serviceId) {
    try {
        const response = await fetch(`/services/book/${serviceId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            alert('Service booked successfully!');
            loadBookings();
        } else {
            alert('Failed to book service.');
        }
    } catch (error) {
        console.error('Error booking service:', error);
    }
}

// Load client bookings
async function loadBookings() {
    try {
        const response = await fetch('/client/bookings', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const bookings = await response.json();
            const container = document.getElementById('bookingsContainer');
            container.innerHTML = bookings.length
                ? bookings.map(booking => `
                    <div class="booking-card">
                        <h3>${booking.serviceName}</h3>
                        <p>Provider: ${booking.provider}</p>
                        <p>Date: ${booking.date}</p>
                        <p>Status: ${booking.status}</p>
                        <button onclick="cancelBooking(${booking.id})">Cancel</button>
                        <button onclick="rescheduleBooking(${booking.id})">Reschedule</button>
                    </div>`).join('')
                : '<p>No bookings found.</p>';
        } else {
            console.error('Failed to fetch bookings.');
        }
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

// Cancel a booking
async function cancelBooking(bookingId) {
    try {
        const response = await fetch(`/client/bookings/cancel/${bookingId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            alert('Booking canceled successfully!');
            loadBookings();
        } else {
            alert('Failed to cancel booking.');
        }
    } catch (error) {
        console.error('Error canceling booking:', error);
    }
}

// Reschedule a booking
async function rescheduleBooking(bookingId) {
    const newDate = prompt('Enter new date (YYYY-MM-DD):');
    if (newDate) {
        try {
            const response = await fetch(`/client/bookings/reschedule/${bookingId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newDate })
            });

            if (response.ok) {
                alert('Booking rescheduled successfully!');
                loadBookings();
            } else {
                alert('Failed to reschedule booking.');
            }
        } catch (error) {
            console.error('Error rescheduling booking:', error);
        }
    }
}

// Load client reviews
async function loadReviews() {
    try {
        const response = await fetch('/client/reviews', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const reviews = await response.json();
            const container = document.getElementById('reviewsContainer');
            container.innerHTML = reviews.length
                ? reviews.map(review => `
                    <div class="review-card">
                        <h3>${review.serviceName}</h3>
                        <p>Rating: ${review.rating}</p>
                        <p>Review: ${review.comment}</p>
                    </div>`).join('')
                : '<p>No reviews found.</p>';
        } else {
            console.error('Failed to fetch reviews.');
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

// Load payment methods
async function loadPaymentMethods() {
    try {
        const response = await fetch('/client/payment-methods', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const payments = await response.json();
            const container = document.getElementById('paymentsContainer');
            container.innerHTML = payments.length
                ? payments.map(payment => `
                    <div class="payment-card">
                        <h3>${payment.type}</h3>
                        <p>Card Number: ${payment.cardNumber}</p>
                        <button onclick="deletePaymentMethod(${payment.id})">Delete</button>
                    </div>`).join('')
                : '<p>No payment methods found.</p>';
        } else {
            console.error('Failed to fetch payment methods.');
        }
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

// Delete a payment method
async function deletePaymentMethod(paymentId) {
    try {
        const response = await fetch(`/client/payment-methods/delete/${paymentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            alert('Payment method deleted successfully!');
            loadPaymentMethods();
        } else {
            alert('Failed to delete payment method.');
        }
    } catch (error) {
        console.error('Error deleting payment method:', error);
    }
}

// Logout function
async function logout() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('No token found. You are already logged out.');
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Ensure cookies are sent with the request
        });

        if (response.ok) {
            localStorage.removeItem('token'); // Clear the token from localStorage
            window.location.href = '/login.html'; // Redirect to the login page
        } else {
            const result = await response.json();
            alert(result.message || 'Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        alert('An error occurred while logging out.');
    }
}


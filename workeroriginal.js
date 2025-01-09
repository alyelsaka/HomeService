<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Worker Dashboard - My Services</title>
    <style>
        /* Your existing CSS styles */
    </style>
</head>
<body>
    <div class="container">
        <h2>Add a New Service</h2>
        <form id="add-service-form">
            <!-- Hidden input for worker ID -->
            <input type="hidden" id="worker-id" name="worker-id">

            <label for="service-name">Service Name:</label>
            <input type="text" id="service-name" name="service-name" required>

            <label for="service-price">Price ($):</label>
            <input type="number" id="service-price" name="service-price" step="0.01" required>

            <label for="availability-start">Availability Start Time:</label>
            <input type="time" id="availability-start" name="availability-start" required>

            <label for="availability-end">Availability End Time:</label>
            <input type="time" id="availability-end" name="availability-end" required>

            <label for="service-description">Description:</label>
            <textarea id="service-description" name="service-description" rows="4" required></textarea>

            <button type="submit" id="submit-button">Add Service</button>
        </form>
        <div class="message" id="message"></div>
        <div class="error" id="error"></div>
    </div>

    <div class="services-list">
        <h3>My Services</h3>
        <div id="services-container">
            <p class="loading">Loading services...</p>
        </div>
    </div>

    <script>
        // Function to fetch the worker's ID based on the logged-in user's email
        async function fetchWorkerId() {
            try {
                console.log('Fetching worker ID...');
                const response = await fetch('/auth/user', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();

                if (response.ok) {
                    console.log('Worker ID fetched successfully:', data.user.id);
                    // Set the worker ID in the hidden input field
                    document.getElementById('worker-id').value = data.user.id;
                    return data.user.id; // Return the worker ID
                } else {
                    console.error('Failed to fetch worker ID:', data.message);
                    document.getElementById('error').textContent = 'Failed to fetch worker ID.';
                    return null;
                }
            } catch (error) {
                console.error('Error fetching worker ID:', error);
                document.getElementById('error').textContent = 'Error fetching worker ID.';
                return null;
            }
        }

        // Function to fetch and display the worker's services
        async function fetchWorkerServices() {
            try {
                console.log('Fetching worker services...');
                const workerId = document.getElementById('worker-id').value;
                const response = await fetch(`/api/worker/services?worker_id=${workerId}`);
                const data = await response.json();

                const servicesContainer = document.getElementById('services-container');
                servicesContainer.innerHTML = ''; // Clear existing content

                if (response.ok) {
                    console.log('Services fetched successfully:', data);
                    if (data.length > 0) {
                        data.forEach(service => {
                            const serviceItem = document.createElement('div');
                            serviceItem.className = 'service-item';
                            serviceItem.innerHTML = `
                                <strong>${service.name}</strong><br>
                                Price: $${service.price}<br>
                                Availability: ${service.availability_start} - ${service.availability_end}<br>
                                Status: ${service.status}<br>
                                Description: ${service.description}
                            `;
                            servicesContainer.appendChild(serviceItem);
                        });
                    } else {
                        servicesContainer.innerHTML = '<p>No services found.</p>';
                    }
                } else {
                    console.error('Failed to fetch services:', data.message);
                    servicesContainer.innerHTML = '<p class="error">Failed to fetch services. Please try again.</p>';
                }
            } catch (error) {
                console.error('Error fetching services:', error);
                document.getElementById('services-container').innerHTML = '<p class="error">An error occurred while fetching services.</p>';
            }
        }

        // Handle form submission to add a new service
        document.getElementById('add-service-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true; // Disable the button to prevent multiple submissions

    const workerId = document.getElementById('worker-id').value;
    const serviceName = document.getElementById('service-name').value;
    const servicePrice = document.getElementById('service-price').value;
    const availabilityStart = document.getElementById('availability-start').value;
    const availabilityEnd = document.getElementById('availability-end').value;
    const serviceDescription = document.getElementById('service-description').value;

    // Ensure all fields are filled
    if (!serviceName || !servicePrice || !availabilityStart || !availabilityEnd || !serviceDescription) {
        document.getElementById('error').textContent = 'All fields are required.';
        submitButton.disabled = false;
        return;
    }

    try {
        const response = await fetch('/api/worker/services', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                worker_id: workerId,
                rate_per_hour: servicePrice,
                availability_start: availabilityStart,
                availability_end: availabilityEnd,
                description: serviceDescription,
                is_active: 1 // Default to active
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('message').textContent = 'Service added successfully!';
            document.getElementById('error').textContent = '';

            // Clear the form fields
            document.getElementById('add-service-form').reset();

            // Refresh the list of services
            fetchWorkerServices();
        } else {
            document.getElementById('error').textContent = data.message || 'Failed to add service.';
            document.getElementById('message').textContent = '';
        }
    } catch (error) {
        console.error('Error adding service:', error);
        document.getElementById('error').textContent = 'Failed to add service due to an error.';
        document.getElementById('message').textContent = '';
    } finally {
        submitButton.disabled = false; // Re-enable the button
    }
});
        // Load initial data
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('DOM fully loaded and parsed');
            // Fetch the worker's ID based on the logged-in user's email
            const workerId = await fetchWorkerId();

            if (workerId) {
                console.log('Worker ID found:', workerId);
                // Set the worker ID in the hidden input field
                document.getElementById('worker-id').value = workerId;

                // Fetch and display the worker's services
                fetchWorkerServices();
            } else {
                console.error('Failed to fetch worker ID.');
                document.getElementById('error').textContent = 'Failed to fetch worker ID.';
            }
        });
        // Function to create a worker profile if it doesn't exist
        async function createWorkerProfile(workerId) {
    try {
        console.log('Creating worker profile...');
        const response = await fetch('/api/worker/create-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({}) // No body needed for this request
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Worker profile created or already exists:', data.message);
            return true;
        } else {
            console.error('Failed to create worker profile:', data.message);
            document.getElementById('error').textContent = 'Failed to create worker profile.';
            return false;
        }
    } catch (error) {
        console.error('Error creating worker profile:', error);
        document.getElementById('error').textContent = 'Error creating worker profile.';
        return false;
    }
}
// Load initial data
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed');
    // Fetch the worker's ID based on the logged-in user's email
    const workerId = await fetchWorkerId();

    if (workerId) {
        console.log('Worker ID found:', workerId);
        // Set the worker ID in the hidden input field
        document.getElementById('worker-id').value = workerId;

        // Create a worker profile if it doesn't exist
        const profileCreated = await createWorkerProfile(workerId);
        if (profileCreated) {
            // Fetch and display the worker's services
            fetchWorkerServices();
        }
    } else {
        console.error('Failed to fetch worker ID.');
        document.getElementById('error').textContent = 'Failed to fetch worker ID.';
    }
});
    </script>
</body>
</html>
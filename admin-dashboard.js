// Wait for DOM to load before executing any script
document.addEventListener("DOMContentLoaded", () => {
    fetchAdminData();
    loadPendingWorkers();
    loadServices();
    loadReports();
});

// Fetch admin data
async function fetchAdminData() {
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
            document.getElementById('adminNamePlaceholder').textContent = data.user?.name || 'Admin';
        } else {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error fetching admin data:', error);
    }
}

// Load pending workers
async function loadPendingWorkers() {
    try {
        const response = await fetch('/admin/workers/pending', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const workers = await response.json();
            const container = document.getElementById('pending-workers-container');
            container.innerHTML = workers.length
                ? workers.map(worker => `
                    <div class="worker-card">
                        <h3>${worker.name}</h3>
                        <p>Email: ${worker.email}</p>
                        <button onclick="approveWorker(${worker.id})">Approve</button>
                        <button onclick="rejectWorker(${worker.id})">Reject</button>
                    </div>`).join('')
                : '<p>No pending workers.</p>';
        } else {
            console.error('Failed to fetch pending workers.');
        }
    } catch (error) {
        console.error('Error loading pending workers:', error);
    }
}

// Approve a worker
async function approveWorker(workerId) {
    try {
        const response = await fetch(`/admin/workers/approve/${workerId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            alert('Worker approved successfully!');
            loadPendingWorkers();
        } else {
            alert('Failed to approve worker.');
        }
    } catch (error) {
        console.error('Error approving worker:', error);
    }
}

// Reject a worker
async function rejectWorker(workerId) {
    try {
        const response = await fetch(`/admin/workers/reject/${workerId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            alert('Worker rejected successfully!');
            loadPendingWorkers();
        } else {
            alert('Failed to reject worker.');
        }
    } catch (error) {
        console.error('Error rejecting worker:', error);
    }
}

// Load all services
function loadServices() {
    fetch('/services/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(response => response.json())
        .then(services => {
            const container = document.getElementById('services-container');
            container.innerHTML = services.length
                ? services.map(service => `
                    <div class="service-card">
                        <h3>${service.name}</h3>
                        <p>Provider: ${service.worker_name}</p>
                        <button onclick="deleteService(${service.id})">Delete</button>
                    </div>`).join('')
                : '<p>No services available.</p>';
        })
        .catch(error => console.error('Error loading services:', error));
}

// Delete a service
function deleteService(serviceId) {
    fetch(`/services/delete/${serviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(() => loadServices())
        .catch(error => console.error('Error deleting service:', error));
}

// Load admin reports
function loadReports() {
    fetch('/admin/reports', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
        .then(response => response.json())
        .then(reports => {
            const container = document.getElementById('reports-container');
            container.innerHTML = reports.length
                ? reports.map(report => `
                    <div class="report-card">
                        <h3>${report.title}</h3>
                        <p>${report.description}</p>
                    </div>`).join('')
                : '<p>No reports available.</p>';
        })
        .catch(error => console.error('Error loading reports:', error));
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
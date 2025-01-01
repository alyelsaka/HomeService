// Predefined Users
const users = [
  { name: "Ali Elsaka", email: "ali@example.com", password: "123", role: "client" },
  { name: "Hamza Hassan", email: "hamza@example.com", password: "123", role: "worker" },
  { name: "Boody", email: "boody@example.com", password: "123", role: "admin" }
];

// Handle Login
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      // Authenticate User
      const user = users.find(
        (u) => u.email === email && u.password === password
      );

      if (user) {
        // Save user data to localStorage
        localStorage.setItem("currentUser", JSON.stringify(user));

        // Redirect to the appropriate dashboard
        switch (user.role) {
          case "client":
            window.location.href = "./dashboard-client.html";
            break;
          case "worker":
            window.location.href = "./dashboard-worker.html";
            break;
          case "admin":
            window.location.href = "./dashboard-admin.html";
            break;
          default:
            alert("Role not recognized. Contact support.");
        }
      } else {
        alert("Invalid email or password!");
      }
    });
  }

  // Check if a logged-in user is already present
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (currentUser && window.location.pathname.endsWith("login.html")) {
    // Automatically redirect logged-in users
    switch (currentUser.role) {
      case "client":
        window.location.href = "./dashboard-client.html";
        break;
      case "worker":
        window.location.href = "./dashboard-worker.html";
        break;
      case "admin":
        window.location.href = "./dashboard-admin.html";
        break;
    }
  }
});

// Logout Functionality
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector(".logout-btn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("currentUser");
      window.location.href = "./login.html";
    });
  }
});

// Display Logged-In User Info
document.addEventListener("DOMContentLoaded", () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (currentUser) {
    const userDisplay = document.querySelector(".user-display");
    if (userDisplay) {
      userDisplay.textContent = `Welcome, ${currentUser.name}`;
    }
  }
});

// Fetch and Display Available Services in Client Dashboard
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.endsWith("dashboard-client.html")) {
    const servicesContainer = document.getElementById("services-container");

    if (servicesContainer) {
      // Show loading indicator
      servicesContainer.innerHTML = `
        <div class="loading-spinner">
          <p>Loading services...</p>
        </div>
      `;

      // Fetch services from API
      fetch("/api/services")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch services: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          // Clear loading indicator
          servicesContainer.innerHTML = "";

          // Populate services dynamically
          if (data && data.length > 0) {
            data.forEach((service) => {
              const serviceElement = document.createElement("div");
              serviceElement.classList.add("service");
              serviceElement.innerHTML = `
                <h3>${service.name}</h3>
                <p>Price: $${service.price}</p>
                <p>Rating: ${service.rating}</p>
              `;
              servicesContainer.appendChild(serviceElement);
            });
          } else {
            servicesContainer.innerHTML = "<p>No services available at the moment.</p>";
          }
        })
        .catch((error) => {
          console.error("Error fetching services:", error);
          servicesContainer.innerHTML = `
            <p class="error-message">Error loading services. Please try again later.</p>
          `;
        });
    }
  }
});

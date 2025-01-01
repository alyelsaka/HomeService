export function fetchServices() {
    return [
      { id: 1, name: 'Home Cleaning', price: 50 },
      { id: 2, name: 'Plumbing', price: 75 },
    ];
  }
  
  export function fetchBookings(role) {
    if (role === 'client') {
      return [
        { id: 1, service: 'Cleaning', date: '2024-12-31', status: 'Confirmed' },
      ];
    } else if (role === 'worker') {
      return [{ id: 2, client: 'John Doe', service: 'Plumbing', date: '2024-12-29' }];
    }
  }
  
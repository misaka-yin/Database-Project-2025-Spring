// Toggle navigation
document.getElementById('navToggle').addEventListener('click', () => {
    document.querySelector('.header__nav').classList.toggle('open');
    });
    
    // Generic fetch wrapper
    async function apiGet(path) {
      const url = `http://localhost:3000${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
    }

    // Generic POST wrapper
    async function apiPost(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    // Helper functions for date/time formatting
    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    }

    function formatTime(dateString) {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    
    // Page initialization
    window.addEventListener('DOMContentLoaded', () => {
    const page = document.body.id;
    if (page && window.pageInit && window.pageInit[page]) {
    window.pageInitpage;
    }
    });
    
    /* pages/catalog.js */
    window.pageInit = window.pageInit || {};
    window.pageInit.catalog = async function() {
    try {
    const books = await apiGet('/api/books');
    // populate table
    } catch (e) { console.error(e); }
    };
    
    /* pages/authors.js */
    window.pageInit.authors = async function() {
    const authors = await apiGet('/api/authors');
    };

    // ===== Login/Register Modals =====
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginClose = document.getElementById('loginClose');
const registerClose = document.getElementById('registerClose');

loginBtn.addEventListener('click', () => loginModal.style.display = 'flex');
registerBtn.addEventListener('click', () => registerModal.style.display = 'flex');
loginClose.addEventListener('click', () => loginModal.style.display = 'none');
registerClose.addEventListener('click', () => registerModal.style.display = 'none');

// Close on click outside
[loginModal, registerModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = e.target.loginEmail.value;
  const pass  = e.target.loginPassword.value;
  try {
    const user = await apiPost('/api/login', { email, pass });
    loginModal.style.display = 'none';
    onLoginSuccess(user);
  } catch(err) { alert('Login failed: ' + err.message); }
});

// Register form submission
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    name: e.target.regName.value,
    email: e.target.regEmail.value,
    pass:  e.target.regPassword.value
  };
  try {
    const user = await apiPost('/api/register', data);
    registerModal.style.display = 'none';
    onLoginSuccess(user);
  } catch(err) { alert('Register failed: ' + err.message); }
});

// Login success callback
function onLoginSuccess(user) {
  // Update navigation
  document.querySelector('.header__auth').innerHTML = `
    <span>Welcome, ${user.name}</span>
    <button id="logoutBtn" class="btn btn--outline">Logout</button>`;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    apiPost('/api/logout').then(() => location.reload());
  });
 // If employee, show admin panel
  if (user.role === 'employee') {
    document.getElementById('admin').style.display = 'block';
  }
}



// Add new page initializer for reservations
window.pageInit.reservations = async function() {
  const reservationsPerPage = 5;
  let upcomingReservations = [];
  let pastReservations = [];
  let currentUpcomingPage = 1;
  let currentPastPage = 1;
  let allRooms = [];

  // Setup tab functionality
  setupReservationTabs();
  
  // Load initial data
  await Promise.all([loadRooms(), loadReservations()]);
  
  // Set today's date as default for availability search
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('availabilityDate').value = today;
  
  // Setup event listeners
  setupReservationEventListeners();

  // Function to show a message in the modal
  function showMessage(message) {
    document.getElementById('messageModalBody').textContent = message;
    document.getElementById('messageModal').style.display = 'block';
  }
  
  // Close message modal
  document.getElementById('messageModalClose')?.addEventListener('click', () => {
    document.getElementById('messageModal').style.display = 'none';
  });
  
  async function loadRooms() {
    try {
      const rooms = await apiGet('/api/studyrooms');
      allRooms = rooms;
    } catch (e) {
      console.error('Failed to load rooms', e);
      showMessage('Failed to load study rooms.');
    }
  }
  
  async function loadReservations() {
    try {
      const resvs = await apiGet('/api/reservations');
      const now = new Date();
      
      // Split into upcoming and past reservations
      upcomingReservations = resvs.filter(r => new Date(r.rsv_end_dt) > now)
        .sort((a, b) => new Date(a.rsv_start_dt) - new Date(b.rsv_start_dt));
      
      pastReservations = resvs.filter(r => new Date(r.rsv_end_dt) <= now)
        .sort((a, b) => new Date(b.rsv_start_dt) - new Date(a.rsv_start_dt));
      
      displayUpcomingReservations(currentUpcomingPage);
      
      // Only display past reservations if that tab is active
      if (document.querySelector('.tab-button[data-tab="past"]')?.classList.contains('active')) {
        displayPastReservations(currentPastPage);
      }
    } catch (e) {
      console.error('Failed to load reservations', e);
      showMessage('Failed to load your reservations.');
    }
  }
  
  function setupReservationTabs() {
    // Show the upcoming reservations tab by default
    const upcomingTab = document.getElementById('upcoming-reservations');
    if (upcomingTab) upcomingTab.classList.add('active');
    
    // Add click event listeners to tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Add active class to clicked tab
        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        document.getElementById(`${tabId}-reservations`).classList.add('active');
        
        // If past tab is clicked, make sure to display past reservations
        if (tabId === 'past') {
          displayPastReservations(currentPastPage);
        }
      });
    });
  }
  
    // Find availability button
    document.getElementById('findAvailabilityBtn')?.addEventListener('click', async () => {
      const date = document.getElementById('availabilityDate').value;
      const startTime = document.getElementById('availabilityStartTime').value;
      const endTime = document.getElementById('availabilityEndTime').value;
      const groupSize = document.getElementById('availabilityGroupSize').value;
      
        if (!date || !startTime || !endTime || !groupSize) {
          showMessage('Please fill in all availability filters.');
          return;
        }
      
      // Format date and time to match SQLite storage format
      // Combine date and time inputs into the format '2025-04-04 10:00:00'
      const startDateTime = `${date} ${startTime}:00`;
      const endDateTime = `${date} ${endTime}:00`;
      
      console.log('Searching for available rooms with parameters:', {
        startDateTime,
        endDateTime,
        groupSize
      });
      
      try {
        const availableRooms = await apiGet(
          `/api/availability?start_time=${encodeURIComponent(startDateTime)}&end_time=${encodeURIComponent(endDateTime)}&group_size=${groupSize}`
        );
        console.log('Available rooms response:', availableRooms);
        displayAvailableRooms(availableRooms);
        document.getElementById('availableRoomsTable').style.display = 'table';
      } catch (error) {
        console.error('Error fetching availability:', error);
        showMessage('Failed to find available rooms.');
        document.getElementById('availableRoomsTable').style.display = 'none';
      }
    });
      
      // Cancel new reservation button
      document.getElementById('cancelNewReservation')?.addEventListener('click', () => {
        document.getElementById('newReservationForm').classList.add('hidden');
      });
    
    // Submit new reservation form
    document.getElementById('confirmReservationForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const reservation = {
        rm_id: document.getElementById('selectedRoomId').value,
        rsv_start_dt: document.getElementById('selectedStartTime').value,
        rsv_end_dt: document.getElementById('selectedEndTime').value,
        group_size: document.getElementById('selectedGroupSize').value,
        topic_des: document.getElementById('topicDescriptionInput').value
      };
      
      try {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reservation)
        });
        
        if (response.ok) {
          showMessage('Reservation created successfully!');
          document.getElementById('newReservationForm').classList.add('hidden');
          document.getElementById('topicDescriptionInput').value = '';
          document.getElementById('availableRoomsTable').style.display = 'none';
          loadReservations();
        } else {
          const error = await response.json();
          showMessage(`Failed to create reservation: ${error.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error creating reservation:', error);
        showMessage('Failed to create reservation. Please try again later.');
      }
    });
  }
  
  function displayUpcomingReservations(page) {
    const tbody = document.querySelector('#upcomingReservationsTable tbody');
    const paginationDiv = document.getElementById('upcomingReservationsPagination');
    if (!tbody || !paginationDiv) return;
    
    tbody.innerHTML = '';
    paginationDiv.innerHTML = '';
    
    const startIndex = (page - 1) * reservationsPerPage;
    const endIndex = Math.min(startIndex + reservationsPerPage, upcomingReservations.length);
    const currentReservations = upcomingReservations.slice(startIndex, endIndex);
    
    if (currentReservations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No upcoming reservations.</td></tr>';
    } else {
      currentReservations.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.rm_id}</td>
          <td>${new Date(r.rsv_start_dt).toLocaleDateString()}</td>
          <td>${new Date(r.rsv_start_dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${new Date(r.rsv_end_dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${r.group_size}</td>
          <td>${r.topic_des}</td>
          <td><button class="btn btn--warning cancel-btn" data-id="${r.rsv_id}">Cancel</button></td>
        `;
        tbody.appendChild(tr);
      });
      attachCancelHandlers();
    }
    
    renderPagination(upcomingReservations.length, page, 'upcoming');
  }
  
  function displayPastReservations(page) {
    const tbody = document.querySelector('#pastReservationsTable tbody');
    const paginationDiv = document.getElementById('pastReservationsPagination');
    if (!tbody || !paginationDiv) return;
    
    tbody.innerHTML = '';
    paginationDiv.innerHTML = '';
    
    const startIndex = (page - 1) * reservationsPerPage;
    const endIndex = Math.min(startIndex + reservationsPerPage, pastReservations.length);
    const currentReservations = pastReservations.slice(startIndex, endIndex);
    
    if (currentReservations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No past reservations.</td></tr>';
    } else {
      currentReservations.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.rm_id}</td>
          <td>${new Date(r.rsv_start_dt).toLocaleDateString()}</td>
          <td>${new Date(r.rsv_start_dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${new Date(r.rsv_end_dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${r.group_size}</td>
          <td>${r.topic_des}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    renderPagination(pastReservations.length, page, 'past');
  }
  
  function renderPagination(totalItems, currentPage, type) {
    const totalPages = Math.ceil(totalItems / reservationsPerPage);
    const paginationDiv = document.getElementById(`${type}ReservationsPagination`);
    if (!paginationDiv) return;
    
    paginationDiv.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      if (i === currentPage) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => {
        if (type === 'upcoming') {
          currentUpcomingPage = i;
          displayUpcomingReservations(currentUpcomingPage);
        } else if (type === 'past') {
          currentPastPage = i;
          displayPastReservations(currentPastPage);
        }
      });
      paginationDiv.appendChild(button);
    }
  }
  
  function attachCancelHandlers() {
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        if (confirm(`Cancel reservation ${id}?`)) {
          try {
            const response = await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
            if (response.ok) {
              showMessage(`Reservation ${id} cancelled successfully.`);
              loadReservations();
            } else {
              showMessage(`Failed to cancel reservation ${id}.`);
              console.error('Failed to cancel reservation:', response);
            }
          } catch (error) {
            console.error('Error cancelling reservation:', error);
            showMessage('Failed to cancel reservation. Please try again later.');
          }
        }
      };
    });
  }
  
  function displayAvailableRooms(rooms) {
    const tbody = document.querySelector('#availableRoomsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (rooms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No rooms available for the selected criteria.</td></tr>';
    } else {
      rooms.forEach(room => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${room.rm_id}</td>
          <td>${room.capacity}</td>
          <td><button class="btn btn--primary reserve-btn" data-rmid="${room.rm_id}">Reserve</button></td>
        `;
        tbody.appendChild(tr);
      });
      attachReserveHandlers();
    }
  }
  
  function attachReserveHandlers() {
    document.querySelectorAll('.reserve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-rmid');
        const date = document.getElementById('availabilityDate').value;
        const startTime = document.getElementById('availabilityStartTime').value;
        const endTime = document.getElementById('availabilityEndTime').value;
        const groupSize = document.getElementById('availabilityGroupSize').value;
        
        // Display confirmation form
        document.getElementById('confirmRoomNo').textContent = `Room: ${roomId}`;
        document.getElementById('confirmDateTime').textContent = 
          `Date: ${new Date(date).toLocaleDateString()} | Time: ${startTime} - ${endTime}`;
        document.getElementById('selectedRoomId').value = roomId;
        document.getElementById('selectedStartTime').value = `${date}T${startTime}`;
        document.getElementById('selectedEndTime').value = `${date}T${endTime}`;
        document.getElementById('selectedGroupSize').value = groupSize;
        
        document.getElementById('newReservationForm').classList.remove('hidden');
      });
    });
  }
};
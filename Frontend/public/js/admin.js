// admin.js

// --- MODAL SETUP ---
const modal = document.getElementById('adminModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeAdminModal');
closeModal.addEventListener('click', () => modal.classList.add('hidden'));

// --- STATISTICS (Chart.js) ---
async function loadStats() {
  const res = await fetch('/api/admin/stats');
  const stats = await res.json();

  // Update numeric stats
  document.getElementById('statTotalBooks').textContent    = stats.total_books;
  document.getElementById('statBorrowedBooks').textContent = stats.borrowed_books;
  document.getElementById('statOverdue').textContent      = stats.overdue;
  document.getElementById('statReservations').textContent = stats.reservations;
  document.getElementById('statEvents').textContent       = stats.upcoming_events;

  // Resize chart canvas
  const ctx = document.getElementById('statsChart');
  ctx.width = 400;
  ctx.height = 200;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total','Borrowed','Overdue','Reserved','Events'],
      datasets: [{
        label: 'Count',
        data: [
          stats.total_books,
          stats.borrowed_books,
          stats.overdue,
          stats.reservations,
          stats.upcoming_events
        ]
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false
    }
  });
}

// --- DATA TABLES & EDIT FUNCTIONALITY ---
let tables = {};

async function loadLists() {
  // Books table
  tables.books = $('#booksList').DataTable({
    ajax: { url: '/api/admin/books', dataSrc: 'data' },
    columns: [
      { data: 'isbn' },
      { data: 'title' },
      { data: 'authors' },
      { data: 'topic' },
      { data: 'total_copies' },
      { data: 'available_copies' },
      { data: null, render: r => `<button class="edit-btn" data-type="books" data-id="${r.isbn}">Edit</button>` }
    ]
  });
  // Events table
  tables.events = $('#eventsList').DataTable({
    ajax: { url: '/api/admin/events', dataSrc: 'data' },
    columns: [
      { data: 'event_id' },
      { data: 'event_name' },
      { data: 'event_type' },
      { data: 'start_dt' },
      { data: 'end_dt' },
      { data: null, render: r => `<button class="edit-btn" data-type="events" data-id="${r.event_id}">Edit</button>` }
    ]
  });
  // Rooms table
  tables.rooms = $('#roomsList').DataTable({
    ajax: { url: '/api/admin/rooms', dataSrc: 'data' },
    columns: [
      { data: 'room_id' },
      { data: 'capacity' },
      { data: null, render: r => `<button class="edit-btn" data-type="rooms" data-id="${r.room_id}">Edit</button>` }
    ]
  });
  // Discounts table
  tables.discounts = $('#discountsList').DataTable({
    ajax: { url: '/api/admin/discounts', dataSrc: 'data' },
    columns: [
      { data: 'discount_id' },
      { data: 'method' },
      { data: 'date' },
      { data: 'amount' },
      { data: 'invoice_id' },
      { data: null, render: r => `<button class="edit-btn" data-type="discounts" data-id="${r.discount_id}">Edit</button>` }
    ]
  });
  // Users table
  tables.users = $('#usersList').DataTable({
    ajax: { url: '/api/admin/users', dataSrc: 'data' },
    columns: [
      { data: 'user_id' },
      { data: 'first_name' },
      { data: 'last_name' },
      { data: 'email' },
      { data: 'phone' },
      { data: null, render: r => `<button class="edit-btn" data-type="users" data-id="${r.user_id}">Edit</button>` }
    ]
  });

  // Delegate edit button clicks
  $('#booksList, #eventsList, #roomsList, #discountsList, #usersList').on('click', '.edit-btn', function() {
    const type = $(this).data('type');
    const id   = $(this).data('id');
    openEditModal(type, id);
  });
}

function openEditModal(type, id) {
  const table = tables[type];
  const dataKey = {
    books: 'isbn',
    events: 'event_id',
    rooms: 'room_id',
    discounts: 'discount_id',
    users: 'user_id'
  }[type];
  const rowData = table.rows().data().toArray().find(r => r[dataKey] == id);

  let formHtml = '<form id="editForm">';
  for (const key in rowData) {
    const readonly = (key === dataKey) ? 'readonly' : '';
    formHtml += `
      <label>${key}: <input name="${key}" value="${rowData[key]}" ${readonly}></label><br>`;
  }
  formHtml += '<button type="submit">Save</button></form>';

  modalBody.innerHTML = formHtml;
  modal.classList.remove('hidden');

  document.getElementById('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {};
    new FormData(e.target).forEach((v, k) => { payload[k] = v; });
    await fetch(`/api/admin/${type}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    modal.classList.add('hidden');
    tables[type].ajax.reload(null, false);
  }, { once: true });
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLists();
});

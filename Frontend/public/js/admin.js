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
      { data: 'CAPACITY' },
      { data: null, render: r => `<button class="edit-btn" data-type="rooms" data-id="${r.room_id}">Edit</button>` }
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
  $('#booksList, #eventsList, #roomsList, #usersList').on('click', '.edit-btn', function() {
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

// Payment Management functionality
function initializePaymentManagement() {
  // Initialize invoices table
  tables.payments = $('#invoicesList').DataTable({
    ajax: {
      url: '/api/admin/invoices',
      dataSrc: 'data',
      error: function(xhr, error, thrown) {
        console.error('DataTables error:', error, thrown);
        showErrorToast('Failed to load invoice data. Please try again.');
      }
    },
    columns: [
      { data: 'inv_id', title: 'Invoice ID' },
      {
        data: 'rental_id',
        title: 'Rental ID',
        render: function(data, type, row) {
          return `<a class="rental-link" data-rental-id="${data}">${data}</a>`;
        }
      },
      {
        data: 'invoice_date',
        title: 'Invoice Date',
        render: function(data) {
          return new Date(data).toLocaleDateString();
        }
      },
      { data: 'customer_id', title: 'Customer ID' },
      {
        data: null,
        title: 'Customer Name',
        render: function(data, type, row) {
          return `${row.c_fname} ${row.c_lname}`;
        }
      },
      {
        data: 'inv_amt',
        title: 'Invoice Amount',
        className: 'text-right',
        render: $.fn.dataTable.render.number(',', '.', 2, '$')
      },
      {
        data: 'paid_amt',
        title: 'Paid Amount',
        className: 'text-right',
        render: $.fn.dataTable.render.number(',', '.', 2, '$')
      },
      {
        data: null,
        title: 'Outstanding Amount',
        className: 'text-right',
        render: function(data, type, row) {
          const outstandingAmount = parseFloat(row.inv_amt) - parseFloat(row.paid_amt);
          return `<span class="${outstandingAmount > 0 ? 'badge badge-danger' : 'badge badge-success'}">${'$' + outstandingAmount.toFixed(2)}</span>`;
        }
      },
      {
        data: null,
        title: 'Action',
        orderable: false,
        searchable: false,
        render: function(data, type, row) {
          const outstandingAmount = parseFloat(row.inv_amt) - parseFloat(row.paid_amt);
          const paymentBtnDisabled = outstandingAmount <= 0;
          return `<button class="btn btn--primary make-payment-btn"
                    data-invoice="${row.inv_id}"
                    data-customer="${row.customer_id}"
                    data-fname="${row.c_fname}"
                    data-lname="${row.c_lname}"
                    data-outstanding="${outstandingAmount}"
                    ${paymentBtnDisabled ? 'disabled' : ''}>
                    Make Payment
                  </button>`;
        }
      }
    ],
    paging: true,
    searching: false, // We handle our own search
    ordering: true,
    info: true
  });

  // Search invoices button click
  document.getElementById('searchInvoicesBtn').addEventListener('click', loadFilteredInvoices);
  
  // Clear search button click
  document.getElementById('clearInvoiceSearchBtn').addEventListener('click', function() {
    document.getElementById('invoiceIdFilter').value = '';
    document.getElementById('customerIdFilter').value = '';
    document.getElementById('rentalIdFilter').value = '';
    document.getElementById('bookIdFilter').value = '';
    loadFilteredInvoices();
  });
  
  // Same as customer checkbox
  document.getElementById('sameAsCustomer').addEventListener('change', function() {
    if (this.checked) {
      document.getElementById('payeeFname').value = document.getElementById('paymentCustomerFname').value;
      document.getElementById('payeeLname').value = document.getElementById('paymentCustomerLname').value;
      document.getElementById('payeeFname').setAttribute('readonly', true);
      document.getElementById('payeeLname').setAttribute('readonly', true);
    } else {
      document.getElementById('payeeFname').removeAttribute('readonly');
      document.getElementById('payeeLname').removeAttribute('readonly');
    }
  });
  
  // Make Payment button handler
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('make-payment-btn')) {
      const invoiceId = e.target.dataset.invoice;
      const customerId = e.target.dataset.customer;
      const customerFname = e.target.dataset.fname;
      const customerLname = e.target.dataset.lname;
      const outstandingAmount = parseFloat(e.target.dataset.outstanding);
      
      document.getElementById('paymentInvoiceId').value = invoiceId;
      document.getElementById('paymentCustomerId').value = customerId;
      document.getElementById('paymentCustomerFname').value = customerFname;
      document.getElementById('paymentCustomerLname').value = customerLname;
      document.getElementById('outstandingAmountInfo').textContent = `Outstanding amount: $${outstandingAmount.toFixed(2)}`;
      document.getElementById('paymentAmount').max = outstandingAmount;
      document.getElementById('paymentMethod').value = '';
      document.getElementById('sameAsCustomer').checked = false;
      document.getElementById('payeeFname').value = '';
      document.getElementById('payeeLname').value = '';
      document.getElementById('paymentAmount').value = '';
      document.getElementById('payeeFname').removeAttribute('readonly');
      document.getElementById('payeeLname').removeAttribute('readonly');
      document.getElementById('paymentModal').classList.add('active');
    }
  });
  
  // Rental ID link click handler
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('rental-link')) {
      const rentalId = e.target.dataset.rentalId;
      loadRentalDetails(rentalId);
    }
  });
  
  // Close modals
  document.getElementById('closeRentalModal').addEventListener('click', function() {
    document.getElementById('rentalDetailsModal').classList.remove('active');
  });
  
  document.getElementById('closeRentalDetailsBtn').addEventListener('click', function() {
    document.getElementById('rentalDetailsModal').classList.remove('active');
  });
  
  document.getElementById('closePaymentModal').addEventListener('click', function() {
    document.getElementById('paymentModal').classList.remove('active');
  });
  
  document.getElementById('cancelPaymentBtn').addEventListener('click', function() {
    document.getElementById('paymentModal').classList.remove('active');
  });
  
  // Payment form submission
  document.getElementById('paymentForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const paymentData = {
      inv_id: document.getElementById('paymentInvoiceId').value,
      pmt_method: document.getElementById('paymentMethod').value,
      pmt_date: new Date().toISOString().split('T')[0],
      payee_fname: document.getElementById('payeeFname').value,
      payee_lname: document.getElementById('payeeLname').value,
      pmt_amt: parseFloat(document.getElementById('paymentAmount').value)
    };
    
    createPayment(paymentData);
  });
}

async function loadFilteredInvoices() {
  try {
    const invoiceId = document.getElementById('invoiceIdFilter').value.trim();
    const customerId = document.getElementById('customerIdFilter').value.trim();
    const rentalId = document.getElementById('rentalIdFilter').value.trim();
    const bookId = document.getElementById('bookIdFilter').value.trim();

    // Build query only if at least one filter exists
    let url = '/api/admin/invoices';
    const params = new URLSearchParams();
    
    if (invoiceId) params.append('invoice_id', invoiceId);
    if (customerId) params.append('customer_id', customerId);
    if (rentalId) params.append('rental_id', rentalId);
    if (bookId) params.append('book_id', bookId);

    // Only add ? if there are actual parameters
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    tables.payments.ajax.url(url).load();
  } catch (error) {
    console.error('Error loading invoices:', error);
    showErrorToast('Failed to load invoices. Please try again.');
  }
}


async function loadRentalDetails(rentalId) {
  try {
    const response = await fetch(`/api/admin/rentals/${rentalId}`);
    if (!response.ok) throw new Error('Failed to fetch rental details');
    const rentalDetails = await response.json();
    
    let html = `
      <div class="rental-info">
        <h4>Book Information</h4>
        <div class="info-row">
          <div class="info-label">Book ID:</div>
          <div class="info-value">${rentalDetails.book_id}</div>
        </div>
        <div class="info-row">
          <div class="info-label">ISBN:</div>
          <div class="info-value">${rentalDetails.isbn || 'N/A'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Title:</div>
          <div class="info-value">${rentalDetails.book_title || 'N/A'}</div>
        </div>
        <h4>Rental Information</h4>
        <div class="info-row">
          <div class="info-label">Borrow Date:</div>
          <div class="info-value">${new Date(rentalDetails.borrow_date).toLocaleDateString()}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Expected Return Date:</div>
          <div class="info-value">${new Date(rentalDetails.exp_rt_date).toLocaleDateString()}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Actual Return Date:</div>
          <div class="info-value">${rentalDetails.act_rt_date ? new Date(rentalDetails.act_rt_date).toLocaleDateString() : 'Not returned yet'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Status:</div>
          <div class="info-value">
            <span class="badge badge-${rentalDetails.r_status === 'BORROWED' ? 'warning' : rentalDetails.r_status === 'RETURNED' ? 'success' : 'danger'}">
              ${rentalDetails.r_status}
            </span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('rentalDetailsBody').innerHTML = html;
    document.getElementById('rentalDetailsModal').classList.add('active');
  } catch (error) {
    console.error('Error loading rental details:', error);
    showErrorToast('Failed to load rental details. Please try again.');
  }
}

async function createPayment(paymentData) {
  try {
    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    
    if (!response.ok) throw new Error('Failed to create payment');
    
    const result = await response.json();
    document.getElementById('paymentModal').classList.remove('active');
    tables.payments.ajax.reload(null, false);
    showSuccessToast('Payment processed successfully!');
  } catch (error) {
    console.error('Error creating payment:', error);
    showErrorToast(`Failed to process payment: ${error.message}`);
  }
}

function showSuccessToast(message) {
  // Implement toast notification for success
  alert(message); // Replace with actual toast implementation
}

function showErrorToast(message) {
  // Implement toast notification for errors
  alert(message); // Replace with actual toast implementation
}

// Tab functionality
function initializeTabs() {
  const sidebarLinks = document.querySelectorAll('.sidebar__link');
  const tabContents = document.querySelectorAll('.tab-content');
  
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetTab = this.getAttribute('data-tab');
      
      tabContents.forEach(tab => tab.classList.add('hidden'));
      sidebarLinks.forEach(link => link.classList.remove('active'));
      
      document.getElementById(`tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`).classList.remove('hidden');
      this.classList.add('active');
    });
  });
  
  if (tabContents.length > 0) {
    tabContents.forEach(tab => tab.classList.add('hidden'));
    tabContents[0].classList.remove('hidden');
    if (sidebarLinks.length > 0) sidebarLinks[0].classList.add('active');
  }
}

// Combined initialization
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLists();
  initializeTabs();
  initializePaymentManagement();
});
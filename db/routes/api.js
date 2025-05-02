const express = require('express');
const router = express.Router();
const db = require('../database');

//const path = require('path');
//const app = express();
//const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded form data
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Serve static files
//router.use(express.static(path.join(__dirname, '../../Frontend/public')));

// Mock user authentication (in a real app, use proper authentication)
// For demo purposes, we'll assume user is logged in with ID 1001
const LOGGED_IN_USER_ID = 1;

// API Routes

// Register for an exhibition
// Add this to your server.js file
router.post('/exhibitions/:id/register', (req, res) => {
	try {
		const eventId = req.params.id;
		console.log(`Attempting to register user ${LOGGED_IN_USER_ID} for exhibition ${eventId}`);

		// In a real application, use actual user authentication
		// Here we're using the mock logged-in user
		const customerId = LOGGED_IN_USER_ID;

		// Check if the exhibition exists
		db.get("SELECT * FROM EXHIBITION WHERE EVENT_ID = ?", [eventId], (err, exhibition) => {
			if (err) {
				console.error('Error checking exhibition existence:', err.message);
				return res.status(500).json({ error: err.message });
			}

			if (!exhibition) {
				return res.status(404).json({ error: 'Exhibition not found' });
			}

			// First check if this customer is already registered for this exhibition
			const checkSql = `
		  SELECT * FROM CGY_CUS_EXH 
		  WHERE EVENT_ID = ? AND CUSTOMER_ID = ?
		`;

			db.get(checkSql, [eventId, customerId], (err, existingReg) => {
				if (err) {
					console.error('Error checking registration:', err.message);
					return res.status(500).json({ error: err.message });
				}

				// If already registered, return error
				if (existingReg) {
					return res.status(409).json({
						error: 'You are already registered for this exhibition'
					});
				}

				// Get the next REG_ID
				db.get("SELECT MAX(REG_ID) as max_id FROM CGY_CUS_EXH", [], (err, result) => {
					if (err) {
						console.error('Error getting max REG_ID:', err.message);
						return res.status(500).json({ error: err.message });
					}

					const nextRegId = (result.max_id || 0) + 1;

					// Insert new registration
					const insertSql = `
			  INSERT INTO CGY_CUS_EXH (EVENT_ID, CUSTOMER_ID, REG_ID)
			  VALUES (?, ?, ?)
			`;

					db.run(insertSql, [eventId, customerId, nextRegId], function (err) {
						if (err) {
							console.error('Error creating registration:', err.message);
							return res.status(500).json({ error: err.message });
						}

						console.log(`New registration created: Event ${eventId}, Customer ${customerId}, RegID ${nextRegId}`);

						res.status(201).json({
							message: 'Registration successful',
							reg_id: nextRegId,
							event_id: eventId,
							customer_id: customerId
						});
					});
				});
			});
		});
	} catch (error) {
		console.error('Unexpected error in registration endpoint:', error);
		res.status(500).json({ error: 'Server error. Check logs for details.' });
	}
});


// Get all study rooms
router.get('/studyrooms', (req, res) => {
	const sql = 'SELECT * FROM CGY_STUDYRM';

	db.all(sql, [], (err, rows) => {
		if (err) {
			console.error(err.message);
			return res.status(500).json({ error: err.message });
		}
		res.json(rows);
	});
});

// Get user's reservations
router.get('/reservations', (req, res) => {
	const sql = `
	SELECT r.*, s.CAPACITY as capacity 
	FROM CGY_RM_RSV r
	JOIN CGY_STUDYRM s ON r.RM_ID = s.RM_ID
	WHERE r.CUSTOMER_ID = ?
	ORDER BY r.RSV_START_DT DESC
  `;

	db.all(sql, [LOGGED_IN_USER_ID], (err, rows) => {
		if (err) {
			console.error(err.message);
			return res.status(500).json({ error: err.message });
		}

		// Rename fields to match JavaScript naming conventions
		const renamedRows = rows.map(row => ({
			rsv_id: row.RSV_ID,
			rsv_start_dt: row.RSV_START_DT,
			rsv_end_dt: row.RSV_END_DT,
			group_size: row.GROUP_SIZE,
			topic_des: row.TOPIC_DES,
			rm_id: row.RM_ID,
			customer_id: row.CUSTOMER_ID,
			capacity: row.capacity
		}));

		res.json(renamedRows);
	});
});


// Find available rooms
router.get('/availability', (req, res) => {
	const { start_time, end_time, group_size } = req.query;

	if (!start_time || !end_time || !group_size) {
		return res.status(400).json({ error: 'Missing required parameters' });
	}

	console.log('Received availability search request:', {
		start_time,
		end_time,
		group_size
	});

	// First, get all rooms with sufficient capacity
	const sql = `
	  SELECT * FROM CGY_STUDYRM
	  WHERE CAPACITY >= ?
	`;

	db.all(sql, [group_size], (err, rooms) => {
		if (err) {
			console.error(err.message);
			return res.status(500).json({ error: err.message });
		}

		// If no rooms with sufficient capacity, return empty array
		if (rooms.length === 0) {
			return res.json([]);
		}

		// Get room IDs
		const roomIds = rooms.map(room => room.RM_ID);

		// Check for conflicts using the format in the database
		const conflictSql = `
		SELECT DISTINCT RM_ID FROM CGY_RM_RSV
		WHERE RM_ID IN (${roomIds.map(() => '?').join(',')})
		AND (
		  (RSV_START_DT < ? AND RSV_END_DT > ?) OR
		  (RSV_START_DT < ? AND RSV_END_DT > ?) OR
		  (RSV_START_DT >= ? AND RSV_END_DT <= ?)
		)
	  `;

		const params = [
			...roomIds,
			end_time, start_time,     // Overlaps start
			end_time, start_time,     // Overlaps end
			start_time, end_time      // Fully contained
		];

		console.log('Checking for conflicts with params:', params);

		db.all(conflictSql, params, (err, conflicts) => {
			if (err) {
				console.error(err.message);
				return res.status(500).json({ error: err.message });
			}

			console.log('Found conflicting rooms:', conflicts);

			// Get conflicting room IDs
			const conflictingRoomIds = conflicts.map(conflict => conflict.RM_ID);

			// Filter out rooms with conflicts
			const availableRooms = rooms.filter(room => !conflictingRoomIds.includes(room.RM_ID));

			// Format response to match expected format in the client
			const formattedRooms = availableRooms.map(room => ({
				rm_id: room.RM_ID,
				capacity: room.CAPACITY
			}));

			console.log('Returning available rooms:', formattedRooms);
			res.json(formattedRooms);
		});
	});
});

// Create a new reservation
router.post('/reservations', (req, res) => {
	const { rm_id, rsv_start_dt, rsv_end_dt, group_size, topic_des } = req.body;

	if (!rm_id || !rsv_start_dt || !rsv_end_dt || !group_size || !topic_des) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	// Check if room is still available
	const checkSql = `
	SELECT COUNT(*) as conflict_count FROM CGY_RM_RSV
	WHERE RM_ID = ?
	AND (
	  (RSV_START_DT < ? AND RSV_END_DT > ?) OR
	  (RSV_START_DT < ? AND RSV_END_DT > ?) OR
	  (RSV_START_DT >= ? AND RSV_END_DT <= ?)
	)
  `;

	const checkParams = [
		rm_id,
		rsv_end_dt, rsv_start_dt,     // Overlaps start
		rsv_end_dt, rsv_start_dt,     // Overlaps end
		rsv_start_dt, rsv_end_dt      // Fully contained
	];

	db.get(checkSql, checkParams, (err, result) => {
		if (err) {
			console.error(err.message);
			return res.status(500).json({ error: err.message });
		}

		if (result.conflict_count > 0) {
			return res.status(409).json({
				error: 'Room is no longer available for the selected time slot'
			});
		}

		// Get the next RSV_ID
		db.get("SELECT MAX(RSV_ID) as max_id FROM CGY_RM_RSV", [], (err, result) => {
			if (err) {
				console.error(err.message);
				return res.status(500).json({ error: err.message });
			}

			const nextId = (result.max_id || 0) + 1;

			// Insert new reservation
			const insertSql = `
		INSERT INTO CGY_RM_RSV (RSV_ID, CUSTOMER_ID, RM_ID, RSV_START_DT, RSV_END_DT, GROUP_SIZE, TOPIC_DES)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	  `;

			const insertParams = [
				nextId,
				LOGGED_IN_USER_ID,
				rm_id,
				rsv_start_dt,
				rsv_end_dt,
				group_size,
				topic_des
			];

			db.run(insertSql, insertParams, function (err) {
				if (err) {
					console.error(err.message);
					return res.status(500).json({ error: err.message });
				}

				res.status(201).json({
					rsv_id: nextId,
					customer_id: LOGGED_IN_USER_ID,
					rm_id,
					rsv_start_dt,
					rsv_end_dt,
					group_size,
					topic_des
				});
			});
		});
	});
});

// Cancel a reservation
router.delete('/reservations/:id', (req, res) => {
	const { id } = req.params;

	// Check if reservation belongs to the logged-in user
	const checkSql = `
	SELECT * FROM CGY_RM_RSV
	WHERE RSV_ID = ? AND CUSTOMER_ID = ?
  `;

	db.get(checkSql, [id, LOGGED_IN_USER_ID], (err, row) => {
		if (err) {
			console.error(err.message);
			return res.status(500).json({ error: err.message });
		}

		if (!row) {
			return res.status(404).json({
				error: 'Reservation not found or you do not have permission to cancel it'
			});
		}

		// Delete the reservation
		const deleteSql = `DELETE FROM CGY_RM_RSV WHERE RSV_ID = ?`;

		db.run(deleteSql, [id], function (err) {
			if (err) {
				console.error(err.message);
				return res.status(500).json({ error: err.message });
			}

			res.json({ message: 'Reservation cancelled successfully' });
		});
	});
});

// Events API routes (for events.html)
router.get('/events', (req, res) => {
	// Get all events from CGY_EVENTS table
	const sql = `
	  SELECT e.EVENT_ID as id, 
			 e.EVENT_NAME as name, 
			 CASE e.EVENT_TYPE 
			   WHEN 'S' THEN 'Seminar' 
			   WHEN 'E' THEN 'Exhibition' 
			   ELSE e.EVENT_TYPE 
			 END as type,
			 s.S_TYPE as seminar_type,
			 t.TOPIC_DES as topic,
			 e.START_DT as start_datetime, 
			 e.END_DT as stop_datetime
	  FROM CGY_EVENTS e
	  LEFT JOIN CGY_TOPIC t ON e.TOPIC_ID = t.TOPIC_ID
	  LEFT JOIN SEMINAR s ON e.EVENT_ID = s.EVENT_ID
	  ORDER BY e.START_DT DESC
	`;

	db.all(sql, [], (err, events) => {
		if (err) {
			console.error('Error fetching events:', err.message);
			return res.status(500).json({ error: err.message });
		}

		// Get additional details based on event type
		const eventPromises = events.map(event => {
			// For seminars, get invited attendees
			if (event.type === 'Seminar') {
				return new Promise((resolve) => {
					const seminarSql = `
			  SELECT a.A_FNAME || ' ' || a.A_LNAME as full_name
			  FROM CGY_AUT_SEM aus
			  JOIN CGY_AUTHOR a ON aus.CGY_AUTHOR_AUTHOR_ID = a.AUTHOR_ID
			  WHERE aus.SEMINAR_EVENT_ID = ?
			`;

					db.all(seminarSql, [event.id], (err, attendees) => {
						if (err) {
							console.error('Error fetching seminar attendees:', err.message);
							event.invited_attendees = [];
						} else {
							event.invited_attendees = attendees.map(a => a.full_name);
						}
						resolve(event);
					});
				});
			}
			// For exhibitions, add registration link (this would come from your database)
			else if (event.type === 'Exhibition') {
				// You would need a real table for this, but for now adding a placeholder
				event.registration_link = '#'; // Placeholder
				return Promise.resolve(event);
			}
			return Promise.resolve(event);
		});

		// Wait for all promises to resolve
		Promise.all(eventPromises)
			.then(enrichedEvents => {
				res.json(enrichedEvents);
			})
			.catch(error => {
				console.error('Error enriching events data:', error);
				res.status(500).json({ error: 'Failed to process events data' });
			});
	});
});

router.get('/events/:id/sponsors', (req, res) => {
	const { id } = req.params;

	// Query to get sponsors for a seminar
	const sql = `
	  SELECT 
		CASE 
		  WHEN i.S_FNAME IS NOT NULL THEN i.S_FNAME || ' ' || i.S_LNAME
		  WHEN o.ORG_NAME IS NOT NULL THEN o.ORG_NAME
		  ELSE 'Unknown'
		END as name,
		sp.SPONSOR_AMT as amount
	  FROM CGY_SMR_SP sp
	  LEFT JOIN CGY_SPONSOR s ON sp.SPONSOR_ID = s.SPONSOR_ID
	  LEFT JOIN INDIVIDUAL i ON sp.SPONSOR_ID = i.SPONSOR_ID
	  LEFT JOIN ORG o ON sp.SPONSOR_ID = o.SPONSOR_ID
	  WHERE sp.EVENT_ID = ?
	`;

	db.all(sql, [id], (err, sponsors) => {
		if (err) {
			console.error('Error fetching sponsors:', err.message);
			return res.status(500).json({ error: err.message });
		}

		res.json(sponsors);
	});
});


 // Get all rentals for the logged-in user
 router.get('/rentals', (req, res) => {
	// In a real application, use actual user authentication
	// Here we're using the mock logged-in user ID
	const customerId = LOGGED_IN_USER_ID;
	
	const sql = `
	  SELECT 
		r.RENTAL_ID as rental_id,
		r.R_STATUS as r_status,
		r.BORROW_DATE as borrow_date,
		r.EXP_RT_DATE as exp_rt_date,
		r.ACT_RT_DATE as act_rt_date,
		r.BOOK_ID as book_id,
		r.INV_ID as inv_id,
		b.BK_NAME as book_title,
		b.ISBN as isbn
	  FROM CGY_RENTAL r
	  LEFT JOIN CGY_BOOK_INV bi ON r.BOOK_ID = bi.BOOK_ID
	  LEFT JOIN CGY_BOOK b ON bi.ISBN = b.ISBN
	  WHERE r.CUSTOMER_ID = ?
	  ORDER BY 
		CASE r.R_STATUS
		  WHEN 'LATE' THEN 1
		  WHEN 'BORROWED' THEN 2
		  WHEN 'RETURNED' THEN 3
		END,
		r.BORROW_DATE DESC
	`;
	
	db.all(sql, [customerId], (err, rows) => {
	  if (err) {
		console.error('Error fetching rentals:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  console.log(`Found ${rows.length} rentals for customer ${customerId}`);
	  res.json(rows);
	});
  });
  
  // Get all invoices for the logged-in user
  router.get('/invoices', (req, res) => {
	// In a real application, use actual user authentication
	// Here we're using the mock logged-in user ID
	const customerId = LOGGED_IN_USER_ID;
	
	const sql = `
	  SELECT 
		i.INV_ID as inv_id,
		i.RENTAL_ID as rental_id,
		i.INVOICE_DATE as invoice_date,
		i.INV_AMT as inv_amt,
		COALESCE(SUM(p.PMT_AMT), 0) as pmt_amt,
		CASE 
		  WHEN COALESCE(SUM(p.PMT_AMT), 0) >= i.INV_AMT THEN 'COMPLETED'
		  ELSE 'OUTSTANDING'
		END as status
	  FROM CGY_INVOICE i
	  LEFT JOIN CGY_PAYMENT p ON i.INV_ID = p.INV_ID
	  INNER JOIN CGY_RENTAL r ON i.RENTAL_ID = r.RENTAL_ID
	  WHERE r.CUSTOMER_ID = ?
	  GROUP BY i.INV_ID
	  ORDER BY i.INVOICE_DATE DESC
	`;
	
	db.all(sql, [customerId], (err, rows) => {
	  if (err) {
		console.error('Error fetching invoices:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  console.log(`Found ${rows.length} invoices for customer ${customerId}`);
	  res.json(rows);
	});
  });
  
  // Get invoice details including payments
  router.get('/invoices/:id/details', (req, res) => {
	const invoiceId = req.params.id;
	const customerId = LOGGED_IN_USER_ID;
	
	// First check if this invoice belongs to the logged-in user
	const checkSql = `
	  SELECT i.*, r.CUSTOMER_ID
	  FROM CGY_INVOICE i
	  INNER JOIN CGY_RENTAL r ON i.RENTAL_ID = r.RENTAL_ID
	  WHERE i.INV_ID = ? AND r.CUSTOMER_ID = ?
	`;
	
	db.get(checkSql, [invoiceId, customerId], (err, invoice) => {
	  if (err) {
		console.error('Error checking invoice ownership:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  if (!invoice) {
		return res.status(404).json({ error: 'Invoice not found or you do not have permission to view it' });
	  }
	  
	  // Now get the payments for this invoice
	  const paymentsSql = `
		SELECT *
		FROM CGY_PAYMENT
		WHERE INV_ID = ?
		ORDER BY PMT_DATE DESC
	  `;
	  
	  db.all(paymentsSql, [invoiceId], (err, payments) => {
		if (err) {
		  console.error('Error fetching payments:', err.message);
		  return res.status(500).json({ error: err.message });
		}
		
		// Calculate total payments
		const totalPaid = payments.reduce((sum, payment) => sum + payment.PMT_AMT, 0);
		
		// Add status to invoice
		invoice.status = totalPaid >= invoice.INV_AMT ? 'COMPLETED' : 'OUTSTANDING';
		
		res.json({
		  invoice: {
			inv_id: invoice.INV_ID,
			rental_id: invoice.RENTAL_ID,
			invoice_date: invoice.INVOICE_DATE,
			inv_amt: invoice.INV_AMT,
			status: invoice.status
		  },
		  payments: payments.map(payment => ({
			pmt_id: payment.PMT_ID,
			pmt_method: payment.PMT_METHOD,
			pmt_date: payment.PMT_DATE,
			payee_fname: payment.PAYEE_FNAME,
			payee_lname: payment.PAYEE_LNAME,
			pmt_amt: payment.PMT_AMT
		  }))
		});
	  });
	});
  }); 
  
  // Get all books with inventory information
  router.get('/inventory/books', (req, res) => {
	const sql = `
	  SELECT 
		bi.BOOK_ID as book_id,
		bi.BK_STATUS as bk_status,
		bi.ISBN as isbn,
		b.BK_NAME as bk_name,
		t.TOPIC_ID as topic_id,
		t.TOPIC_DES as topic_des
	  FROM CGY_BOOK_INV bi
	  LEFT JOIN CGY_BOOK b ON bi.ISBN = b.ISBN
	  LEFT JOIN CGY_TOPIC t ON b.TOPIC_ID = t.TOPIC_ID
	  ORDER BY b.BK_NAME
	`;
	
	db.all(sql, [], (err, rows) => {
	  if (err) {
		console.error('Error fetching book inventory:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  // Get unique ISBNs to fetch authors
	  const isbns = [...new Set(rows.filter(r => r.isbn).map(r => r.isbn))];
	  
	  if (isbns.length === 0) {
		// No books with ISBNs found, return the rows without authors
		return res.json(rows.map(row => ({
		  book_id: row.book_id,
		  bk_status: row.bk_status,
		  isbn: row.isbn,
		  bk_name: row.bk_name,
		  topic: row.topic_id ? {
			topic_id: row.topic_id,
			topic_des: row.topic_des
		  } : null,
		  authors: []
		})));
	  }
	  
	  // Query to get authors for each book
	  const placeholders = isbns.map(() => '?').join(',');
	  const authorsSql = `
		SELECT 
		  ba.ISBN,
		  ba.AUTHOR_ID,
		  ba.CONTRI_ROLE,
		  a.A_FNAME as first_name,
		  a.A_LNAME as last_name
		FROM CGY_BK_AUT ba
		JOIN CGY_AUTHOR a ON ba.AUTHOR_ID = a.AUTHOR_ID
		WHERE ba.ISBN IN (${placeholders})
	  `;
	  
	  db.all(authorsSql, isbns, (err, authorRows) => {
		if (err) {
		  console.error('Error fetching book authors:', err.message);
		  return res.status(500).json({ error: err.message });
		}
		
		// Group authors by ISBN
		const authorsByISBN = {};
		authorRows.forEach(ar => {
		  if (!authorsByISBN[ar.ISBN]) {
			authorsByISBN[ar.ISBN] = [];
		  }
		  authorsByISBN[ar.ISBN].push({
			author_id: ar.AUTHOR_ID,
			first_name: ar.first_name,
			last_name: ar.last_name,
			role: ar.CONTRI_ROLE
		  });
		});
		
		// Combine book data with authors
		const booksWithAuthors = rows.map(row => {
		  return {
			book_id: row.book_id,
			bk_status: row.bk_status,
			isbn: row.isbn,
			bk_name: row.bk_name,
			topic: row.topic_id ? {
			  topic_id: row.topic_id,
			  topic_des: row.topic_des
			} : null,
			authors: row.isbn ? (authorsByISBN[row.isbn] || []) : []
		  };
		});
		
		console.log(`Found ${booksWithAuthors.length} books in inventory`);
		res.json(booksWithAuthors);
	  });
	});
  });
  
  // Get all topics
  router.get('/topics', (req, res) => {
	const sql = 'SELECT TOPIC_ID as topic_id, TOPIC_DES as topic_des FROM CGY_TOPIC ORDER BY TOPIC_DES';
	
	db.all(sql, [], (err, rows) => {
	  if (err) {
		console.error('Error fetching topics:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  res.json(rows);
	});
  });
  
  // Get all authors
  router.get('/authors', (req, res) => {
	const sql = `
	  SELECT 
		AUTHOR_ID as author_id, 
		A_FNAME as first_name, 
		A_LNAME as last_name,
		EMAIL_ADDR as email
	  FROM CGY_AUTHOR 
	  ORDER BY A_LNAME, A_FNAME
	`;
	
	db.all(sql, [], (err, rows) => {
	  if (err) {
		console.error('Error fetching authors:', err.message);
		return res.status(500).json({ error: err.message });
	  }
	  
	  res.json(rows);
	});
  });

// // Start the server
// router.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// // Close the database connection when the server closes
// process.on('SIGINT', () => {
//   db.close(() => {
// 	console.log('Database connection closed');
// 	process.exit(0);
//   });
// });

module.exports = router;
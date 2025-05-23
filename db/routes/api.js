const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');

//const path = require('path');
//const app = express();
//const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded form data
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Set to WAL mode
db.run('PRAGMA journal_mode = WAL', (err) => {
  if (err) {
    console.error('Failed to set WAL mode:', err.message);
  } else {
    console.log('SQLite is now using WAL mode');
  }
});


// Serve static files
//router.use(express.static(path.join(__dirname, '../../Frontend/public')));

// Mock user authentication (in a real app, use proper authentication)
// For demo purposes, we'll assume user is logged in with ID 1001
const LOGGED_IN_USER_ID = 1;

// API Routes

//admin employee and customer
// --- Employees list for Admin ---
router.get('/admin/employees', (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.username,
      u.role,
      u.status,
      e.full_name,
      e.email,
      e.phone,
      e.department
    FROM CGY_USER u
    JOIN employee e ON u.employee_id = e.employee_id
    WHERE u.role = 'EMPLOYEE'
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching employees:', err.message);
      return res.status(500).json({ error: err.message });
    }
    // DataTables expects { data: [...] }
    res.json({ data: rows });
  });
});

// --- Customers list for Admin ---
router.get('/admin/customers', (req, res) => {
  const sql = `
    SELECT
      u.user_id,
      u.username,
      u.role,
      u.status,
      c.full_name,
      c.email,
      c.phone,
      c.id_type,
      c.id_number
    FROM CGY_USER u
    JOIN customer c ON u.customer_id = c.customer_id
    WHERE u.role = 'CUSTOMER'
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error fetching customers:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows });
  });
});

// ─── 新：创建员工 ───────────────────────────────────────────────
router.post('/admin/employees', async (req, res) => {
  const { username, role, status, full_name, email, phone, department } = req.body;
  if (!username || !full_name || !email) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // 1) 先插 employee 表
  db.run(
    `INSERT INTO employee (full_name, phone, email, department)
     VALUES (?, ?, ?, ?)`,
    [full_name, phone || null, email, department || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const empId = this.lastID;

      // 2) 给新员工一个初始密码 “password”，生产环境请改成随机或邮件验证
      bcrypt.hash('password', 10).then(hash => {
        db.run(
          `INSERT INTO CGY_USER
             (username, password_hash, email, role, employee_id, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [username, hash, email, role, empId, status],
          function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, user_id: this.lastID });
          }
        );
      });
    }
  );
});

// ─── 新：更新员工 ───────────────────────────────────────────────
router.put('/admin/employees/:userId', (req, res) => {
  const userId = req.params.userId;
  const { username, role, status, full_name, email, phone, department } = req.body;

  // 先取出 employee_id
  db.get(
    `SELECT employee_id FROM CGY_USER WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'User not found.' });
      const empId = row.employee_id;

      // 更新 CGY_USER
      db.run(
        `UPDATE CGY_USER
           SET username=?, role=?, status=?
         WHERE user_id = ?`,
        [username, role, status, userId],
        err2 => {
          if (err2) return res.status(500).json({ error: err2.message });

          // 更新 employee
          db.run(
            `UPDATE employee
               SET full_name=?, email=?, phone=?, department=?
             WHERE employee_id = ?`,
            [full_name, email, phone, department, empId],
            err3 => {
              if (err3) return res.status(500).json({ error: err3.message });
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// ─── 新：创建客户 ───────────────────────────────────────────────
router.post('/admin/customers', async (req, res) => {
  const { username, role, status, full_name, email, phone, id_type, id_number } = req.body;
  if (!username || !full_name || !email || !id_type || !id_number) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // 1) 插 customer
  db.run(
    `INSERT INTO customer (full_name, phone, email, id_type, id_number)
     VALUES (?, ?, ?, ?, ?)`,
    [full_name, phone || null, email, id_type, id_number],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const custId = this.lastID;

      // 2) 初始密码
      bcrypt.hash('password', 10).then(hash => {
        db.run(
          `INSERT INTO CGY_USER
             (username, password_hash, email, role, customer_id, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [username, hash, email, role, custId, status],
          function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, user_id: this.lastID });
          }
        );
      });
    }
  );
});

// ─── 新：更新客户 ───────────────────────────────────────────────
router.put('/admin/customers/:userId', (req, res) => {
  const userId = req.params.userId;
  const { username, role, status, full_name, email, phone, id_type, id_number } = req.body;

  db.get(
    `SELECT customer_id FROM CGY_USER WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'User not found.' });
      const custId = row.customer_id;

      db.run(
        `UPDATE CGY_USER
           SET username=?, role=?, status=?
         WHERE user_id = ?`,
        [username, role, status, userId],
        err2 => {
          if (err2) return res.status(500).json({ error: err2.message });

          db.run(
            `UPDATE customer
               SET full_name=?, email=?, phone=?, id_type=?, id_number=?
             WHERE customer_id = ?`,
            [full_name, email, phone, id_type, id_number, custId],
            err3 => {
              if (err3) return res.status(500).json({ error: err3.message });
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

//Index, User table, register and log in

router.post('/users/register', async (req, res) => {
  const {
    username,
    fullName,
    phone,
    idType,
    idNumber,
    email,
    password,
    confirmPassword,
    role
  } = req.body;

  if (!username || !fullName || !email || !password || !idType || !idNumber) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO customer (full_name, phone, email, id_type, id_number)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, phone || null, email, idType, idNumber],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const customerId = this.lastID;
        db.run(
          `INSERT INTO CGY_USER (username, password_hash, email, role, customer_id)
           VALUES (?, ?, ?, ?, ?)`,
          [username, hash, email, role, customerId],
          function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true, userId: this.lastID });
          }
        );
      }
    );
  } catch (e) {
    res.status(500).json({ error: 'Hashing error.' });
  }
});

router.post('/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password.' });
  }

  db.get(
    `SELECT * FROM CGY_USER WHERE email = ?`,
    [email],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'No such user.' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

      db.run(
        `UPDATE CGY_USER SET last_login = datetime('now') WHERE user_id = ?`,
        [user.user_id]
      );
      res.json({ success: true, role: user.role, userId: user.user_id });
    }
  );
});

// password reset
/**
  * POST /api/users/reset
  * Body: { email, newPassword, confirmPassword }
  */
 router.post('/users/reset', async (req, res) => {
   const { email, newPassword, confirmPassword } = req.body;
   if (!email || !newPassword || !confirmPassword) {
     return res.status(400).json({ error: 'Missing required fields.' });
   }
   if (newPassword !== confirmPassword) {
     return res.status(400).json({ error: 'Passwords do not match.' });
   }
   try {
     const hash = await bcrypt.hash(newPassword, 10);
     db.run(
       `UPDATE CGY_USER SET password_hash = ? WHERE email = ?`,
       [hash, email],
       function(err) {
         if (err) {
           return res.status(500).json({ error: err.message });
         }
         if (this.changes === 0) {
           return res.status(404).json({ error: 'Email not found.' });
         }
         res.json({ success: true, message: 'Password reset successfully.' });
       }
     );
   } catch (e) {
     res.status(500).json({ error: 'Hashing error.' });
   }
 });




// Register for an exhibition
// Add this to your server.js file

router.post('/users/register', async (req, res) => {
  const {
    username,
    fullName,
    phone,
    idType,
    idNumber,
    email,
    password,
    confirmPassword,
    role
  } = req.body;

  if (!username || !fullName || !email || !password || !idType || !idNumber) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      db.run(
        `INSERT INTO customer (full_name, phone, email, id_type, id_number)
         VALUES (?, ?, ?, ?, ?)`,
        [fullName, phone || null, email, idType, idNumber],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          const customerId = this.lastID;

          db.run(
            `INSERT INTO CGY_USER (username, password_hash, email, role, customer_id)
             VALUES (?, ?, ?, ?, ?)`,
            [username, hash, email, role, customerId],
            function (err2) {
              if (err2) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err2.message });
              }

              db.run('COMMIT');
              res.json({ success: true, userId: this.lastID });
            }
          );
        }
      );
    });
  } catch (e) {
    res.status(500).json({ error: 'Hashing error.' });
  }
});


router.post('/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password.' });
  }

  db.get(
    `SELECT * FROM CGY_USER WHERE email = ?`,
    [email],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'No such user.' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

      db.run(
        `UPDATE CGY_USER SET last_login = datetime('now') WHERE user_id = ?`,
        [user.user_id]
      );
      res.json({ success: true, role: user.role, userId: user.user_id });
    }
  );
});

// password reset
/**
  * POST /api/users/reset
  * Body: { email, newPassword, confirmPassword }
  */
router.post('/users/reset', async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION');

      db.run(
        `UPDATE CGY_USER SET password_hash = ? WHERE email = ?`,
        [hash, email],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          if (this.changes === 0) {
            db.run('ROLLBACK');
            return res.status(404).json({ error: 'Email not found.' });
          }

          db.run('COMMIT');
          res.json({ success: true, message: 'Password reset successfully.' });
        }
      );
    });
  } catch (e) {
    res.status(500).json({ error: 'Hashing error.' });
  }
});




// Register for an exhibition
router.post('/exhibitions/:id/register', (req, res) => {
  const eventId = req.params.id;
  const customerId = LOGGED_IN_USER_ID;

  db.serialize(() => {
    // Start transaction
    db.run('BEGIN IMMEDIATE TRANSACTION', err => {
      if (err) {
        console.error('Failed to begin transaction:', err.message);
        return res.status(500).json({ error: 'Database is busy. Try again.' });
      }

      // Check if the exhibition exists
      db.get("SELECT * FROM EXHIBITION WHERE EVENT_ID = ?", [eventId], (err, exhibition) => {
        if (err) {
          db.run('ROLLBACK');
          console.error('Error checking exhibition:', err.message);
          return res.status(500).json({ error: err.message });
        }

        if (!exhibition) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Exhibition not found' });
        }

        // Check for existing registration
        const checkSql = `
          SELECT * FROM CGY_CUS_EXH 
          WHERE EVENT_ID = ? AND CUSTOMER_ID = ?
        `;

        db.get(checkSql, [eventId, customerId], (err, existingReg) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('Error checking registration:', err.message);
            return res.status(500).json({ error: err.message });
          }

          if (existingReg) {
            db.run('ROLLBACK');
            return res.status(409).json({
              error: 'You are already registered for this exhibition'
            });
          }

          // Get the next REG_ID
          db.get("SELECT MAX(REG_ID) as max_id FROM CGY_CUS_EXH", [], (err, result) => {
            if (err) {
              db.run('ROLLBACK');
              console.error('Error getting max REG_ID:', err.message);
              return res.status(500).json({ error: err.message });
            }

            const nextRegId = (result?.max_id || 0) + 1;

            // Insert the registration
            const insertSql = `
              INSERT INTO CGY_CUS_EXH (EVENT_ID, CUSTOMER_ID, REG_ID)
              VALUES (?, ?, ?)
            `;

            db.run(insertSql, [eventId, customerId, nextRegId], function (err) {
              if (err) {
                db.run('ROLLBACK');
                console.error('Error inserting registration:', err.message);
                return res.status(500).json({ error: err.message });
              }

              // Commit the transaction
              db.run('COMMIT', err => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('Commit failed:', err.message);
                  return res.status(500).json({ error: 'Failed to commit transaction' });
                }

                console.log(`Registered user ${customerId} for exhibition ${eventId} (RegID: ${nextRegId})`);
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
      });
    });
  });
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

router.post("/studyroom", (req, res) => {
  const { RM_ID, CAPACITY } = req.body;

  if (!RM_ID || !CAPACITY) {
    return res.status(400).json({ error: "Missing RM_ID or CAPACITY" });
  }

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION", err => {
      if (err) {
        console.error("Failed to begin transaction:", err.message);
        return res.status(500).json({ error: "Database is busy. Try again." });
      }

      db.run("INSERT INTO CGY_STUDYRM (RM_ID, CAPACITY) VALUES (?, ?)", [RM_ID, CAPACITY], function (err) {
        if (err) {
          db.run("ROLLBACK");
          console.error("Insert failed:", err.message);
          return res.status(500).json({ error: err.message });
        }

        db.run("COMMIT", err => {
          if (err) {
            db.run("ROLLBACK");
            console.error("Commit failed:", err.message);
            return res.status(500).json({ error: "Failed to commit transaction" });
          }

          console.log(`Study room ${RM_ID} created with capacity ${CAPACITY}`);
          res.sendStatus(201);
        });
      });
    });
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

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');

    // 1. Check if room is available
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
      rsv_end_dt, rsv_start_dt,
      rsv_end_dt, rsv_start_dt,
      rsv_start_dt, rsv_end_dt
    ];

    db.get(checkSql, checkParams, (err, result) => {
      if (err) {
        db.run('ROLLBACK');
        console.error(err.message);
        return res.status(500).json({ error: err.message });
      }

      if (result.conflict_count > 0) {
        db.run('ROLLBACK');
        return res.status(409).json({
          error: 'Room is no longer available for the selected time slot'
        });
      }

      // 2. Get next RSV_ID
      db.get("SELECT MAX(RSV_ID) as max_id FROM CGY_RM_RSV", [], (err2, row) => {
        if (err2) {
          db.run('ROLLBACK');
          console.error(err2.message);
          return res.status(500).json({ error: err2.message });
        }

        const nextId = (row?.max_id || 0) + 1;

        // 3. Insert new reservation
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

        db.run(insertSql, insertParams, function (err3) {
          if (err3) {
            db.run('ROLLBACK');
            console.error(err3.message);
            return res.status(500).json({ error: err3.message });
          }

          db.run('COMMIT'); // Success: commit transaction

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
});

// Cancel a reservation
router.delete('/reservations/:id', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION');

    // Step 1: Check reservation ownership
    const checkSql = `
      SELECT * FROM CGY_RM_RSV
      WHERE RSV_ID = ? AND CUSTOMER_ID = ?
    `;

    db.get(checkSql, [id, LOGGED_IN_USER_ID], (err, row) => {
      if (err) {
        console.error(err.message);
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        db.run('ROLLBACK');
        return res.status(404).json({
          error: 'Reservation not found or you do not have permission to cancel it'
        });
      }

      // Step 2: Delete the reservation
      const deleteSql = `DELETE FROM CGY_RM_RSV WHERE RSV_ID = ?`;

      db.run(deleteSql, [id], function (err) {
        if (err) {
          console.error(err.message);
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        db.run('COMMIT');
        res.json({ message: 'Reservation cancelled successfully' });
      });
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

//Get all topics
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

//module.exports = router;

router.get('/admin/stats', (req, res) => {
  db.get(`
    SELECT
    (SELECT COUNT(*) FROM CGY_BOOK_INV)             AS total_books,
    (SELECT COUNT(*) FROM CGY_RENTAL WHERE R_STATUS='BORROWED') AS borrowed_books,
    (SELECT COUNT(*) FROM CGY_RENTAL WHERE R_STATUS='LATE')     AS overdue,
    (SELECT COUNT(*) FROM CGY_RM_RSV)               AS reservations,
    (SELECT COUNT(*) FROM CGY_EVENTS WHERE DATE(START_DT) > DATE('now')) AS upcoming_events
  `, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// 2. BOOKS LIST (for DataTables)
router.get('/admin/books', (req, res) => {
  db.all(`
    SELECT 
    b.ISBN            AS isbn,
    b.BK_NAME         AS title,
    GROUP_CONCAT(a.A_FNAME || ' ' || a.A_LNAME) AS authors,
    t.TOPIC_DES       AS topic,
    COUNT(inv.BOOK_ID)                   AS total_copies,
    SUM(CASE WHEN inv.BK_STATUS='A' THEN 1 ELSE 0 END) AS available_copies
    FROM CGY_BOOK b
    JOIN CGY_BK_AUT  ba  ON b.ISBN   = ba.ISBN
    JOIN CGY_AUTHOR a   ON ba.AUTHOR_ID = a.AUTHOR_ID
    JOIN CGY_TOPIC t    ON b.TOPIC_ID   = t.TOPIC_ID
    LEFT JOIN CGY_BOOK_INV inv ON b.ISBN = inv.ISBN
    GROUP BY b.ISBN
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });   // DataTables expects { data: [...] }
  });
});

// 3. EVENTS LIST
router.get('/admin/events', (req, res) => {
  db.all(`
    SELECT 
    e.EVENT_ID    AS event_id,
    e.EVENT_NAME  AS event_name,
    e.EVENT_TYPE  AS event_type,
    e.START_DT    AS start_dt,
    e.END_DT      AS end_dt,
    e.TOPIC_ID    AS topic_id,
    t.TOPIC_DES   AS topic_des
    FROM CGY_EVENTS e
    LEFT JOIN CGY_TOPIC t ON e.TOPIC_ID = t.TOPIC_ID
    ORDER BY e.START_DT DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});


// 4. ROOMS LIST
router.get('/admin/rooms', (req, res) => {
  db.all(`
    SELECT RM_ID AS room_id,
       capacity
    FROM CGY_STUDYRM
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// 5. DISCOUNTS LIST
router.get('/admin/discounts', (req, res) => {
  db.all(`
    SELECT PMT_ID    AS discount_id,
       PMT_METHOD AS method,
       PMT_DATE   AS date,
       PMT_AMT    AS amount,
       INV_ID     AS invoice_id
    FROM CGY_PAYMENT
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// 6. USERS LIST
router.get('/admin/users', (req, res) => {
  db.all(`
    SELECT CUSTOMER_ID AS user_id,
       C_FNAME     AS first_name,
       C_LNAME     AS last_name,
       EMAIL_ADDR  AS email,
       PHONE_NBR   AS phone
    FROM CGY_CUSTOMER
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

// Get invoices with filtering options for admin
router.get('/admin/invoices', (req, res) => {
  const { invoice_id, customer_id, rental_id, book_id } = req.query;

  // Validate and parse numeric inputs
  const numericParams = {};
  if (invoice_id && !isNaN(invoice_id)) numericParams.invoice_id = parseInt(invoice_id);
  if (customer_id && !isNaN(customer_id)) numericParams.customer_id = parseInt(customer_id);
  if (rental_id && !isNaN(rental_id)) numericParams.rental_id = parseInt(rental_id);
  if (book_id && !isNaN(book_id)) numericParams.book_id = parseInt(book_id);

  let whereClauses = [];
  let params = [];

  // Build WHERE clause using validated numeric params
  if (numericParams.invoice_id) {
    whereClauses.push('i.INV_ID = ?');
    params.push(numericParams.invoice_id);
  }

  if (numericParams.customer_id) {
    whereClauses.push('r.CUSTOMER_ID = ?');
    params.push(numericParams.customer_id);
  }

  if (numericParams.rental_id) {
    whereClauses.push('i.RENTAL_ID = ?');
    params.push(numericParams.rental_id);
  }

  if (numericParams.book_id) {
    whereClauses.push('r.BOOK_ID = ?');
    params.push(numericParams.book_id);
  }

  const whereClause = whereClauses.length > 0
    ? 'WHERE ' + whereClauses.join(' AND ')
    : '';

  const sql = `
        SELECT 
            i.INV_ID as inv_id,
            i.RENTAL_ID as rental_id,
            i.INVOICE_DATE as invoice_date,
            i.INV_AMT as inv_amt,
            r.CUSTOMER_ID as customer_id,
            c.C_FNAME as c_fname,
            c.C_LNAME as c_lname,
            COALESCE(SUM(p.PMT_AMT), 0) as paid_amt
        FROM CGY_INVOICE i
        INNER JOIN CGY_RENTAL r ON i.RENTAL_ID = r.RENTAL_ID
        INNER JOIN CGY_CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        LEFT JOIN CGY_PAYMENT p ON i.INV_ID = p.INV_ID
        ${whereClause}
        GROUP BY i.INV_ID, i.RENTAL_ID, i.INVOICE_DATE, i.INV_AMT, 
                r.CUSTOMER_ID, c.C_FNAME, c.C_LNAME
        ORDER BY i.INV_ID DESC
    `;

  console.log('Executing query:', sql); // Debug logging
  console.log('With parameters:', params); // Debug logging

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching invoices:', err.message);
      return res.status(500).json({
        error: 'Database error',
        details: err.message,
        query: sql,        // Include in response for debugging
        parameters: params // Include in response for debugging
      });
    }

    // Always return an array, even if empty
    const result = rows || [];
    console.log(`Found ${result.length} invoices`);

    res.json({
      data: result,
      meta: {
        count: result.length,
        filtered: whereClauses.length > 0
      }
    });
  });
});



// Get rental details by rental ID for admin view
router.get('/admin/rentals/:id', (req, res) => {
  const rentalId = req.params.id;

  const sql = `
    SELECT 
    r.RENTAL_ID as rental_id,
    r.R_STATUS as r_status,
    r.BORROW_DATE as borrow_date,
    r.EXP_RT_DATE as exp_rt_date,
    r.ACT_RT_DATE as act_rt_date,
    r.BOOK_ID as book_id,
    r.CUSTOMER_ID as customer_id,
    r.INV_ID as inv_id,
    bi.ISBN as isbn,
    b.BK_NAME as book_title
    FROM CGY_RENTAL r
    LEFT JOIN CGY_BOOK_INV bi ON r.BOOK_ID = bi.BOOK_ID
    LEFT JOIN CGY_BOOK b ON bi.ISBN = b.ISBN
    WHERE r.RENTAL_ID = ?
  `;

  db.get(sql, [rentalId], (err, rental) => {
    if (err) {
      console.error('Error fetching rental details:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (!rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }

    console.log(`Found rental details for rental ID ${rentalId}`);
    res.json(rental);
  });
});

function logAdminAction(db, employeeId, actionType, targetTable, targetId, details = null) {
  const sql = `
    INSERT INTO CGY_ADMIN_HISTORY (
      employee_id,
      action_type,
      target_table,
      target_id,
      details
    ) VALUES (?, ?, ?, ?, ?)
  `;
  const params = [employeeId, actionType, targetTable, targetId, details];
  db.run(sql, params, (err) => {
    if (err) {
      console.error('Failed to log admin action:', err.message);
    }
  });
}

router.post('/admin/reservation', async (req, res) => {
  const { rsv_start_dt, rsv_end_dt, group_size, topic_des, rm_id, customer_id } = req.body;
  console.log('Received reservation request:', req.body);

  await db.run(`
    INSERT INTO CGY_RM_RSV (RSV_START_DT, RSV_END_DT, GROUP_SIZE, TOPIC_DES, RM_ID, CUSTOMER_ID)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [rsv_start_dt, rsv_end_dt, group_size, topic_des, rm_id, customer_id]
  );

  res.sendStatus(201);
});

// Create a new payment (admin function)
router.post('/admin/payments', (req, res) => {
  const { inv_id, pmt_method, pmt_date, payee_fname, payee_lname, pmt_amt } = req.body;
  const employeeId = LOGGED_IN_USER_ID //req.session.employeeId; // <- logged-in admin ID

  if (!inv_id || !pmt_method || !pmt_date || !payee_fname || !payee_lname || !pmt_amt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validMethods = ['CASH', 'CREDIT', 'DEBIT', 'CHECK', 'ONLINE'];
  if (!validMethods.includes(pmt_method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  if (parseFloat(pmt_amt) <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than 0' });
  }

  db.get('SELECT * FROM CGY_INVOICE WHERE INV_ID = ?', [inv_id], (err, invoice) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.get(
      'SELECT COALESCE(SUM(PMT_AMT), 0) as total_paid FROM CGY_PAYMENT WHERE INV_ID = ?',
      [inv_id],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalPaid = result.total_paid || 0;
        const outstandingAmount = invoice.INV_AMT - totalPaid;

        if (pmt_amt > outstandingAmount) {
          return res.status(400).json({
            error: `Payment amount cannot exceed outstanding amount of ${outstandingAmount.toFixed(2)}`
          });
        }

        db.get("SELECT MAX(PMT_ID) as max_id FROM CGY_PAYMENT", [], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });

          const nextPmtId = (result.max_id || 0) + 1;

          const insertSql = `
            INSERT INTO CGY_PAYMENT (
              PMT_ID, 
              PMT_METHOD, 
              PMT_DATE, 
              PAYEE_FNAME, 
              PAYEE_LNAME, 
              PMT_AMT, 
              INV_ID
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          const insertParams = [
            nextPmtId,
            pmt_method,
            pmt_date,
            payee_fname,
            payee_lname,
            pmt_amt,
            inv_id
          ];

          db.run(insertSql, insertParams, function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // 🔍 Log the admin action
            const details = `Created payment of ${pmt_amt} for INV_ID ${inv_id} using ${pmt_method}`;
            logAdminAction(db, employeeId, 'CREATE', 'CGY_PAYMENT', nextPmtId, details);

            res.status(201).json({
              pmt_id: nextPmtId,
              inv_id,
              pmt_method,
              pmt_date,
              payee_fname,
              payee_lname,
              pmt_amt
            });
          });
        });
      }
    );
  });
});


router.put('/admin/studyroom/:id', (req, res) => {
  const { id } = req.params;
  const { CAPACITY } = req.body;

  if (!CAPACITY || isNaN(CAPACITY)) {
    return res.status(400).json({ error: 'Invalid capacity' });
  }

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION', err => {
      if (err) {
        console.error('Failed to begin transaction:', err.message);
        return res.status(500).json({ error: 'Database is busy. Try again.' });
      }

      db.run(
        'UPDATE CGY_STUDYRM SET CAPACITY = ? WHERE RM_ID = ?',
        [CAPACITY, id],
        function (err) {
          if (err) {
            console.error('DB error:', err.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          db.run('COMMIT', err => {
            if (err) {
              console.error('Commit failed:', err.message);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to commit transaction' });
            }

            res.sendStatus(200);
          });
        }
      );
    });
  });
});

// Get all topics
router.get('/admin/topics', (req, res) => {
  db.all('SELECT * FROM CGY_TOPIC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create event
router.post('/admin/events', (req, res) => {
  const { event_name, event_type, start_dt, end_dt, topic_id } = req.body;

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION', err => {
      if (err) {
        console.error('Failed to start transaction:', err.message);
        return res.status(500).json({ error: 'Could not start transaction. Please retry.' });
      }

      // Step 1: Insert into CGY_EVENTS
      db.run(
        `INSERT INTO CGY_EVENTS (EVENT_NAME, EVENT_TYPE, START_DT, END_DT, TOPIC_ID)
         VALUES (?, ?, ?, ?, ?)`,
        [event_name, event_type, start_dt, end_dt, topic_id],
        function (err) {
          if (err) {
            db.run('ROLLBACK');
            console.error('Insert into CGY_EVENTS failed:', err.message);
            return res.status(500).json({ error: err.message });
          }

          const eventId = this.lastID;

          // Step 2: Insert into SEMINAR or EXHIBITION
          const subTable = event_type === 'S' ? 'SEMINAR' : 'EXHIBITION';
          const subField = event_type === 'S' ? 'S_TYPE' : 'EXPENSES';
          const subValue = event_type === 'S' ? 'General' : 0.0;

          db.run(
            `INSERT INTO ${subTable} (EVENT_ID, ${subField}) VALUES (?, ?)`,
            [eventId, subValue],
            err2 => {
              if (err2) {
                db.run('ROLLBACK');
                console.error(`Insert into ${subTable} failed:`, err2.message);
                return res.status(500).json({ error: err2.message });
              }

              // Step 3: Commit transaction
              db.run('COMMIT', err3 => {
                if (err3) {
                  db.run('ROLLBACK');
                  console.error('Commit failed:', err3.message);
                  return res.status(500).json({ error: 'Failed to commit transaction' });
                }

                console.log(`Event created with ID ${eventId}`);
                res.status(201).json({ event_id: eventId });
              });
            }
          );
        }
      );
    });
  });
});



// Update event
router.put('/admin/events/:id', (req, res) => {
  const { id } = req.params;
  const { event_name, event_type, start_dt, end_dt, topic_id } = req.body;

  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION', err => {
      if (err) {
        console.error('Failed to begin transaction:', err.message);
        return res.status(500).json({ error: 'Database is busy. Try again.' });
      }

      db.run(
        `UPDATE CGY_EVENTS SET
          EVENT_NAME = ?, EVENT_TYPE = ?, START_DT = ?, END_DT = ?, TOPIC_ID = ?
         WHERE EVENT_ID = ?`,
        [event_name, event_type, start_dt, end_dt, topic_id, id],
        function (err) {
          if (err) {
            console.error('DB error during update:', err.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          db.run('COMMIT', err => {
            if (err) {
              console.error('Commit failed:', err.message);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to commit transaction' });
            }

            res.sendStatus(200);
          });
        }
      );
    });
  });
});




module.exports = router;

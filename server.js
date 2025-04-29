const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('Frontend'));

// Database connection
const db = new sqlite3.Database('./db/cgy_pal.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Mock user authentication (in a real app, use proper authentication)
// For demo purposes, we'll assume user is logged in with ID 1001
const LOGGED_IN_USER_ID = 1;

// API Routes

// Get all study rooms
app.get('/api/studyrooms', (req, res) => {
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
app.get('/api/reservations', (req, res) => {
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
app.get('/api/availability', (req, res) => {
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
app.post('/api/reservations', (req, res) => {
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
      
      db.run(insertSql, insertParams, function(err) {
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
app.delete('/api/reservations/:id', (req, res) => {
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
    
    db.run(deleteSql, [id], function(err) {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
      }
      
      res.json({ message: 'Reservation cancelled successfully' });
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close the database connection when the server closes
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});
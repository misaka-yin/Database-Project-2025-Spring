const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ensure your `data/` folder exists
const db = new sqlite3.Database(
	path.join(__dirname, '.', 'cgy_pal.db'),
	sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
	err => {
		if (err) return console.error('Database open error', err);
		console.log('Connected to sqlite database');
		// turn on FK enforcement
		db.run('PRAGMA foreign_keys = ON;', err => {
			if (err) console.error('Could not enable foreign keys', err);
		});
	}
);

module.exports = db;
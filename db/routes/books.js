const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/search', (req, res) => {
	const { isbn, author, title, sortBy, sortOrder } = req.query;

	if (!isbn && !author && !title) {
		return res.json({ books: [] });
	}

	let query = 'SELECT * FROM books WHERE 1=1';
	let params = [];

	if (isbn) {
		query += ' AND isbn = ?';
		params.push(isbn);
	}
	if (author) {
		query += ' AND author LIKE ?';
		params.push(`%${author}%`);
	}
	if (title) {
		query += ' AND title LIKE ?';
		params.push(`%${title}%`);
	}

	if (sortBy) {
		const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
		if (sortBy === 'author') {
			query += ` ORDER BY author ${order}`;
		} else if (sortBy === 'title') {
			query += ` ORDER BY title ${order}`;
		}
	}

	db.all(query, params, (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json({ books: rows });
	});
});

module.exports = router;

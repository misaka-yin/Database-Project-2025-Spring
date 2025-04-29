const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/search', (req, res) => {
	// pull status out of the query as well
	const { isbn, author, title, status, sortBy, sortOrder } = req.query;

	// require at least one filter
	if (!isbn && !author && !title && !status) {
		return res.json({ books: [] });
	}

	const whereClauses = [];
	const params = [];

	// ISBN exact match
	if (isbn) {
		whereClauses.push('b.ISBN = ?');
		params.push(isbn);
	}

	// Title substring match
	if (title) {
		whereClauses.push('b.BK_NAME LIKE ?');
		params.push(`%${title}%`);
	}

	// Author name match (first, last, or full)
	if (author) {
		whereClauses.push(`
      (
        a.A_FNAME LIKE ? OR
        a.A_LNAME LIKE ? OR
        (a.A_FNAME || ' ' || a.A_LNAME) LIKE ?
      )
    `);
		const pat = `%${author}%`;
		params.push(pat, pat, pat);
	}

	// Availability status filter
	if (status) {
		whereClauses.push('inv.BK_STATUS = ?');
		params.push(status);
	}

	const whereSQL = whereClauses.length
		? 'WHERE ' + whereClauses.join(' AND ')
		: '';

	// Sorting
	let orderSQL = '';
	if (['title', 'author', 'status'].includes(sortBy)) {
		let col;
		if (sortBy === 'title') col = 'b.BK_NAME';
		else if (sortBy === 'status') col = 'inv.BK_STATUS';
		else col = 'authors_list';
		const dir = sortOrder === 'desc' ? 'DESC' : 'ASC';
		orderSQL = `ORDER BY ${col} ${dir}`;
	}

	const sql = `
    SELECT
      b.ISBN,
      b.BK_NAME        AS title,
      GROUP_CONCAT(a.A_FNAME || ' ' || a.A_LNAME, ', ')
        AS authors_list,
      inv.BK_STATUS    AS status
    FROM CGY_BOOK         AS b
    JOIN CGY_BK_AUT       AS ba   ON ba.ISBN      = b.ISBN
    JOIN CGY_AUTHOR       AS a    ON ba.AUTHOR_ID = a.AUTHOR_ID
    LEFT JOIN CGY_BOOK_INV AS inv ON inv.ISBN     = b.ISBN
    ${whereSQL}
    GROUP BY b.ISBN
    ${orderSQL}
  `;

	console.log('SQL →', sql.trim());
	console.log('PARAMS →', params);

	db.all(sql, params, (err, rows) => {
		if (err) {
			return res.status(500).json({ error: err.message });
		}
		const books = rows.map(r => ({
			isbn: r.ISBN,
			title: r.title,
			author: r.authors_list,
			status: r.status || null
		}));
		res.json({ books });
	});
});

module.exports = router;
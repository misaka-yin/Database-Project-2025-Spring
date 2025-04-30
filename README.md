# CS-GY 6083 Database project, Spring 2025

This project implements a SQL-based database system interface for library management. The code consists of two main components, a backend to interface with the database, and a frontend to interact with the user.

## backend

To run the backend (which allows querying the SQLite database), in the `db` directory, run `npm start`. The backend server by default runs on `localhost:3000`.

This backend uses [Express](https://expressjs.com/) and [sqlite3](https://www.npmjs.com/package/sqlite3).
const express = require('express');
const db = require('./database');
var path = require('path');
const PORT = process.env.PORT || 3000;
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
var bookRouter = require('./routes/books');
const apiRouter = require('./routes/api');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../Frontend/public')));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);
app.use('/books',bookRouter);
app.use('/api',apiRouter);


module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server listening at http://localhost:${PORT}`);
    });
  }
  
  module.exports = app;
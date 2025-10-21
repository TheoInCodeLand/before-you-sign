// app.js - Main application entry point
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'before-you-sign-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// Make session available in all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.role || null;
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const dealershipRoutes = require('./routes/dealership');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const vehicleRoutes = require('./routes/vehicle');

// Use routes
app.use('/', authRoutes);
app.use('/dealership', dealershipRoutes);
app.use('/admin', adminRoutes);
app.use('/customer', customerRoutes);
app.use('/vehicle', vehicleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error',
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Before You Sign server running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
});

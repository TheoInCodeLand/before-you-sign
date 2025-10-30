// app.js - Main application entry point
// Before You Sign - Certified Ethical Dealership Programme

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs'); // ADDED - Required for directory creation
require('dotenv').config(); // Load environment variables

const app = express();

// ==========================================
// VIEW ENGINE SETUP
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CREATE REQUIRED DIRECTORIES
// ==========================================
const requiredDirs = [
  path.join(__dirname, 'public/uploads/vehicles'),
  path.join(__dirname, 'public/qr-codes'),
  path.join(__dirname, 'public/uploads/documents'),
  path.join(__dirname, 'logs')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

// ==========================================
// SESSION CONFIGURATION
// ==========================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'before-you-sign-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
  }
}));

// ==========================================
// MAKE SESSION AVAILABLE IN ALL VIEWS
// ==========================================
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.session.user || null;
  res.locals.userId = req.session.userId || null;
  res.locals.role = req.session.role || null;
  res.locals.username = req.session.username || null;
  next();
});

// ==========================================
// IMPORT ROUTES
// ==========================================
const authRoutes = require('./routes/auth');
const dealershipRoutes = require('./routes/dealership');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const vehicleRoutes = require('./routes/vehicle');

// ==========================================
// USE ROUTES
// ==========================================
app.use('/', authRoutes);
app.use('/dealership', dealershipRoutes);
app.use('/admin', adminRoutes);
app.use('/customer', customerRoutes);
app.use('/vehicle', vehicleRoutes);

// ==========================================
// 404 ERROR HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('error', {
      title: 'Upload Error',
      message: 'File size exceeds the maximum limit of 5MB.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).render('error', {
      title: 'Upload Error',
      message: 'Too many files. Maximum is 10 files.',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
  
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong! Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Before You Sign - Certified Ethical Dealership Programme');
  console.log('='.repeat(60));
  console.log(`📍 Server running on http://${HOST}:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60) + '\n');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📛 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📛 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

module.exports = app;

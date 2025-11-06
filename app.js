// app.js - Main application entry point
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// ===== DIRECTORY SETUP =====
const isProd = process.env.NODE_ENV === 'production';
const uploadBaseDir = isProd ? '/tmp/uploads' : path.join(__dirname, 'public/uploads');
const qrBaseDir = isProd ? '/tmp/qr-codes' : path.join(__dirname, 'public/qr-codes');
const logsDir = isProd ? '/tmp/logs' : path.join(__dirname, 'logs');

const requiredDirs = [
  path.join(uploadBaseDir, 'vehicles'),
  qrBaseDir,
  path.join(uploadBaseDir, 'documents'),
  logsDir
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'before-you-sign-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.session.user || null;
  res.locals.userId = req.session.userId || null;
  res.locals.role = req.session.role || null;
  res.locals.username = req.session.username || null;
  next();
});

// ====================
// IMPORT & USE ROUTES
// ====================
const authRoutes = require('./routes/auth');
const dealershipRoutes = require('./routes/dealership');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const vehicleRoutes = require('./routes/vehicle');

app.use('/', authRoutes);
app.use('/dealership', dealershipRoutes);
app.use('/admin', adminRoutes);
app.use('/customer', customerRoutes);
app.use('/vehicle', vehicleRoutes);

// ====================
// STATIC FILE SERVING (/tmp for Vercel)
// ====================
app.get('/uploads/vehicles/:filename', (req, res) => {
  const filePath = path.join(isProd ? '/tmp/uploads/vehicles' : path.join(__dirname, 'public/uploads/vehicles'), req.params.filename);
  res.sendFile(filePath);
});
app.get('/qr-codes/:filename', (req, res) => {
  const filePath = path.join(isProd ? '/tmp/qr-codes' : path.join(__dirname, 'public/qr-codes'), req.params.filename);
  res.sendFile(filePath);
});
app.get('/uploads/documents/:filename', (req, res) => {
  const filePath = path.join(isProd ? '/tmp/uploads/documents' : path.join(__dirname, 'public/uploads/documents'), req.params.filename);
  res.sendFile(filePath);
});

app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

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

app.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on port ${PORT}`);
}); 

module.exports = app;

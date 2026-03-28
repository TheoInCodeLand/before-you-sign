// app.js - Main application entry point WITH SEO
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const auditLog = require('./middleware/audit');
const { seoMiddleware } = require('./middleware/seo'); // NEW: SEO middleware

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

// ===== SEO MIDDLEWARE (NEW) =====
app.use(seoMiddleware);

// User session middleware
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    email: req.session.email
  } : null;
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
// STATIC FILE SERVING
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

// ====================
// SITEMAP ROUTE (NEW)
// ====================
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// ====================
// ROBOTS.TXT ROUTE (NEW)
// ====================
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

// ====================
// WEBMANIFEST ROUTE (NEW)
// ====================
app.get('/site.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'site.webmanifest'));
});

app.use(auditLog);

// ====================
// 404 HANDLER (UPDATED WITH SEO)
// ====================
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found | Before You Sign',
    message: 'The page you are looking for does not exist.',
    noindex: true,
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Page Not Found', active: true }
    ]
  });
});

// ====================
// ERROR HANDLER (UPDATED WITH SEO)
// ====================
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        user: req.session.userId
    });
    
    const isDev = process.env.NODE_ENV === 'development';
    
    if (err.code === '23505') {
        return res.status(400).render('error', {
            title: 'Duplicate Entry | Before You Sign',
            message: 'This record already exists.',
            error: isDev ? err : {},
            noindex: true
        });
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).render('error', {
            title: 'File Too Large | Before You Sign',
            message: 'Maximum file size is 5MB.',
            error: isDev ? err : {},
            noindex: true
        });
    }
    
    res.status(500).render('error', {
        title: 'Server Error | Before You Sign',
        message: isDev ? err.message : 'Something went wrong. Please try again.',
        error: isDev ? err : {},
        noindex: true
    });
});

app.listen(PORT, () => {
  console.log(`✓ Before You Sign Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Visit: http://localhost:${PORT}`);
});

module.exports = app;
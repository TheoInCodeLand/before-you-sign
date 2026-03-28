// app.js - Main Application Entry Point (Production Ready)
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Custom Middleware
const auditLog = require('./middleware/audit');
const { seoMiddleware } = require('./middleware/seo');

// Security & Performance Packages
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 1. SECURITY & PERFORMANCE MIDDLEWARE
// ==========================================
// Hide Express signature and set security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabled temporarily to allow external QR scripts and fonts
}));
app.use(cors());

// Compress responses for faster load times on mobile data
app.use(compression());

// Basic Rate Limiting to prevent brute-force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/login', limiter); // Apply rate limiting to login routes

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cache static assets for 1 year to improve returning visitor speed
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: true
}));

// ==========================================
// 2. VERCEL DIRECTORY SETUP
// ==========================================
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

// ==========================================
// 3. SESSION & LOCAL VARIABLES
// ==========================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'before-you-sign-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 Day
    httpOnly: true,
    secure: isProd
  }
}));

// Construct user object from session properties
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

// ==========================================
// 4. GLOBAL SEO MIDDLEWARE
// ==========================================
app.use(seoMiddleware);

// ==========================================
// 5. IMPORT & USE ROUTES
// ==========================================
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

// ==========================================
// 6. STATIC FILE SERVING (/tmp for Vercel)
// ==========================================
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

// ==========================================
// 7. SEO METADATA ROUTES (With Caching)
// ==========================================
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/site.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'public', 'site.webmanifest'));
});

app.use(auditLog);

// ==========================================
// 8. SEO-FRIENDLY ERROR HANDLERS
// ==========================================
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found | Before You Sign',
    message: 'The page you are looking for does not exist.',
    noindex: true, // Prevents Google from indexing 404 pages
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Page Not Found', active: true }
    ]
  });
});

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
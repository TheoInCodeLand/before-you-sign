// routes/auth.js - Main Public Routes & Authentication
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../database/init-db');

// Middleware to check if authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

// Middleware to check role
function hasRole(role) {
  return (req, res, next) => {
    if (req.session && req.session.role === role) {
      return next();
    }
    res.status(403).send('Access denied');
  };
}

// Home page
router.get('/', (req, res) => {
  res.render('index', { title: 'Before You Sign - Home' });
});

// ==========================================
//  NEW: PUBLIC VEHICLE SEARCH ROUTE
// ==========================================
router.get('/vehicles', async (req, res) => {
  try {
    // 1. Smart Redirect: If searching VIN, check for exact match
    if (req.query.vin) {
      const searchVin = `%${req.query.vin.trim()}%`;
      const matchRes = await pool.query(
        "SELECT id FROM vehicles WHERE vin ILIKE $1 AND status = 'verified'", 
        [searchVin]
      );
      
      // If exactly one car is found, go straight to details page
      if (matchRes.rows.length === 1) {
        return res.redirect(`/vehicle/${matchRes.rows[0].id}`);
      }
    }

    // 2. Standard Search & Filter Logic
    const page = parseInt(req.query.page) || 1;
    const limit = 9; 
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT v.*, d.business_name, d.certification_status
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      WHERE v.status = 'verified'
    `;
    
    const params = [];
    
    // Filters
    if (req.query.vin) {
      params.push(`%${req.query.vin.trim()}%`);
      query += ` AND v.vin ILIKE $${params.length}`;
    }
    if (req.query.make) {
      params.push(`%${req.query.make}%`);
      query += ` AND v.make ILIKE $${params.length}`;
    }
    if (req.query.minPrice) {
      params.push(req.query.minPrice);
      query += ` AND v.price >= $${params.length}`;
    }
    if (req.query.maxPrice) {
      params.push(req.query.maxPrice);
      query += ` AND v.price <= $${params.length}`;
    }
    if (req.query.bodyType && req.query.bodyType !== 'all') {
      params.push(req.query.bodyType);
      query += ` AND v.body_type = $${params.length}`;
    }
    
    // Pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
    const totalRes = await pool.query(countQuery, params);
    const totalVehicles = parseInt(totalRes.rows[0].total);
    const totalPages = Math.ceil(totalVehicles / limit);
    
    params.push(limit);
    query += ` ORDER BY v.created_at DESC LIMIT $${params.length}`;
    
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    const { rows } = await pool.query(query, params);
    
    res.render('customer/vehicles', {
      title: 'Browse Vehicles',
      vehicles: rows || [],
      filters: req.query,
      currentPage: page,
      totalPages: totalPages,
      totalVehicles: totalVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// ==========================================
//  AUTH ROUTES
// ==========================================

// Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(`/${req.session.role}`);
  }
  res.render('login', { title: 'Login', error: null });
});

// Login POST
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
      
    if (!user) {
      return res.render('login', { title: 'Login', error: 'Invalid username or password' });
    }
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { title: 'Login', error: 'Invalid username or password' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.email = user.email;
    
    if (user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else if (user.role === 'dealership') {
      res.redirect('/dealership/dashboard');
    } else {
      res.redirect('/customer/dashboard');
    }
  } catch (error) {
    console.error(error);
    res.render('login', { title: 'Login', error: 'An error occurred' });
  }
});

// Register dealership page
router.get('/register/dealership', (req, res) => {
  res.render('register-dealership', { title: 'Dealership Registration', error: null });
});

// Register dealership POST
router.post('/register/dealership', async (req, res) => {
  const {
    username, email, password, confirmPassword,
    businessName, registrationNumber, licenseNumber,
    yearEstablished, phone, address, city, postalCode,
    website, operatingHours, description
  } = req.body;
  
  if (password !== confirmPassword) {
    return res.render('register-dealership', { 
      title: 'Dealership Registration', 
      error: 'Passwords do not match' 
    });
  }
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userRes = await client.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, 'dealership']
    );
    const userId = userRes.rows[0].id;

    await client.query(`
      INSERT INTO dealerships 
      (user_id, business_name, registration_number, license_number, year_established,
       email, phone, address, city, postal_code, website, operating_hours, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [userId, businessName, registrationNumber, licenseNumber, yearEstablished,
       email, phone, address, city, postalCode, website, operatingHours, description]
    );

    await client.query('COMMIT');
    res.redirect('/login');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
        return res.render('register-dealership', { 
            title: 'Dealership Registration', 
            error: 'Username, Email, or Registration Number already exists' 
        });
    }
    res.render('register-dealership', { 
      title: 'Dealership Registration', 
      error: 'An error occurred' 
    });
  } finally {
    client.release();
  }
});

// Register customer page
router.get('/register/customer', (req, res) => {
  res.render('register-customer', { title: 'Customer Registration', error: null });
});

// Register customer POST
router.post('/register/customer', async (req, res) => {
  const { username, email, password, confirmPassword, fullName, phone, address, city, postalCode } = req.body;
  
  if (password !== confirmPassword) {
    return res.render('register-customer', { 
      title: 'Customer Registration', 
      error: 'Passwords do not match' 
    });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userRes = await client.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, 'customer']
    );
    const userId = userRes.rows[0].id;

    await client.query(
      'INSERT INTO customers (user_id, full_name, phone, address, city, postal_code) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, fullName, phone, address, city, postalCode]
    );

    await client.query('COMMIT');
    res.redirect('/login');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
        return res.render('register-customer', { 
            title: 'Customer Registration', 
            error: 'Username or email already exists' 
        });
    }
    res.render('register-customer', { 
      title: 'Customer Registration', 
      error: 'An error occurred' 
    });
  } finally {
    client.release();
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Export middleware
router.isAuthenticated = isAuthenticated;
router.hasRole = hasRole;

module.exports = router;
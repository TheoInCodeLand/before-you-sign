// routes/auth.js - Authentication routes
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
    
    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.email = user.email;
    
    // Redirect based on role
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
    
    // Insert User
    const userRes = await client.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, 'dealership']
    );
    const userId = userRes.rows[0].id;

    // Insert Dealership Profile
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
    // Check for unique constraint violation code '23505'
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
    
    // Insert User
    const userRes = await client.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, 'customer']
    );
    const userId = userRes.rows[0].id;

    // Insert Customer Profile
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

// Export middleware along with router
router.isAuthenticated = isAuthenticated;
router.hasRole = hasRole;

module.exports = router;
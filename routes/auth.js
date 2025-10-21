// routes/auth.js - Authentication routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/init-db');

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
  if (req.session.userId) {
    return res.redirect(`/${req.session.role}`);
  }
  res.render('login', { title: 'Login', error: null });
});

// Login POST
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.render('login', { title: 'Login', error: 'Database error' });
      }
      
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
    });
  } catch (error) {
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
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'dealership'],
      function(err) {
        if (err) {
          return res.render('register-dealership', { 
            title: 'Dealership Registration', 
            error: 'Username or email already exists' 
          });
        }
        
        const userId = this.lastID;
        
        db.run(`
          INSERT INTO dealerships 
          (user_id, business_name, registration_number, license_number, year_established,
           email, phone, address, city, postal_code, website, operating_hours, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, businessName, registrationNumber, licenseNumber, yearEstablished,
           email, phone, address, city, postalCode, website, operatingHours, description],
          (err) => {
            if (err) {
              return res.render('register-dealership', { 
                title: 'Dealership Registration', 
                error: 'Error creating dealership profile' 
              });
            }
            
            res.redirect('/login');
          }
        );
      }
    );
  } catch (error) {
    res.render('register-dealership', { 
      title: 'Dealership Registration', 
      error: 'An error occurred' 
    });
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
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'customer'],
      function(err) {
        if (err) {
          return res.render('register-customer', { 
            title: 'Customer Registration', 
            error: 'Username or email already exists' 
          });
        }
        
        const userId = this.lastID;
        
        db.run(
          'INSERT INTO customers (user_id, full_name, phone, address, city, postal_code) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, fullName, phone, address, city, postalCode],
          (err) => {
            if (err) {
              return res.render('register-customer', { 
                title: 'Customer Registration', 
                error: 'Error creating customer profile' 
              });
            }
            
            res.redirect('/login');
          }
        );
      }
    );
  } catch (error) {
    res.render('register-customer', { 
      title: 'Customer Registration', 
      error: 'An error occurred' 
    });
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

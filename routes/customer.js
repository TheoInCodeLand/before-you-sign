// routes/customer.js - Customer routes
const express = require('express');
const router = express.Router();
const db = require('../database/init-db');
const { isAuthenticated, hasRole } = require('./auth');

// Customer dashboard (requires authentication)
router.get('/dashboard', isAuthenticated, hasRole('customer'), (req, res) => {
  db.get('SELECT * FROM customers WHERE user_id = ?', [req.session.userId], (err, customer) => {
    db.all(`
      SELECT d.*, v.vin, v.make, v.model
      FROM disputes d
      JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
      LIMIT 5
    `, [customer ? customer.id : 0], (err, disputes) => {
      res.render('customer/dashboard', {
        title: 'Customer Dashboard',
        customer: customer,
        recentDisputes: disputes || []
      });
    });
  });
});

// Browse dealerships (public)
router.get('/browse-dealerships', (req, res) => {
  db.all(`
    SELECT d.*,
           (SELECT COUNT(*) FROM vehicles WHERE dealership_id = d.id AND status = 'verified') as vehicle_count
    FROM dealerships d
    WHERE d.certification_status = 'active'
    ORDER BY d.business_name
  `, [], (err, dealerships) => {
    res.render('customer/browse-dealerships', {
      title: 'Certified Dealerships',
      dealerships: dealerships || []
    });
  });
});

// Browse vehicles (public)
router.get('/vehicles', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 9; // 9 cars per page
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT v.*, d.business_name, d.certification_status
    FROM vehicles v
    JOIN dealerships d ON v.dealership_id = d.id
    WHERE v.status = 'verified'
  `;
  
  const params = [];
  const filters = [];
  
  if (req.query.make) {
    filters.push('v.make LIKE ?');
    params.push(`%${req.query.make}%`);
  }
  if (req.query.minPrice) {
    filters.push('v.price >= ?');
    params.push(req.query.minPrice);
  }
  if (req.query.maxPrice) {
    filters.push('v.price <= ?');
    params.push(req.query.maxPrice);
  }
  if (req.query.bodyType && req.query.bodyType !== 'all') {
    filters.push('v.body_type = ?');
    params.push(req.query.bodyType);
  }
  
  if (filters.length > 0) {
    query += ' AND ' + filters.join(' AND ');
  }
  
  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  
  // Add pagination to the main query
  query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  // First get the total count
  db.get(countQuery, params.slice(0, -2), (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    
    const totalVehicles = countResult.total;
    const totalPages = Math.ceil(totalVehicles / limit);
    
    // Then get the paginated vehicles
    db.all(query, params, (err, vehicles) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      
      res.render('customer/vehicles', {
        title: 'Browse Vehicles',
        vehicles: vehicles || [],
        filters: req.query,
        currentPage: page,
        totalPages: totalPages,
        totalVehicles: totalVehicles
      });
    });
  });
});

// Report dispute page
router.get('/report-dispute', isAuthenticated, hasRole('customer'), (req, res) => {
  const vehicleId = req.query.vehicleId;
  
  db.get('SELECT * FROM customers WHERE user_id = ?', [req.session.userId], (err, customer) => {
    if (vehicleId) {
      db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId], (err, vehicle) => {
        res.render('customer/report-dispute', {
          title: 'Report Discrepancy',
          customer: customer,
          vehicle: vehicle,
          error: null,
          success: null
        });
      });
    } else {
      res.render('customer/report-dispute', {
        title: 'Report Discrepancy',
        customer: customer,
        vehicle: null,
        error: null,
        success: null
      });
    }
  });
});

// Submit dispute
router.post('/report-dispute', isAuthenticated, hasRole('customer'), (req, res) => {
  const { vehicleId, discrepancyType, description } = req.body;
  
  db.get('SELECT id FROM customers WHERE user_id = ?', [req.session.userId], (err, customer) => {
    if (!customer) {
      return res.send('Customer profile not found');
    }
    
    db.run(`
      INSERT INTO disputes (customer_id, vehicle_id, discrepancy_type, description)
      VALUES (?, ?, ?, ?)
    `, [customer.id, vehicleId, discrepancyType, description], (err) => {
      if (err) {
        return res.send('Error submitting dispute');
      }
      
      res.redirect('/customer/my-disputes');
    });
  });
});

// My disputes
router.get('/my-disputes', isAuthenticated, hasRole('customer'), (req, res) => {
  db.get('SELECT id FROM customers WHERE user_id = ?', [req.session.userId], (err, customer) => {
    if (!customer) {
      return res.send('Customer profile not found');
    }
    
    db.all(`
      SELECT d.*, v.vin, v.make, v.model, v.year
      FROM disputes d
      JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
    `, [customer.id], (err, disputes) => {
      res.render('customer/my-disputes', {
        title: 'My Disputes',
        disputes: disputes || []
      });
    });
  });
});

module.exports = router;

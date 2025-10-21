// routes/admin.js - Admin routes
const express = require('express');
const router = express.Router();
const db = require('../database/init-db');
const { isAuthenticated, hasRole } = require('./auth');

router.use(isAuthenticated);
router.use(hasRole('admin'));

// Admin Dashboard
router.get('/dashboard', (req, res) => {
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM dealerships) as total_dealerships,
      (SELECT COUNT(*) FROM dealerships WHERE certification_status = 'active') as active_dealerships,
      (SELECT COUNT(*) FROM dealerships WHERE certification_status = 'pending') as pending_dealerships,
      (SELECT COUNT(*) FROM vehicles) as total_vehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'pending_verification') as pending_vehicles,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'verified') as verified_vehicles,
      (SELECT COUNT(*) FROM disputes) as total_disputes
  `, [], (err, stats) => {
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: stats || {}
    });
  });
});

// Manage Dealerships
router.get('/dealerships', (req, res) => {
  db.all(`
    SELECT d.*, u.username, u.email,
           (SELECT COUNT(*) FROM vehicles WHERE dealership_id = d.id) as vehicle_count
    FROM dealerships d
    JOIN users u ON d.user_id = u.id
    ORDER BY d.created_at DESC
  `, [], (err, dealerships) => {
    res.render('admin/dealerships', {
      title: 'Manage Dealerships',
      dealerships: dealerships || []
    });
  });
});

// Dealership details
router.get('/dealership/:id', (req, res) => {
  db.get(`
    SELECT d.*, u.username, u.email
    FROM dealerships d
    JOIN users u ON d.user_id = u.id
    WHERE d.id = ?
  `, [req.params.id], (err, dealership) => {
    if (!dealership) {
      return res.send('Dealership not found');
    }
    
    db.all(
      'SELECT * FROM vehicles WHERE dealership_id = ? ORDER BY created_at DESC',
      [req.params.id],
      (err, vehicles) => {
        res.render('admin/dealership-details', {
          title: 'Dealership Details',
          dealership: dealership,
          vehicles: vehicles || []
        });
      }
    );
  });
});

// Update dealership certification
router.post('/dealership/:id/update-status', (req, res) => {
  const { status } = req.body;
  db.run(
    'UPDATE dealerships SET certification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, req.params.id],
    (err) => {
      res.redirect(`/admin/dealership/${req.params.id}`);
    }
  );
});

// Verify Vehicles - List
router.get('/verify-vehicles', (req, res) => {
  db.all(`
    SELECT v.*, d.business_name
    FROM vehicles v
    JOIN dealerships d ON v.dealership_id = d.id
    WHERE v.status = 'pending_verification'
    ORDER BY v.created_at ASC
  `, [], (err, vehicles) => {
    res.render('admin/verify-vehicles', {
      title: 'Verify Vehicles',
      vehicles: vehicles || []
    });
  });
});

// Verify Vehicle - Detail
router.get('/verify-vehicle/:id', (req, res) => {
  db.get(`
    SELECT v.*, d.business_name, d.certification_status
    FROM vehicles v
    JOIN dealerships d ON v.dealership_id = d.id
    WHERE v.id = ?
  `, [req.params.id], (err, vehicle) => {
    if (!vehicle) {
      return res.send('Vehicle not found');
    }
    
    res.render('admin/verify-vehicle-detail', {
      title: 'Verify Vehicle',
      vehicle: vehicle,
      error: null,
      success: null
    });
  });
});

// Process Vehicle Verification
router.post('/verify-vehicle/:id', (req, res) => {
  const { action, notes, rejectionReason, vinVerified, mileageVerified, 
          serviceHistoryVerified, ownershipVerified, accidentHistoryVerified, 
          recallVerified } = req.body;
  
  if (action === 'approve') {
    db.run(`
      UPDATE vehicles 
      SET status = 'verified', 
          verification_notes = ?,
          verified_by = ?,
          verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [notes, req.session.userId, req.params.id], function(err) {
      if (err) {
        return res.send('Error verifying vehicle');
      }
      
      // Insert verification checklist
      db.run(`
        INSERT INTO verification_checklist 
        (vehicle_id, vin_verified, mileage_verified, service_history_verified,
         ownership_verified, accident_history_verified, recall_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [req.params.id, vinVerified ? 1 : 0, mileageVerified ? 1 : 0,
          serviceHistoryVerified ? 1 : 0, ownershipVerified ? 1 : 0,
          accidentHistoryVerified ? 1 : 0, recallVerified ? 1 : 0]);
      
      res.redirect('/admin/verify-vehicles');
    });
  } else if (action === 'reject') {
    db.run(`
      UPDATE vehicles 
      SET status = 'rejected',
          rejection_reason = ?,
          verification_notes = ?,
          verified_by = ?,
          verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [rejectionReason, notes, req.session.userId, req.params.id], (err) => {
      res.redirect('/admin/verify-vehicles');
    });
  }
});

// All Verified Vehicles
router.get('/verified-vehicles', (req, res) => {
  db.all(`
    SELECT v.*, d.business_name,
           u.username as verified_by_username
    FROM vehicles v
    JOIN dealerships d ON v.dealership_id = d.id
    LEFT JOIN users u ON v.verified_by = u.id
    WHERE v.status = 'verified'
    ORDER BY v.verified_at DESC
  `, [], (err, vehicles) => {
    res.render('admin/verified-vehicles', {
      title: 'Verified Vehicles',
      vehicles: vehicles || []
    });
  });
});

// Manage Disputes
router.get('/disputes', (req, res) => {
  db.all(`
    SELECT d.*, c.full_name as customer_name,
           v.vin, v.make, v.model, v.year
    FROM disputes d
    JOIN customers c ON d.customer_id = c.id
    JOIN vehicles v ON d.vehicle_id = v.id
    ORDER BY d.created_at DESC
  `, [], (err, disputes) => {
    res.render('admin/disputes', {
      title: 'Manage Disputes',
      disputes: disputes || []
    });
  });
});

// Update dispute status
router.post('/dispute/:id/update', (req, res) => {
  const { status, adminResponse } = req.body;
  const resolvedAt = status === 'resolved' ? 'CURRENT_TIMESTAMP' : 'NULL';
  
  db.run(`
    UPDATE disputes 
    SET status = ?, admin_response = ?, resolved_at = ${resolvedAt}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, adminResponse, req.params.id], (err) => {
    res.redirect('/admin/disputes');
  });
});

module.exports = router;

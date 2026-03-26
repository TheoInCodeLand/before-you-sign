// routes/admin.js - Admin routes (PostgreSQL Verified)
const express = require('express');
const router = express.Router();
const pool = require('../database/init-db');
const { isAuthenticated, hasRole } = require('./auth');

router.use(isAuthenticated);
router.use(hasRole('admin'));

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM dealerships) as total_dealerships,
        (SELECT COUNT(*) FROM dealerships WHERE certification_status = 'active') as active_dealerships,
        (SELECT COUNT(*) FROM dealerships WHERE certification_status = 'pending') as pending_dealerships,
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'pending_verification') as pending_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'verified') as verified_vehicles,
        (SELECT COUNT(*) FROM disputes) as total_disputes
    `);
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: rows[0] || {}
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).send('Database error');
  }
});

// Manage Dealerships
router.get('/dealerships', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, u.username, u.email,
             (SELECT COUNT(*) FROM vehicles WHERE dealership_id = d.id) as vehicle_count
      FROM dealerships d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
    res.render('admin/dealerships', {
      title: 'Manage Dealerships',
      dealerships: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Dealership details
router.get('/dealership/:id', async (req, res) => {
  try {
    // Fetch Dealership
    const dealerRes = await pool.query(`
      SELECT d.*, u.username, u.email
      FROM dealerships d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [req.params.id]);

    const dealership = dealerRes.rows[0];
    if (!dealership) {
      return res.send('Dealership not found');
    }
    
    // Fetch Vehicles for that dealership
    const vehiclesRes = await pool.query(
      'SELECT * FROM vehicles WHERE dealership_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.render('admin/dealership-details', {
      title: 'Dealership Details',
      dealership: dealership,
      vehicles: vehiclesRes.rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Update dealership certification
router.post('/dealership/:id/update-status', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      'UPDATE dealerships SET certification_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, req.params.id]
    );
    res.redirect(`/admin/dealership/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating status');
  }
});

// Verify Vehicles - List
router.get('/verify-vehicles', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      WHERE v.status = 'pending_verification'
      ORDER BY v.created_at ASC
    `);
    res.render('admin/verify-vehicles', {
      title: 'Verify Vehicles',
      vehicles: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Verify Vehicle - Detail
router.get('/verify-vehicle/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name, d.certification_status
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      WHERE v.id = $1
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.send('Vehicle not found');
    }
    
    res.render('admin/verify-vehicle-detail', {
      title: 'Verify Vehicle',
      vehicle: rows[0],
      error: null,
      success: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Process Vehicle Verification
router.post('/verify-vehicle/:id', async (req, res) => {
  const { 
    action, notes, rejectionReason, 
    vinVerified, plateNumberVerified, engineNumberVerified,
    mileageVerified, serviceHistoryVerified, ownershipVerified, 
    accidentHistoryVerified, recallVerified,
    registrationVerified, engineSpecsVerified
  } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    if (action === 'approve') {
      // 1. Update Vehicle Status
      await client.query(`
        UPDATE vehicles 
        SET status = 'verified', 
            verification_notes = $1,
            verified_by = $2,
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [notes, req.session.userId, req.params.id]);
      
      // 2. Handle Verification Checklist (Delete old, Insert new)
      // This is the safest way to "replace" without complex Upsert logic
      await client.query('DELETE FROM verification_checklist WHERE vehicle_id = $1', [req.params.id]);
      
      await client.query(`
        INSERT INTO verification_checklist 
        (vehicle_id, vin_verified, plate_number_verified, engine_number_verified,
         mileage_verified, service_history_verified, ownership_verified,
         accident_history_verified, recall_verified, registration_verified,
         engine_specs_verified, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      `, [
        req.params.id, 
        vinVerified ? true : false, 
        plateNumberVerified ? true : false,
        engineNumberVerified ? true : false,
        mileageVerified ? true : false,
        serviceHistoryVerified ? true : false, 
        ownershipVerified ? true : false,
        accidentHistoryVerified ? true : false, 
        recallVerified ? true : false,
        registrationVerified ? true : false,
        engineSpecsVerified ? true : false
      ]);

    } else if (action === 'reject') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        await client.query('ROLLBACK');
        return res.send('Rejection reason is required');
      }
      
      await client.query(`
        UPDATE vehicles 
        SET status = 'rejected',
            rejection_reason = $1,
            verification_notes = $2,
            verified_by = $3,
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [rejectionReason, notes, req.session.userId, req.params.id]);
    } else {
      await client.query('ROLLBACK');
      return res.send('Invalid action');
    }

    await client.query('COMMIT');
    res.redirect('/admin/verify-vehicles');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Verification error:', err);
    res.send('Error verifying vehicle');
  } finally {
    client.release();
  }
});

// All Verified Vehicles
router.get('/verified-vehicles', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name,
             u.username as verified_by_username
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      LEFT JOIN users u ON v.verified_by = u.id
      WHERE v.status = 'verified'
      ORDER BY v.verified_at DESC
    `);
    res.render('admin/verified-vehicles', {
      title: 'Verified Vehicles',
      vehicles: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Manage Disputes
router.get('/disputes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, c.full_name as customer_name,
             v.vin, v.make, v.model, v.year
      FROM disputes d
      JOIN customers c ON d.customer_id = c.id
      JOIN vehicles v ON d.vehicle_id = v.id
      ORDER BY d.created_at DESC
    `);
    res.render('admin/disputes', {
      title: 'Manage Disputes',
      disputes: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Update dispute status
router.post('/dispute/:id/update', async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    
    // Conditional logic for setting the 'resolved_at' timestamp
    let query = `UPDATE disputes SET status = $1, admin_response = $2, updated_at = CURRENT_TIMESTAMP`;
    if (status === 'resolved') {
        query += `, resolved_at = CURRENT_TIMESTAMP`;
    } else {
        query += `, resolved_at = NULL`;
    }
    query += ` WHERE id = $3`;

    await pool.query(query, [status, adminResponse, req.params.id]);
    res.redirect('/admin/disputes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating dispute');
  }
});

module.exports = router;
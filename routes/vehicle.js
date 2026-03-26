// routes/vehicle.js - Public vehicle routes (PostgreSQL Verified)
const express = require('express');
const router = express.Router();
const pool = require('../database/init-db');

// View vehicle details by ID
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name, d.certification_status, d.phone, d.email, d.website,
             vc.vin_verified, vc.plate_number_verified, vc.engine_number_verified,
             vc.mileage_verified, vc.service_history_verified,
             vc.ownership_verified, vc.accident_history_verified, vc.recall_verified,
             vc.registration_verified, vc.engine_specs_verified,
             u.username as verified_by_username
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      LEFT JOIN verification_checklist vc ON v.id = vc.vehicle_id
      LEFT JOIN users u ON v.verified_by = u.id
      WHERE v.id = $1 AND v.status = 'verified'
    `, [req.params.id]);

    const vehicle = rows[0];
    if (!vehicle) {
      return res.status(404).send('Vehicle not found or not verified');
    }
    
    res.render('customer/vehicle-details', {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      vehicle: vehicle,
      role: req.session?.role || null
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

// View vehicle details by VIN (for QR scanning)
router.get('/vin/:vin', async (req, res) => {
  const vin = req.params.vin.toUpperCase();
  
  // Validate VIN format
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return res.status(400).json({
      error: 'Invalid VIN format',
      message: 'VIN must be 17 characters with no I, O, or Q'
    });
  }
  
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name, d.certification_status, d.phone, d.email, d.website,
             d.id as dealership_id,
             vc.vin_verified, vc.plate_number_verified, vc.engine_number_verified,
             vc.mileage_verified, vc.service_history_verified,
             vc.ownership_verified, vc.accident_history_verified, vc.recall_verified,
             vc.registration_verified, vc.engine_specs_verified,
             u.username as verified_by_username
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      LEFT JOIN verification_checklist vc ON v.id = vc.vehicle_id
      LEFT JOIN users u ON v.verified_by = u.id
      WHERE v.vin = $1 AND v.status = 'verified'
    `, [vin]);

    const vehicle = rows[0];
    
    if (!vehicle) {
      return res.status(404).json({
        error: 'Vehicle not found',
        message: `No verified vehicle found with VIN: ${vin}`
      });
    }
    
    // Check if this is an AJAX request
    if (req.headers['accept'] === 'application/json' || req.query.json === 'true') {
      return res.json({
        success: true,
        vehicle: vehicle,
        redirectUrl: `/vehicle/${vehicle.id}`
      });
    }
    
    // Otherwise render the full page
    res.render('customer/vehicle-details', {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      vehicle: vehicle,
      role: req.session?.role || null
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', message: 'Error retrieving vehicle' });
  }
});

// Search by VIN
router.get('/search/vin', async (req, res) => {
  const vin = req.query.vin;
  
  if (!vin) {
    return res.render('search-vin', {
      title: 'Search Vehicle',
      vehicle: null,
      searched: false
    });
  }
  
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name, d.certification_status
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      WHERE v.vin = $1 AND v.status = 'verified'
    `, [vin.toUpperCase()]);

    res.render('search-vin', {
      title: 'Search Vehicle',
      vehicle: rows[0] || null,
      searched: true,
      searchedVin: vin
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Database error' });
  }
});

module.exports = router;
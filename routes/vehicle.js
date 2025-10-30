// routes/vehicle.js - Public vehicle routes with QR scanning support

const express = require('express');
const router = express.Router();
const db = require('../database/init-db');

// View vehicle details by ID
router.get('/:id', (req, res) => {
  db.get(`
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
    WHERE v.id = ? AND v.status = 'verified'
  `, [req.params.id], (err, vehicle) => {
    if (!vehicle) {
      return res.status(404).send('Vehicle not found or not verified');
    }
    
    res.render('customer/vehicle-details', {
      title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      vehicle: vehicle,
      role: req.session?.role || null
    });
  });
});

// View vehicle details by VIN (for QR scanning)
router.get('/vin/:vin', (req, res) => {
  const vin = req.params.vin.toUpperCase();
  
  // Validate VIN format
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return res.status(400).json({
      error: 'Invalid VIN format',
      message: 'VIN must be 17 characters with no I, O, or Q'
    });
  }
  
  db.get(`
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
    WHERE v.vin = ? AND v.status = 'verified'
  `, [vin], (err, vehicle) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        error: 'Database error',
        message: 'An error occurred while retrieving vehicle information'
      });
    }
    
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
  });
});

// Search by VIN (backward compatibility)
router.get('/search/vin', (req, res) => {
  const vin = req.query.vin;
  
  if (!vin) {
    return res.render('search-vin', {
      title: 'Search Vehicle',
      vehicle: null,
      searched: false
    });
  }
  
  db.get(`
    SELECT v.*, d.business_name, d.certification_status
    FROM vehicles v
    JOIN dealerships d ON v.dealership_id = d.id
    WHERE v.vin = ? AND v.status = 'verified'
  `, [vin.toUpperCase()], (err, vehicle) => {
    res.render('search-vin', {
      title: 'Search Vehicle',
      vehicle: vehicle || null,
      searched: true,
      searchedVin: vin
    });
  });
});

module.exports = router;

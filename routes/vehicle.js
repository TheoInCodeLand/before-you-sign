// routes/vehicle.js - Public vehicle routes
const express = require('express');
const router = express.Router();
const db = require('../database/init-db');

// View vehicle details (public)
router.get('/:id', (req, res) => {
  db.get(`
    SELECT v.*, d.business_name, d.certification_status, d.phone, d.email,
           vc.vin_verified, vc.mileage_verified, vc.service_history_verified,
           vc.ownership_verified, vc.accident_history_verified, vc.recall_verified,
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
      vehicle: vehicle
    });
  });
});

// Search by VIN
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

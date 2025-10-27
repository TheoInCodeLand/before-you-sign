// routes/dealership.js - Dealership routes
const express = require('express');
const router = express.Router();
const db = require('../database/init-db');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { isAuthenticated, hasRole } = require('./auth');

// Apply authentication middleware to all dealership routes
router.use(isAuthenticated);
router.use(hasRole('dealership'));

// Get dealership ID helper
function getDealershipId(userId, callback) {
  db.get('SELECT id FROM dealerships WHERE user_id = ?', [userId], (err, row) => {
    if (err || !row) return callback(null);
    callback(row.id);
  });
}

// Dashboard
router.get('/dashboard', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    if (!dealershipId) {
      return res.send('Dealership profile not found');
    }
    
    // Get statistics - UPDATED QUERY TO INCLUDE total_value
    db.all(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'verified' THEN price ELSE 0 END) as total_value
      FROM vehicles
      WHERE dealership_id = ?
    `, [dealershipId], (err, statsRows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
      }
      
      const stats = statsRows[0] || { total: 0, verified: 0, pending: 0, total_value: 0 };
      
      db.get('SELECT * FROM dealerships WHERE id = ?', [dealershipId], (err, dealership) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).send('Database error');
        }
        
        res.render('dealership/dashboard', {
          title: 'Dealership Dashboard',
          stats: stats,
          dealership: dealership
        });
      });
    });
  });
});

// Profile
router.get('/profile', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    db.get('SELECT * FROM dealerships WHERE id = ?', [dealershipId], (err, dealership) => {
      res.render('dealership/profile', {
        title: 'My Profile',
        dealership: dealership,
        success: null,
        error: null
      });
    });
  });
});

// Update profile
router.post('/profile/update', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    const { businessName, phone, address, city, postalCode, website, operatingHours, description } = req.body;
    
    db.run(`
      UPDATE dealerships 
      SET business_name = ?, phone = ?, address = ?, city = ?, postal_code = ?,
          website = ?, operating_hours = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [businessName, phone, address, city, postalCode, website, operatingHours, description, dealershipId],
    (err) => {
      db.get('SELECT * FROM dealerships WHERE id = ?', [dealershipId], (err, dealership) => {
        res.render('dealership/profile', {
          title: 'My Profile',
          dealership: dealership,
          success: err ? null : 'Profile updated successfully',
          error: err ? 'Error updating profile' : null
        });
      });
    });
  });
});

// Add vehicle page
router.get('/add-vehicle', (req, res) => {
  res.render('dealership/add-vehicle', {
    title: 'Add Vehicle',
    error: null,
    success: null
  });
});

// Add vehicle POST - UPDATED VERSION
router.post('/add-vehicle', async (req, res) => {
  getDealershipId(req.session.userId, async (dealershipId) => {
    const {
      vin, make, model, year, mileage, price, color,
      bodyType, fuelType, transmission, previousOwners,
      // NEW FIELDS
      registrationAuthority, plateNumber, engineNumber, tareWeight,
      dateLiabilityLicensing, vehicleStatus, dateLiableRegistration,
      licenseNumber1, licenseNumber2, licenseNumber3,
      engineType, engineCapacity,
      // EXISTING FIELDS
      serviceHistory, accidentHistory, recallInformation,
      additionalFeatures, description
    } = req.body;
    
    try {
      // Validate VIN
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return res.render('dealership/add-vehicle', {
          title: 'Add Vehicle',
          error: 'Invalid VIN format (17 characters, no I, O, Q)',
          success: null
        });
      }
      
      // Prepare license numbers array (most recent first)
      const licenseNumbers = [];
      if (licenseNumber1) licenseNumbers.push(licenseNumber1);
      if (licenseNumber2) licenseNumbers.push(licenseNumber2);
      if (licenseNumber3) licenseNumbers.push(licenseNumber3);
      const licenseNumbersJson = JSON.stringify(licenseNumbers);
      
      // Insert vehicle with all fields
      db.run(`
        INSERT INTO vehicles 
        (dealership_id, vin, make, model, year, mileage, price, color,
         body_type, fuel_type, transmission, previous_owners,
         registration_authority, plate_number, engine_number, tare_weight,
         date_liability_licensing, vehicle_status, date_liable_registration,
         license_numbers, engine_type, engine_capacity,
         service_history, accident_history, recall_information,
         additional_features, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dealershipId, vin, make, model, year, mileage, price, color,
        bodyType, fuelType, transmission, previousOwners || 0,
        registrationAuthority, plateNumber, engineNumber, tareWeight,
        dateLiabilityLicensing, vehicleStatus, dateLiableRegistration,
        licenseNumbersJson, engineType, engineCapacity,
        serviceHistory, accidentHistory, recallInformation,
        additionalFeatures, description
      ],
      async function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.render('dealership/add-vehicle', {
            title: 'Add Vehicle',
            error: 'Error adding vehicle. VIN or Plate Number may already exist.',
            success: null
          });
        }
        
        const vehicleId = this.lastID;
        
        // Generate QR code
        const qrData = JSON.stringify({ vehicleId, vin, plateNumber, dealershipId });
        const qrPath = path.join(__dirname, '../public/qr-codes', `vehicle_${vehicleId}.png`);
        
        // Ensure qr-codes directory exists
        const qrDir = path.join(__dirname, '../public/qr-codes');
        if (!fs.existsSync(qrDir)) {
          fs.mkdirSync(qrDir, { recursive: true });
        }
        
        await QRCode.toFile(qrPath, qrData);
        
        // Update vehicle with QR code path
        db.run(
          'UPDATE vehicles SET qr_code_path = ? WHERE id = ?',
          [`/qr-codes/vehicle_${vehicleId}.png`, vehicleId]
        );
        
        res.redirect('/dealership/vehicles');
      });
    } catch (error) {
      console.error('Error:', error);
      res.render('dealership/add-vehicle', {
        title: 'Add Vehicle',
        error: 'An error occurred while adding the vehicle',
        success: null
      });
    }
  });
});


// View all vehicles
router.get('/vehicles', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    const status = req.query.status || 'all';
    let query = 'SELECT * FROM vehicles WHERE dealership_id = ?';
    const params = [dealershipId];
    
    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, vehicles) => {
      res.render('dealership/vehicles', {
        title: 'My Vehicles',
        vehicles: vehicles || [],
        selectedStatus: status
      });
    });
  });
});

// View vehicle details
router.get('/vehicle/:id', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    db.get(
      'SELECT * FROM vehicles WHERE id = ? AND dealership_id = ?',
      [req.params.id, dealershipId],
      (err, vehicle) => {
        if (!vehicle) {
          return res.send('Vehicle not found');
        }
        
        res.render('dealership/vehicle-details', {
          title: 'Vehicle Details',
          vehicle: vehicle
        });
      }
    );
  });
});

// Delete vehicle
router.post('/vehicle/:id/delete', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    db.run(
      'DELETE FROM vehicles WHERE id = ? AND dealership_id = ? AND status = "pending_verification"',
      [req.params.id, dealershipId],
      (err) => {
        res.redirect('/dealership/vehicles');
      }
    );
  });
});

function getDealershipStats(dealershipId, callback) {
  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'verified' THEN price ELSE 0 END) as total_value
    FROM vehicles
    WHERE dealership_id = ?
  `, [dealershipId], (err, stats) => {
    callback(stats ? stats[0] : { total: 0, verified: 0, pending: 0, rejected: 0, total_value: 0 });
  });
}

// Get recent verified vehicles
router.get('/api/recent-vehicles', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    db.all(`
      SELECT v.*, d.business_name 
      FROM vehicles v 
      LEFT JOIN dealerships d ON v.dealership_id = d.id 
      WHERE v.dealership_id = ? AND v.status = 'verified'
      ORDER BY v.updated_at DESC 
      LIMIT 5
    `, [dealershipId], (err, vehicles) => {
      res.json(vehicles || []);
    });
  });
});

// Get verification analytics
router.get('/api/verification-analytics', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    db.all(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        status,
        COUNT(*) as count
      FROM vehicles 
      WHERE dealership_id = ? AND created_at >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', created_at), status
      ORDER BY month DESC
    `, [dealershipId], (err, analytics) => {
      res.json(analytics || []);
    });
  });
});

module.exports = router;

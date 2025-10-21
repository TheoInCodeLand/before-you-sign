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
    
    // Get statistics
    db.all(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) as pending
      FROM vehicles
      WHERE dealership_id = ?
    `, [dealershipId], (err, stats) => {
      
      db.get('SELECT * FROM dealerships WHERE id = ?', [dealershipId], (err, dealership) => {
        res.render('dealership/dashboard', {
          title: 'Dealership Dashboard',
          stats: stats || { total: 0, verified: 0, pending: 0 },
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

// Add vehicle POST
router.post('/add-vehicle', async (req, res) => {
  getDealershipId(req.session.userId, async (dealershipId) => {
    const {
      vin, make, model, year, mileage, price, color,
      bodyType, fuelType, transmission, previousOwners,
      serviceHistory, accidentHistory, recallInformation,
      additionalFeatures, description
    } = req.body;
    
    try {
      // Validate VIN
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return res.render('dealership/add-vehicle', {
          title: 'Add Vehicle',
          error: 'Invalid VIN format',
          success: null
        });
      }
      
      // Insert vehicle
      db.run(`
        INSERT INTO vehicles 
        (dealership_id, vin, make, model, year, mileage, price, color,
         body_type, fuel_type, transmission, previous_owners,
         service_history, accident_history, recall_information,
         additional_features, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [dealershipId, vin, make, model, year, mileage, price, color,
          bodyType, fuelType, transmission, previousOwners || 0,
          serviceHistory, accidentHistory, recallInformation,
          additionalFeatures, description],
      async function(err) {
        if (err) {
          return res.render('dealership/add-vehicle', {
            title: 'Add Vehicle',
            error: 'Error adding vehicle. VIN may already exist.',
            success: null
          });
        }
        
        const vehicleId = this.lastID;
        
        // Generate QR code
        const qrData = JSON.stringify({ vehicleId, vin, dealershipId });
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

module.exports = router;

// routes/dealership.js - Dealership routes
const express = require('express');
const router = express.Router();
const db = require('../database/init-db');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { isAuthenticated, hasRole } = require('./auth');

// Detect production (Vercel) vs local dev
const isProd = process.env.NODE_ENV === 'production';
const uploadDir = isProd ? '/tmp/uploads/vehicles' : path.join(__dirname, '../public/uploads/vehicles');
const qrDir = isProd ? '/tmp/qr-codes' : path.join(__dirname, '../public/qr-codes');

// Multer storage config (uses /tmp for prod)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'vehicle-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  },
  fileFilter: fileFilter
});

// Auth middleware for all dealership routes
router.use(isAuthenticated);
router.use(hasRole('dealership'));

// Helper: Get dealership ID for current user
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

// Add vehicle POST, with file uploads and QR generation (all using /tmp for prod)
router.post('/add-vehicle', upload.array('vehicleImages', 10), async (req, res) => {
  getDealershipId(req.session.userId, async (dealershipId) => {
    if (!dealershipId) {
      return res.render('dealership/add-vehicle', {
        title: 'Add Vehicle',
        error: 'Dealership profile not found',
        success: null
      });
    }

    const {
      vin, make, model, year, mileage, price, color,
      bodyType, fuelType, transmission, previousOwners,
      registrationAuthority, plateNumber, engineNumber, tareWeight,
      dateLiabilityLicensing, vehicleStatus, dateLiableRegistration,
      licenseNumber1, licenseNumber2, licenseNumber3,
      engineType, engineCapacity,
      serviceHistory, accidentHistory, recallInformation,
      additionalFeatures, description
    } = req.body;

    try {
      // Validate VIN
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        if (req.files) {
          req.files.forEach(file => fs.unlinkSync(file.path));
        }
        return res.render('dealership/add-vehicle', {
          title: 'Add Vehicle',
          error: 'Invalid VIN format (17 characters, no I, O, Q)',
          success: null
        });
      }

      // Process uploaded images
      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        imageUrls = req.files.map(file => `/uploads/vehicles/${file.filename}`);
      }
      const imageUrlsJson = JSON.stringify(imageUrls);

      // Prepare license numbers
      const licenseNumbers = [];
      if (licenseNumber1) licenseNumbers.push(licenseNumber1);
      if (licenseNumber2) licenseNumbers.push(licenseNumber2);
      if (licenseNumber3) licenseNumbers.push(licenseNumber3);
      const licenseNumbersJson = JSON.stringify(licenseNumbers);

      // Insert vehicle
      db.run(`
        INSERT INTO vehicles 
        (dealership_id, vin, make, model, year, mileage, price, color,
         body_type, fuel_type, transmission, previous_owners,
         registration_authority, plate_number, engine_number, tare_weight,
         date_liability_licensing, vehicle_status, date_liable_registration,
         license_numbers, engine_type, engine_capacity,
         service_history, accident_history, recall_information,
         additional_features, description, image_urls)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dealershipId, vin, make, model, year, mileage, price, color,
        bodyType, fuelType, transmission, previousOwners || 0,
        registrationAuthority, plateNumber, engineNumber, tareWeight,
        dateLiabilityLicensing, vehicleStatus, dateLiableRegistration,
        licenseNumbersJson, engineType, engineCapacity,
        serviceHistory, accidentHistory, recallInformation,
        additionalFeatures, description, imageUrlsJson
      ],
      async function(err) {
        if (err) {
          console.error('Database error:', err);
          if (req.files) {
            req.files.forEach(file => {
              try { fs.unlinkSync(file.path); } catch(e) {}
            });
          }
          return res.render('dealership/add-vehicle', {
            title: 'Add Vehicle',
            error: 'Error adding vehicle. VIN or Plate Number may already exist.',
            success: null
          });
        }

        const vehicleId = this.lastID;
        const qrData = JSON.stringify({ vehicleId, vin, plateNumber, dealershipId });
        const qrFilePath = path.join(qrDir, `vehicle_${vehicleId}.png`);

        if (!fs.existsSync(qrDir)) {
          fs.mkdirSync(qrDir, { recursive: true });
        }
        await QRCode.toFile(qrFilePath, qrData);

        db.run(
          'UPDATE vehicles SET qr_code_path = ? WHERE id = ?',
          [`/qr-codes/vehicle_${vehicleId}.png`, vehicleId]
        );

        res.redirect('/dealership/vehicles');
      });
    } catch (error) {
      console.error('Error:', error);
      if (req.files) {
        req.files.forEach(file => {
          try { fs.unlinkSync(file.path); } catch(e) {}
        });
      }
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

// Single vehicle details
router.get('/vehicle/:id', (req, res) => {
  getDealershipId(req.session.userId, (dealershipId) => {
    if (!dealershipId) {
      return res.status(404).render('error', {
        title: 'Error',
        message: 'Dealership profile not found'
      });
    }

    db.get(`
      SELECT 
        v.*, d.business_name, d.website, d.phone, d.email, d.certification_status,
        vc.vin_verified, vc.plate_number_verified, vc.engine_number_verified, vc.mileage_verified,
        vc.service_history_verified, vc.ownership_verified, vc.accident_history_verified, vc.recall_verified,
        vc.registration_verified, vc.engine_specs_verified,
        u.username as verified_by_username
      FROM vehicles v
      LEFT JOIN dealerships d ON v.dealership_id = d.id
      LEFT JOIN verification_checklist vc ON v.id = vc.vehicle_id
      LEFT JOIN users u ON v.verified_by = u.id
      WHERE v.id = ? AND v.dealership_id = ?
    `, [req.params.id, dealershipId], (err, vehicle) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', {
          title: 'Error',
          message: 'An error occurred while retrieving vehicle details'
        });
      }

      if (!vehicle) {
        return res.status(404).render('error', {
          title: 'Not Found',
          message: 'Vehicle not found or you do not have permission to view it'
        });
      }

      res.render('dealership/vehicle-details', {
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        vehicle: vehicle
      });
    });
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

// Recent verified vehicles API
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

// Verification analytics API
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

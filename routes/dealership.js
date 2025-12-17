// routes/dealership.js - Dealership routes
const express = require('express');
const router = express.Router();
const pool = require('../database/init-db'); // Changed from db to pool
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { isAuthenticated, hasRole } = require('./auth');

// Detect production vs local dev
const isProd = process.env.NODE_ENV === 'production';
const uploadDir = isProd ? '/tmp/uploads/vehicles' : path.join(__dirname, '../public/uploads/vehicles');
const qrDir = isProd ? '/tmp/qr-codes' : path.join(__dirname, '../public/qr-codes');

// Multer storage config
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Auth middleware
router.use(isAuthenticated);
router.use(hasRole('dealership'));

// Helper: Get dealership ID for current user (Async version)
async function getDealershipId(userId) {
  const { rows } = await pool.query('SELECT id FROM dealerships WHERE user_id = $1', [userId]);
  return rows.length > 0 ? rows[0].id : null;
}

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    if (!dealershipId) return res.send('Dealership profile not found');

    const statsRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'verified' THEN price ELSE 0 END) as total_value
      FROM vehicles
      WHERE dealership_id = $1
    `, [dealershipId]);

    const stats = statsRes.rows[0] || { total: 0, verified: 0, pending: 0, total_value: 0 };

    const dealerRes = await pool.query('SELECT * FROM dealerships WHERE id = $1', [dealershipId]);
    
    res.render('dealership/dashboard', {
      title: 'Dealership Dashboard',
      stats: stats,
      dealership: dealerRes.rows[0]
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error');
  }
});

// Profile
router.get('/profile', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    const { rows } = await pool.query('SELECT * FROM dealerships WHERE id = $1', [dealershipId]);
    res.render('dealership/profile', {
      title: 'My Profile',
      dealership: rows[0],
      success: null,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Update profile
router.post('/profile/update', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    const { businessName, phone, address, city, postalCode, website, operatingHours, description } = req.body;

    await pool.query(`
      UPDATE dealerships 
      SET business_name = $1, phone = $2, address = $3, city = $4, postal_code = $5,
          website = $6, operating_hours = $7, description = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `, [businessName, phone, address, city, postalCode, website, operatingHours, description, dealershipId]);

    const { rows } = await pool.query('SELECT * FROM dealerships WHERE id = $1', [dealershipId]);
    
    res.render('dealership/profile', {
      title: 'My Profile',
      dealership: rows[0],
      success: 'Profile updated successfully',
      error: null
    });
  } catch (err) {
    console.error(err);
    // Fetch dealership again to render page with error
    const dealershipId = await getDealershipId(req.session.userId);
    const { rows } = await pool.query('SELECT * FROM dealerships WHERE id = $1', [dealershipId]);
    res.render('dealership/profile', {
      title: 'My Profile',
      dealership: rows[0],
      success: null,
      error: 'Error updating profile'
    });
  }
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
router.post('/add-vehicle', upload.array('vehicleImages', 10), async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    if (!dealershipId) {
        throw new Error('Dealership profile not found');
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

    // Validate VIN
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
      return res.render('dealership/add-vehicle', {
        title: 'Add Vehicle',
        error: 'Invalid VIN format (17 characters, no I, O, Q)',
        success: null
      });
    }

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => `/uploads/vehicles/${file.filename}`);
    }
    const imageUrlsJson = JSON.stringify(imageUrls);

    const licenseNumbers = [];
    if (licenseNumber1) licenseNumbers.push(licenseNumber1);
    if (licenseNumber2) licenseNumbers.push(licenseNumber2);
    if (licenseNumber3) licenseNumbers.push(licenseNumber3);
    const licenseNumbersJson = JSON.stringify(licenseNumbers);

    // INSERT with RETURNING id
    const insertRes = await pool.query(`
      INSERT INTO vehicles 
      (dealership_id, vin, make, model, year, mileage, price, color,
       body_type, fuel_type, transmission, previous_owners,
       registration_authority, plate_number, engine_number, tare_weight,
       date_liability_licensing, vehicle_status, date_liable_registration,
       license_numbers, engine_type, engine_capacity,
       service_history, accident_history, recall_information,
       additional_features, description, image_urls)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      RETURNING id
    `, [
      dealershipId, vin, make, model, year, mileage, price, color,
      bodyType, fuelType, transmission, previousOwners || 0,
      registrationAuthority, plateNumber, engineNumber, tareWeight,
      dateLiabilityLicensing, vehicleStatus, dateLiableRegistration,
      licenseNumbersJson, engineType, engineCapacity,
      serviceHistory, accidentHistory, recallInformation,
      additionalFeatures, description, imageUrlsJson
    ]);

    const vehicleId = insertRes.rows[0].id;
    const qrData = JSON.stringify({ vehicleId, vin, plateNumber, dealershipId });
    const qrFilePath = path.join(qrDir, `vehicle_${vehicleId}.png`);

    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
    await QRCode.toFile(qrFilePath, qrData);

    await pool.query(
      'UPDATE vehicles SET qr_code_path = $1 WHERE id = $2',
      [`/qr-codes/vehicle_${vehicleId}.png`, vehicleId]
    );

    res.redirect('/dealership/vehicles');

  } catch (error) {
    console.error('Error adding vehicle:', error);
    if (req.files) {
      req.files.forEach(file => { try { fs.unlinkSync(file.path); } catch(e) {} });
    }
    
    // Check for Postgres duplicate key error
    let errorMessage = 'An error occurred while adding the vehicle';
    if (error.code === '23505') {
        errorMessage = 'Error adding vehicle. VIN or Plate Number may already exist.';
    }

    res.render('dealership/add-vehicle', {
      title: 'Add Vehicle',
      error: errorMessage,
      success: null
    });
  }
});

// View all vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    const status = req.query.status || 'all';
    
    let query = 'SELECT * FROM vehicles WHERE dealership_id = $1';
    let params = [dealershipId];

    if (status !== 'all') {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);

    res.render('dealership/vehicles', {
      title: 'My Vehicles',
      vehicles: rows || [],
      selectedStatus: status
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Single vehicle details
router.get('/vehicle/:id', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    if (!dealershipId) {
      return res.status(404).render('error', { title: 'Error', message: 'Dealership profile not found' });
    }

    const { rows } = await pool.query(`
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
      WHERE v.id = $1 AND v.dealership_id = $2
    `, [req.params.id, dealershipId]);

    const vehicle = rows[0];

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
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Database error' });
  }
});

// Delete vehicle
router.post('/vehicle/:id/delete', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    await pool.query(
      'DELETE FROM vehicles WHERE id = $1 AND dealership_id = $2 AND status = \'pending_verification\'',
      [req.params.id, dealershipId]
    );
    res.redirect('/dealership/vehicles');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting vehicle');
  }
});

// Recent verified vehicles API
router.get('/api/recent-vehicles', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    const { rows } = await pool.query(`
      SELECT v.*, d.business_name 
      FROM vehicles v 
      LEFT JOIN dealerships d ON v.dealership_id = d.id 
      WHERE v.dealership_id = $1 AND v.status = 'verified'
      ORDER BY v.updated_at DESC 
      LIMIT 5
    `, [dealershipId]);
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Verification analytics API
router.get('/api/verification-analytics', async (req, res) => {
  try {
    const dealershipId = await getDealershipId(req.session.userId);
    // Postgres specific date formatting: TO_CHAR
    const { rows } = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        status,
        COUNT(*) as count
      FROM vehicles 
      WHERE dealership_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), status
      ORDER BY month DESC
    `, [dealershipId]);
    res.json(rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

module.exports = router;
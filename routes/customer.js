// routes/customer.js - Customer routes (PostgreSQL Version + VIN Search Redirect)
const express = require('express');
const router = express.Router();
const pool = require('../database/init-db');
const { isAuthenticated, hasRole } = require('./auth');
const { seoConfigs } = require('../middleware/seo');

// Customer dashboard (requires authentication)
router.get('/dashboard', isAuthenticated, hasRole('customer'), async (req, res) => {
  try {
    const customerRes = await pool.query('SELECT * FROM customers WHERE user_id = $1', [req.session.userId]);
    const customer = customerRes.rows[0];

    const disputesRes = await pool.query(`
      SELECT d.*, v.vin, v.make, v.model
      FROM disputes d
      JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.customer_id = $1
      ORDER BY d.created_at DESC
      LIMIT 5
    `, [customer ? customer.id : 0]);

    res.render('customer/dashboard', {
      title: 'Customer Dashboard',
      customer: customer,
      recentDisputes: disputesRes.rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Browse dealerships (public)
router.get('/browse-dealerships', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*,
             (SELECT COUNT(*) FROM vehicles WHERE dealership_id = d.id AND status = 'verified') as vehicle_count
      FROM dealerships d
      WHERE d.certification_status = 'active'
      ORDER BY d.business_name
    `);
    res.render('customer/browse-dealerships', {
      title: 'Certified Dealerships',
      dealerships: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Browse vehicles (Public + Search Logic)
router.get('/vehicles', async (req, res) => {
  try {
    // --- NEW: SMART REDIRECT LOGIC ---
    // If a VIN is provided, check if it matches exactly ONE vehicle.
    // If so, redirect directly to that vehicle's details page.
    if (req.query.vin) {
      const searchVin = `%${req.query.vin.trim()}%`;
      const matchRes = await pool.query(
        "SELECT id FROM vehicles WHERE vin ILIKE $1 AND status = 'verified'", 
        [searchVin]
      );
      
      // If exactly one car is found, go straight to it
      if (matchRes.rows.length === 1) {
        return res.redirect(`/customer/vehicle/${matchRes.rows[0].id}`);
      }
    }
    // ---------------------------------

    const page = parseInt(req.query.page) || 1;
    const limit = 9; 
    const offset = (page - 1) * limit;
    
    // Base Query
    let query = `
      SELECT v.*, d.business_name, d.certification_status
      FROM vehicles v
      JOIN dealerships d ON v.dealership_id = d.id
      WHERE v.status = 'verified'
    `;
    
    const params = [];
    
    // --- Filters ---
    if (req.query.vin) {
      params.push(`%${req.query.vin.trim()}%`);
      query += ` AND v.vin ILIKE $${params.length}`;
    }
    if (req.query.make) {
      params.push(`%${req.query.make}%`);
      query += ` AND v.make ILIKE $${params.length}`;
    }
    if (req.query.minPrice) {
      params.push(req.query.minPrice);
      query += ` AND v.price >= $${params.length}`;
    }
    if (req.query.maxPrice) {
      params.push(req.query.maxPrice);
      query += ` AND v.price <= $${params.length}`;
    }
    if (req.query.bodyType && req.query.bodyType !== 'all') {
      params.push(req.query.bodyType);
      query += ` AND v.body_type = $${params.length}`;
    }
    
    // Pagination Logic
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
    const totalRes = await pool.query(countQuery, params);
    const totalVehicles = parseInt(totalRes.rows[0].total);
    const totalPages = Math.ceil(totalVehicles / limit);
    
    // Add Ordering and Pagination Limits to SQL
    params.push(limit);
    query += ` ORDER BY v.created_at DESC LIMIT $${params.length}`;
    
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    // Execute
    const { rows } = await pool.query(query, params);

    res.setSeo(seoConfigs.vehicles);
    res.render('customer/vehicles', {
      title: 'Browse Vehicles',
      vehicles: rows || [],
      filters: req.query,
      currentPage: page,
      totalPages: totalPages,
      totalVehicles: totalVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Report dispute page
router.get('/report-dispute', isAuthenticated, hasRole('customer'), async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId;
    
    const customerRes = await pool.query('SELECT * FROM customers WHERE user_id = $1', [req.session.userId]);
    const customer = customerRes.rows[0];

    let vehicle = null;
    if (vehicleId) {
      const vehicleRes = await pool.query('SELECT * FROM vehicles WHERE id = $1', [vehicleId]);
      vehicle = vehicleRes.rows[0];
    }

    res.render('customer/report-dispute', {
      title: 'Report Discrepancy',
      customer: customer,
      vehicle: vehicle,
      error: null,
      success: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// File a dispute with CPA compliance
router.post('/report-dispute', isAuthenticated, hasRole('customer'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { vehicle_id, cpa_category, discrepancy_description, preferred_resolution } = req.body;
        const customer_id = req.session.userId;
        
        // Validate CPA category
        const validCategories = ['A', 'B', 'C', 'D', 'E'];
        if (!validCategories.includes(cpa_category)) {
            throw new Error('Invalid CPA category');
        }
        
        // Set resolution deadline based on category
        const deadlines = {
            'A': '2 days',
            'B': '1 day', 
            'C': 'IMMEDIATE',
            'D': '3 days',
            'E': 'IMMEDIATE'
        };
        
        const deadline = deadlines[cpa_category] === 'IMMEDIATE' 
            ? 'NOW()' 
            : `NOW() + INTERVAL '${deadlines[cpa_category]}'`;
        
        const { rows } = await client.query(`
            INSERT INTO disputes (
                vehicle_id, customer_id, cpa_category, 
                discrepancy_description, preferred_resolution,
                resolution_deadline, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, ${deadline}, 'submitted', NOW())
            RETURNING id
        `, [vehicle_id, customer_id, cpa_category, discrepancy_description, preferred_resolution]);
        
        // Log audit trail
        await client.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES ($1, 'DISPUTE_FILED', 'dispute', $2, $3)
        `, [customer_id, rows[0].id, JSON.stringify({cpa_category})]);
        
        // Notify dealership (implementation needed)
        
        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            dispute_id: rows[0].id,
            message: 'Dispute filed successfully. Reference: DIS-' + rows[0].id,
            cpa_rights: 'You have the right to cancel this transaction within 5 business days if this was a direct marketing sale (CPA Section 16).'
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to file dispute' });
    } finally {
        client.release();
    }
});

// My disputes
router.get('/my-disputes', isAuthenticated, hasRole('customer'), async (req, res) => {
  try {
    const customerRes = await pool.query('SELECT id FROM customers WHERE user_id = $1', [req.session.userId]);
    const customer = customerRes.rows[0];

    if (!customer) {
      return res.send('Customer profile not found');
    }
    
    const { rows } = await pool.query(`
      SELECT d.*, v.vin, v.make, v.model, v.year
      FROM disputes d
      JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.customer_id = $1
      ORDER BY d.created_at DESC
    `, [customer.id]);

    res.render('customer/my-disputes', {
      title: 'My Disputes',
      disputes: rows || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

module.exports = router;
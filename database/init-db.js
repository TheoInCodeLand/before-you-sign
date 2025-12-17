// database/init-db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon connection
  }
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Connecting to Neon PostgreSQL...');
    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('dealership', 'admin', 'customer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Dealerships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS dealerships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_name VARCHAR(255) NOT NULL,
        registration_number VARCHAR(100) UNIQUE NOT NULL,
        license_number VARCHAR(100),
        year_established INTEGER,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20),
        website VARCHAR(255),
        operating_hours VARCHAR(255),
        description TEXT,
        certification_status VARCHAR(50) DEFAULT 'pending' CHECK(certification_status IN ('pending', 'active', 'suspended')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        postal_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Vehicles table (Includes fields from your migrate-add-fields.js)
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
        vin VARCHAR(100) UNIQUE NOT NULL,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        mileage INTEGER NOT NULL,
        price DECIMAL(12, 2) NOT NULL,
        color VARCHAR(50),
        body_type VARCHAR(50),
        fuel_type VARCHAR(50),
        transmission VARCHAR(50),
        previous_owners INTEGER DEFAULT 0,
        service_history TEXT,
        accident_history TEXT,
        recall_information TEXT,
        additional_features TEXT,
        description TEXT,
        image_urls TEXT,
        qr_code_path TEXT,
        status VARCHAR(50) DEFAULT 'pending_verification' CHECK(status IN ('pending_verification', 'verified', 'rejected')),
        verification_notes TEXT,
        verified_by INTEGER REFERENCES users(id),
        verified_at TIMESTAMP,
        rejection_reason TEXT,
        registration_authority TEXT,
        plate_number TEXT,
        engine_number TEXT,
        tare_weight INTEGER,
        date_liability_licensing TEXT,
        vehicle_status TEXT,
        date_liable_registration TEXT,
        license_numbers TEXT,
        engine_type TEXT,
        engine_capacity TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Disputes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        discrepancy_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        supporting_documents TEXT,
        status VARCHAR(50) DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'resolved', 'closed')),
        admin_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // 6. Verification checklist table (Includes fields from migrate-checklist.js)
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_checklist (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        vin_verified BOOLEAN DEFAULT FALSE,
        mileage_verified BOOLEAN DEFAULT FALSE,
        service_history_verified BOOLEAN DEFAULT FALSE,
        ownership_verified BOOLEAN DEFAULT FALSE,
        accident_history_verified BOOLEAN DEFAULT FALSE,
        recall_verified BOOLEAN DEFAULT FALSE,
        plate_number_verified BOOLEAN DEFAULT FALSE,
        engine_number_verified BOOLEAN DEFAULT FALSE,
        registration_verified BOOLEAN DEFAULT FALSE,
        engine_specs_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing database:', e);
  } finally {
    client.release();
  }
}

initializeDatabase();

// Export the pool for use in routes
module.exports = pool;
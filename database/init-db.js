// database/init-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dealership.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
function initializeDatabase() {
  db.serialize(() => {
    
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('dealership', 'admin', 'customer')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Dealerships table
    db.run(`
      CREATE TABLE IF NOT EXISTS dealerships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        business_name TEXT NOT NULL,
        registration_number TEXT UNIQUE NOT NULL,
        license_number TEXT,
        year_established INTEGER,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        postal_code TEXT,
        website TEXT,
        operating_hours TEXT,
        description TEXT,
        certification_status TEXT DEFAULT 'pending' CHECK(certification_status IN ('pending', 'active', 'suspended')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Vehicles table
    db.run(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dealership_id INTEGER NOT NULL,
        vin TEXT UNIQUE NOT NULL,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        mileage INTEGER NOT NULL,
        price REAL NOT NULL,
        color TEXT,
        body_type TEXT,
        fuel_type TEXT,
        transmission TEXT,
        previous_owners INTEGER DEFAULT 0,
        service_history TEXT,
        accident_history TEXT,
        recall_information TEXT,
        additional_features TEXT,
        description TEXT,
        image_urls TEXT,
        qr_code_path TEXT,
        status TEXT DEFAULT 'pending_verification' CHECK(status IN ('pending_verification', 'verified', 'rejected')),
        verification_notes TEXT,
        verified_by INTEGER,
        verified_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id)
      )
    `);

    // Disputes table
    db.run(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        discrepancy_type TEXT NOT NULL,
        description TEXT NOT NULL,
        supporting_documents TEXT,
        status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'resolved', 'closed')),
        admin_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);

    // Verification checklist table
    db.run(`
      CREATE TABLE IF NOT EXISTS verification_checklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        vin_verified BOOLEAN DEFAULT 0,
        mileage_verified BOOLEAN DEFAULT 0,
        service_history_verified BOOLEAN DEFAULT 0,
        ownership_verified BOOLEAN DEFAULT 0,
        accident_history_verified BOOLEAN DEFAULT 0,
        recall_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database tables created successfully!');
  });

  return db;
}

// Export database connection
const database = initializeDatabase();

module.exports = database;

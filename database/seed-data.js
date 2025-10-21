// database/seed-data.js
const bcrypt = require('bcrypt');
const db = require('./init-db');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');

  try {
    // Hash password helper
    const hashPassword = async (password) => {
      return await bcrypt.hash(password, 10);
    };

    // Seed admin user
    const adminPassword = await hashPassword('admin123');
    db.run(`
      INSERT OR IGNORE INTO users (username, email, password, role)
      VALUES ('admin', 'admin@beforeyousign.com', ?, 'admin')
    `, [adminPassword]);

    // Seed dealership users
    const dealerPassword1 = await hashPassword('dealer123');
    db.run(`
      INSERT OR IGNORE INTO users (username, email, password, role)
      VALUES ('premiumauto', 'contact@premiumauto.com', ?, 'dealership')
    `, [dealerPassword1], function(err) {
      if (!err && this.lastID) {
        // Add dealership details
        db.run(`
          INSERT OR IGNORE INTO dealerships 
          (user_id, business_name, registration_number, license_number, year_established, 
           email, phone, address, city, postal_code, website, operating_hours, description, certification_status)
          VALUES (?, 'Premium Auto Sales', 'DEAL001', 'LIC-2020-001', 2015,
                  'contact@premiumauto.com', '+27-11-555-0001', '123 Main Street', 'Johannesburg',
                  '2000', 'www.premiumauto.com', 'Mon-Fri 8AM-6PM, Sat 9AM-4PM',
                  'Trusted dealership specializing in luxury and premium vehicles', 'active')
        `, [this.lastID]);
      }
    });

    const dealerPassword2 = await hashPassword('dealer123');
    db.run(`
      INSERT OR IGNORE INTO users (username, email, password, role)
      VALUES ('citymotors', 'info@citymotors.co.za', ?, 'dealership')
    `, [dealerPassword2], function(err) {
      if (!err && this.lastID) {
        db.run(`
          INSERT OR IGNORE INTO dealerships 
          (user_id, business_name, registration_number, license_number, year_established,
           email, phone, address, city, postal_code, website, operating_hours, description, certification_status)
          VALUES (?, 'City Motors', 'DEAL002', 'LIC-2019-002', 2010,
                  'info@citymotors.co.za', '+27-21-555-0002', '456 Oak Avenue', 'Cape Town',
                  '8001', 'www.citymotors.co.za', 'Mon-Sat 8AM-5PM',
                  'Family-owned dealership with focus on reliable used cars', 'active')
        `, [this.lastID]);
      }
    });

    // Seed customer users
    const customerPassword = await hashPassword('customer123');
    db.run(`
      INSERT OR IGNORE INTO users (username, email, password, role)
      VALUES ('johnsmith', 'john.smith@email.com', ?, 'customer')
    `, [customerPassword], function(err) {
      if (!err && this.lastID) {
        db.run(`
          INSERT OR IGNORE INTO customers 
          (user_id, full_name, phone, address, city, postal_code)
          VALUES (?, 'John Smith', '+27-82-555-0001', '789 Pine Road', 'Johannesburg', '2001')
        `, [this.lastID]);
      }
    });

    // Wait a bit for async operations
    setTimeout(() => {
      console.log('✅ Database seeded successfully!');
      console.log('\n📋 Sample Credentials:');
      console.log('   Admin: username=admin, password=admin123');
      console.log('   Dealership: username=premiumauto, password=dealer123');
      console.log('   Customer: username=johnsmith, password=customer123');
    }, 1000);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

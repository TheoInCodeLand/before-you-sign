// database/seed-data.js
const bcrypt = require('bcrypt');
const pool = require('./init-db');

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start transaction

    // Hash password helper
    const hashPassword = async (password) => {
      return await bcrypt.hash(password, 10);
    };

    // 1. Seed admin user
    const adminPassword = await hashPassword('admin123');
    // Note: Postgres uses $1, $2 syntax, not ?
    // ON CONFLICT handles the "INSERT OR IGNORE" logic if username/email are unique
    await client.query(`
      INSERT INTO users (username, email, password, role)
      VALUES ('admin', 'admin@beforeyousign.com', $1, 'admin')
      ON CONFLICT (username) DO NOTHING;
    `, [adminPassword]);

    // 2. Seed dealership users and profiles
    const dealerPassword1 = await hashPassword('dealer123');
    const dealer1Res = await client.query(`
      INSERT INTO users (username, email, password, role)
      VALUES ('premiumauto', 'contact@premiumauto.com', $1, 'dealership')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email 
      RETURNING id;
    `, [dealerPassword1]);

    if (dealer1Res.rows.length > 0) {
      const dealer1Id = dealer1Res.rows[0].id;
      await client.query(`
        INSERT INTO dealerships 
        (user_id, business_name, registration_number, license_number, year_established, 
         email, phone, address, city, postal_code, website, operating_hours, description, certification_status)
        VALUES ($1, 'Premium Auto Sales', 'DEAL001', 'LIC-2020-001', 2015,
                'contact@premiumauto.com', '+27-11-555-0001', '123 Main Street', 'Johannesburg',
                '2000', 'www.premiumauto.com', 'Mon-Fri 8AM-6PM, Sat 9AM-4PM',
                'Trusted dealership specializing in luxury and premium vehicles', 'active')
        ON CONFLICT (registration_number) DO NOTHING;
      `, [dealer1Id]);
    }

    const dealerPassword2 = await hashPassword('dealer123');
    const dealer2Res = await client.query(`
      INSERT INTO users (username, email, password, role)
      VALUES ('citymotors', 'info@citymotors.co.za', $1, 'dealership')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    `, [dealerPassword2]);

    if (dealer2Res.rows.length > 0) {
      const dealer2Id = dealer2Res.rows[0].id;
      await client.query(`
        INSERT INTO dealerships 
        (user_id, business_name, registration_number, license_number, year_established,
         email, phone, address, city, postal_code, website, operating_hours, description, certification_status)
        VALUES ($1, 'City Motors', 'DEAL002', 'LIC-2019-002', 2010,
                'info@citymotors.co.za', '+27-21-555-0002', '456 Oak Avenue', 'Cape Town',
                '8001', 'www.citymotors.co.za', 'Mon-Sat 8AM-5PM',
                'Family-owned dealership with focus on reliable used cars', 'active')
        ON CONFLICT (registration_number) DO NOTHING;
      `, [dealer2Id]);
    }

    // 3. Seed customer user
    const customerPassword = await hashPassword('customer123');
    const customerRes = await client.query(`
      INSERT INTO users (username, email, password, role)
      VALUES ('johnsmith', 'john.smith@email.com', $1, 'customer')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    `, [customerPassword]);

    if (customerRes.rows.length > 0) {
      const customerId = customerRes.rows[0].id;
      await client.query(`
        INSERT INTO customers 
        (user_id, full_name, phone, address, city, postal_code)
        VALUES ($1, 'John Smith', '+27-82-555-0001', '789 Pine Road', 'Johannesburg', '2001')
      `, [customerId]);
    }

    await client.query('COMMIT'); // Commit transaction
    console.log('✅ Database seeded successfully!');
    console.log('\n📋 Sample Credentials:');
    console.log('   Admin: username=admin, password=admin123');
    console.log('   Dealership: username=premiumauto, password=dealer123');
    console.log('   Customer: username=johnsmith, password=customer123');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
  } finally {
    client.release();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
// database/migrate-add-fields.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dealership.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding new columns to vehicles table...');

const alterStatements = [
  'ALTER TABLE vehicles ADD COLUMN registration_authority TEXT',
  'ALTER TABLE vehicles ADD COLUMN plate_number TEXT',
  'ALTER TABLE vehicles ADD COLUMN engine_number TEXT',
  'ALTER TABLE vehicles ADD COLUMN tare_weight INTEGER',
  'ALTER TABLE vehicles ADD COLUMN date_liability_licensing TEXT',
  'ALTER TABLE vehicles ADD COLUMN vehicle_status TEXT',
  'ALTER TABLE vehicles ADD COLUMN date_liable_registration TEXT',
  'ALTER TABLE vehicles ADD COLUMN license_numbers TEXT',
  'ALTER TABLE vehicles ADD COLUMN engine_type TEXT',
  'ALTER TABLE vehicles ADD COLUMN engine_capacity TEXT'
];

alterStatements.forEach((sql, index) => {
  db.run(sql, (err) => {
    if (err) {
      console.log(`Column ${index + 1} might already exist or error:`, err.message);
    } else {
      console.log(`✓ Added column ${index + 1}`);
    }
  });
});

setTimeout(() => {
  console.log('Migration complete!');
  db.close();
}, 2000);

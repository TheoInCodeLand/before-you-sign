// database/migrate-checklist.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'dealership.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding new columns to verification_checklist table...');

const alterStatements = [
  'ALTER TABLE verification_checklist ADD COLUMN plate_number_verified BOOLEAN DEFAULT 0',
  'ALTER TABLE verification_checklist ADD COLUMN engine_number_verified BOOLEAN DEFAULT 0',
  'ALTER TABLE verification_checklist ADD COLUMN registration_verified BOOLEAN DEFAULT 0',
  'ALTER TABLE verification_checklist ADD COLUMN engine_specs_verified BOOLEAN DEFAULT 0'
];

alterStatements.forEach((sql, index) => {
  db.run(sql, (err) => {
    if (err) {
      console.log(`Column ${index + 1} might already exist:`, err.message);
    } else {
      console.log(`✓ Added verification checklist column ${index + 1}`);
    }
  });
});

setTimeout(() => {
  console.log('Verification checklist migration complete!');
  db.close();
}, 2000);

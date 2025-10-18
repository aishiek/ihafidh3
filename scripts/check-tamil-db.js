// Run with: node scripts/check-tamil-db.js
// Requires: npm install sqlite3

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/tamil-mokhtasar.db');

console.log('Opening DB at', dbPath);
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }
  console.log('DB opened successfully.');

  db.get('SELECT COUNT(*) as count FROM tamil_tafsir', [], (err, row) => {
    if (err) {
      console.error('Count query failed:', err.message);
    } else {
      console.log('Row count in tamil_tafsir:', row.count);
    }

    db.get('SELECT * FROM tamil_tafsir LIMIT 1', [], (err, row) => {
      if (err) {
        console.error('Sample row query failed:', err.message);
      } else if (row) {
        console.log('Sample row:', row);
      } else {
        console.warn('No rows found in tamil_tafsir.');
      }
      db.close();
    });
  });
});

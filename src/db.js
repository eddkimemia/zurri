const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../zuriagency.db');
const db = new sqlite3.Database(dbPath);

const initDb = async () => {
  const schemaPath = path.resolve(__dirname, '../schema.sqlite.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Check if tables already exist
  const tableCheck = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (tableCheck) {
    console.log('Database already initialized.');
    return;
  }

  return new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing database:', err.message);
        reject(err);
      } else {
        console.log('Database initialized successfully.');
        resolve();
      }
    });
  });
};

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes }); });
});

const transaction = async (callback) => {
  await run('BEGIN TRANSACTION');
  try {
    const result = await callback();
    await run('COMMIT');
    return result;
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
};

module.exports = { db, initDb, query, get, run, transaction };

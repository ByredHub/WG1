const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'subscriptions.db');

let db;

function getDb() {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('[DB] Ошибка открытия:', err.message);
    });

    db.run('PRAGMA journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      wg_peer_id TEXT,
      wg_peer_name TEXT,
      subscription_end DATE,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      yukassa_payment_id TEXT,
      payment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent',
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `, (err) => {
    if (err) console.error('[DB] Ошибка схемы:', err.message);
    else console.log('[DB] База данных готова');
  });
}

// Промис-обёртки для удобного использования в async/await
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = { getDb, dbRun, dbGet, dbAll };

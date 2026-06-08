/**
 * Импорт клиентов из бекапа wg0.json
 * Запуск: node server/scripts/importFromWg0.js /path/to/wg0.json
 *
 * Формат имени пира: "02С4 89287288833"
 *   → имя роутера: "02С4"
 *   → номер телефона: "89287288833"
 * Если имя без номера (например "adams g") — телефон будет пустым.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Минимальная инициализация без dotenv
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { getDb, dbRun } = require('../db');

const wg0Path = process.argv[2] || path.join(__dirname, '../../data/wg0.json');

if (!fs.existsSync(wg0Path)) {
  console.error(`Файл не найден: ${wg0Path}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(wg0Path, 'utf-8'));
const peers = raw.clients || {};

async function run() {
  getDb(); // инициализировать БД

  // Ждём пока схема создастся (sqlite3 асинхронный)
  await new Promise(r => setTimeout(r, 500));

  let imported = 0;
  let skipped = 0;

  console.log(`\nИмпорт из: ${wg0Path}`);
  console.log(`Всего пиров в файле: ${Object.keys(peers).length}\n`);

  for (const peer of Object.values(peers)) {
    const peerName = peer.name || '';

    // Извлекаем номер телефона из имени вида "02С4 89287288833"
    const parts = peerName.trim().split(/\s+/);
    let phone = '';
    let clientName = peerName;

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (/^[789]\d{9,10}$/.test(lastPart)) {
        phone = lastPart;
        clientName = parts.slice(0, -1).join(' ');
      }
    }

    const id = uuidv4();
    const subEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const notes = `Импорт wg0.json. IP: ${peer.address}. Создан: ${peer.createdAt ? new Date(peer.createdAt).toLocaleDateString('ru') : '?'}`;

    try {
      await dbRun(
        `INSERT OR IGNORE INTO clients (id, name, phone, wg_peer_id, wg_peer_name, subscription_end, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [id, clientName, phone, peer.id, peerName, subEnd, notes, peer.createdAt || new Date().toISOString()]
      );
      console.log(`  ✓ ${clientName} | тел: ${phone || '—'} | пир: ${peerName}`);
      imported++;
    } catch (err) {
      console.error(`  ✗ Ошибка для "${peerName}":`, err.message);
      skipped++;
    }
  }

  console.log(`\nГотово: импортировано ${imported}, пропущено ${skipped}`);
  console.log('Клиенты добавлены в базу данных.');
  process.exit(0);
}

run().catch(err => {
  console.error('Ошибка импорта:', err.message);
  process.exit(1);
});

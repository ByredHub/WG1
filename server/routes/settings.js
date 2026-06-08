const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../db');

// Ключи, которые нельзя возвращать в открытом виде
const SECRET_KEYS = ['platega_secret_key', 'yukassa_secret_key', 'wg_easy_password'];

function getDefaults() {
  return {
    // Основное
    subscription_price: process.env.SUBSCRIPTION_PRICE || '250',
    app_url: process.env.APP_URL || '',

    // Способ оплаты
    payment_provider: process.env.PAYMENT_PROVIDER || 'platega',

    // Platega
    platega_shop_id: process.env.PLATEGA_SHOP_ID || '',
    platega_secret_key: process.env.PLATEGA_SECRET_KEY || '',
    platega_webhook_url: process.env.PLATEGA_WEBHOOK_URL || '',

    // ЮКасса
    yukassa_shop_id: process.env.YUKASSA_SHOP_ID || '',
    yukassa_secret_key: process.env.YUKASSA_SECRET_KEY || '',

    // WireGuard Easy
    wg_easy_url: process.env.WG_EASY_URL || 'http://localhost:51821',
    wg_easy_password: process.env.WG_EASY_PASSWORD || '',

    // СБП для ручной оплаты
    sbp_phone: process.env.SBP_PHONE || '',
    sbp_bank: process.env.SBP_BANK || '',
    sbp_name: process.env.SBP_NAME || '',

    // Уведомления
    notify_days_before: '1',
    cron_time: '10:00',
    reminder_message: '',
    expired_message: '',
    activated_message: '',
  };
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll('SELECT key, value FROM settings');
    const result = { ...getDefaults() };

    for (const row of rows) {
      result[row.key] = row.value;
    }

    // Маскируем секретные ключи
    for (const key of SECRET_KEYS) {
      if (result[key]) result[key] = '••••••••';
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings — сохранить настройки
router.post('/', async (req, res) => {
  try {
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      if (!(key in getDefaults())) continue;

      // Не перезаписывать замаскированные значения
      if (SECRET_KEYS.includes(key) && value === '••••••••') continue;

      await dbRun(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
      );

      // Применяем к process.env сразу (для текущей сессии)
      const envMap = {
        subscription_price: 'SUBSCRIPTION_PRICE',
        app_url: 'APP_URL',
        platega_shop_id: 'PLATEGA_SHOP_ID',
        platega_secret_key: 'PLATEGA_SECRET_KEY',
        yukassa_shop_id: 'YUKASSA_SHOP_ID',
        yukassa_secret_key: 'YUKASSA_SECRET_KEY',
        wg_easy_url: 'WG_EASY_URL',
        wg_easy_password: 'WG_EASY_PASSWORD',
        payment_provider: 'PAYMENT_PROVIDER',
      };
      if (envMap[key] && value !== '••••••••') {
        process.env[envMap[key]] = value;
      }
    }

    // Если изменилось время — перезапустить планировщик
    if ('cron_time' in updates) {
      try {
        const { restartScheduler } = require('../scheduler');
        await restartScheduler();
      } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/raw/:key — получить реальное значение ключа (для внутреннего использования)
async function getSetting(key) {
  const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : (getDefaults()[key] ?? null);
}

// Загрузить все настройки в process.env при старте сервера
async function loadSettingsToEnv() {
  try {
    const rows = await dbAll('SELECT key, value FROM settings');
    const envMap = {
      subscription_price: 'SUBSCRIPTION_PRICE',
      app_url: 'APP_URL',
      platega_shop_id: 'PLATEGA_SHOP_ID',
      platega_secret_key: 'PLATEGA_SECRET_KEY',
      yukassa_shop_id: 'YUKASSA_SHOP_ID',
      yukassa_secret_key: 'YUKASSA_SECRET_KEY',
      wg_easy_url: 'WG_EASY_URL',
      wg_easy_password: 'WG_EASY_PASSWORD',
      payment_provider: 'PAYMENT_PROVIDER',
    };
    for (const row of rows) {
      if (envMap[row.key]) process.env[envMap[row.key]] = row.value;
    }
    console.log('[Settings] Настройки загружены из БД');
  } catch (err) {
    console.error('[Settings] Ошибка загрузки:', err.message);
  }
}

module.exports = { router, getSetting, loadSettingsToEnv };

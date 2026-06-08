const cron = require('node-cron');
const dayjs = require('dayjs');
const { dbRun, dbGet, dbAll } = require('./db');
const { enablePeer, disablePeer } = require('./wgEasy');
const {
  sendReminderBeforeExpiry,
  sendExpiredNotification,
} = require('./whatsapp');

async function checkSubscriptions() {
  const today = dayjs().format('YYYY-MM-DD');

  // Берём настройку из БД (по умолчанию 1 день)
  const notifyRow = await dbGet(`SELECT value FROM settings WHERE key = 'notify_days_before'`).catch(() => null);
  const notifyDays = parseInt(notifyRow?.value || process.env.NOTIFY_DAYS_BEFORE || '1', 10);
  const reminderDates = [];
  for (let i = 0; i <= notifyDays; i++) {
    reminderDates.push(dayjs().add(i, 'day').format('YYYY-MM-DD'));
  }

  console.log(`[Cron] Проверка подписок: ${today}, напоминаем за ${notifyDays} дн.`);

  // 1. Напоминания — подписка заканчивается в ближайшие N дней (не для бесплатных)
  const placeholders = reminderDates.map(() => '?').join(', ');
  const expiringSoon = await dbAll(
    `SELECT * FROM clients WHERE status = 'active' AND is_free = 0 AND date(subscription_end) IN (${placeholders})`,
    reminderDates
  );

  for (const client of expiringSoon) {
    const alreadySent = await dbGet(
      `SELECT id FROM notifications WHERE client_id = ? AND type = 'reminder' AND date(sent_at) = ?`,
      [client.id, today]
    );

    if (!alreadySent) {
      try {
        await sendReminderBeforeExpiry(client);
        await dbRun(
          `INSERT INTO notifications (client_id, type, message, status) VALUES (?, 'reminder', ?, 'sent')`,
          [client.id, `Напоминание об оплате, подписка до ${client.subscription_end}`]
        );
        console.log(`[Cron] Напоминание отправлено: ${client.name} (${client.phone})`);
      } catch (err) {
        console.error(`[Cron] Ошибка напоминания ${client.name}:`, err.message);
        await dbRun(
          `INSERT INTO notifications (client_id, type, message, status) VALUES (?, 'reminder', ?, 'failed')`,
          [client.id, err.message]
        );
      }
    }
  }

  // 2. Отключение — подписка закончилась (не для бесплатных)
  const expired = await dbAll(
    `SELECT * FROM clients WHERE status = 'active' AND is_free = 0 AND date(subscription_end) < ?`,
    [today]
  );

  for (const client of expired) {
    try {
      if (client.wg_peer_id) await disablePeer(client.wg_peer_id);
      await dbRun(`UPDATE clients SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [client.id]);
      await sendExpiredNotification(client);
      await dbRun(
        `INSERT INTO notifications (client_id, type, message, status) VALUES (?, 'expired', ?, 'sent')`,
        [client.id, `Подписка истекла ${client.subscription_end}, VPN отключён`]
      );
      console.log(`[Cron] Подписка отключена: ${client.name}`);
    } catch (err) {
      console.error(`[Cron] Ошибка отключения ${client.name}:`, err.message);
    }
  }

  console.log(`[Cron] Готово. Напомнено: ${expiringSoon.length}, Отключено: ${expired.length}`);
}

let cronTask = null;

async function getCronExpression() {
  try {
    const row = await dbGet(`SELECT value FROM settings WHERE key = 'cron_time'`);
    const time = row?.value || '10:00';
    const [hMsk, m] = time.split(':').map(Number);
    // МСК = UTC+3, переводим в UTC
    let hUtc = hMsk - 3;
    if (hUtc < 0) hUtc += 24;
    return `${m} ${hUtc} * * *`;
  } catch {
    return '0 7 * * *'; // 10:00 МСК по умолчанию
  }
}

async function startScheduler() {
  const expr = await getCronExpression();
  const mskTime = await dbGet(`SELECT value FROM settings WHERE key = 'cron_time'`).catch(() => null);
  const display = mskTime?.value || '10:00';

  if (cronTask) cronTask.stop();

  cronTask = cron.schedule(expr, async () => {
    await checkSubscriptions();
  });

  console.log(`[Cron] Планировщик запущен — ежедневно в ${display} МСК (cron: ${expr})`);
}

// Перезапустить планировщик с новым временем (вызывать после сохранения настроек)
async function restartScheduler() {
  await startScheduler();
}

module.exports = { startScheduler, checkSubscriptions, restartScheduler };

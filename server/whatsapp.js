const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// Слова-триггеры — клиент пишет одно из них → получает ссылку на оплату
const PAYMENT_TRIGGERS = ['оплата', 'оплатить', 'оплачу', 'продлить', 'продление', 'ссылка', 'pay', 'хочу'];

// Внешний обработчик входящих сообщений (устанавливается из db/index)
let onIncomingMessage = null;
function setIncomingMessageHandler(fn) { onIncomingMessage = fn; }

let client = null;
let isReady = false;
let lastQR = null; // base64 QR для браузера
let qrCallbacks = []; // SSE подписчики

function getClient() {
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '..', 'data', 'wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', (qr) => {
    lastQR = qr;
    console.log('\n[WhatsApp] Отсканируйте QR-код в WhatsApp (Связанные устройства):');
    qrcode.generate(qr, { small: true });
    // Уведомляем SSE-подписчиков
    qrCallbacks.forEach(cb => cb({ type: 'qr', qr }));
  });

  client.on('ready', () => {
    isReady = true;
    lastQR = null;
    console.log('[WhatsApp] Клиент готов к отправке сообщений');
    qrCallbacks.forEach(cb => cb({ type: 'ready' }));
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Авторизация успешна, сессия сохранена');
    qrCallbacks.forEach(cb => cb({ type: 'authenticated' }));
  });

  client.on('auth_failure', (msg) => {
    isReady = false;
    console.error('[WhatsApp] Ошибка авторизации:', msg);
    qrCallbacks.forEach(cb => cb({ type: 'auth_failure', msg }));
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    lastQR = null;
    console.warn('[WhatsApp] Отключён:', reason);
    qrCallbacks.forEach(cb => cb({ type: 'disconnected', reason }));
    client = null;
  });

  client.initialize().catch(err => {
    console.error('[WhatsApp] Ошибка инициализации:', err.message);
    isReady = false;
    lastQR = null;
    client = null;
    qrCallbacks.forEach(cb => cb({ type: 'disconnected', reason: err.message }));
  });

  return client;
}

async function forceRestart() {
  if (client) {
    try { await client.destroy(); } catch {}
    client = null;
    isReady = false;
    lastQR = null;
  }
  // Даём Puppeteer время полностью завершиться
  await new Promise(r => setTimeout(r, 1500));
  getClient();
}

function subscribeToEvents(callback) {
  qrCallbacks.push(callback);
  return () => {
    qrCallbacks = qrCallbacks.filter(cb => cb !== callback);
  };
}

function getLastQR() {
  return lastQR;
}

function formatPhone(phone) {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('8')) clean = '7' + clean.slice(1);
  if (!clean.startsWith('7') && clean.length === 10) clean = '7' + clean;
  return clean + '@c.us';
}

async function sendMessage(phone, message) {
  const wac = getClient();

  if (!isReady) {
    console.warn(`[WhatsApp] Клиент не готов, пропуск отправки на ${phone}`);
    return null;
  }

  const chatId = formatPhone(phone);

  try {
    // getNumberId возвращает актуальный ID с LID если нужно
    const numberId = await wac.getNumberId(chatId.replace('@c.us', ''));
    const resolvedId = numberId ? numberId._serialized : chatId;
    const result = await wac.sendMessage(resolvedId, message);
    console.log(`[WhatsApp] Отправлено на ${phone}: ${result.id._serialized}`);
    return result;
  } catch (err) {
    console.error(`[WhatsApp] Ошибка отправки на ${phone}:`, err.message);
    throw err;
  }
}

async function sendReminderBeforeExpiry(client) {
  const price = process.env.SUBSCRIPTION_PRICE || '250';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const token = generatePayToken(client.id);
  const link = `${appUrl}/pay/${token}`;
  const message = `Привет, ${client.name}! 👋\n\nНапоминаю, что скоро заканчивается ваша подписка на VPN.\n\n💰 Стоимость продления: *${price}₽/месяц*\n\n👇 Оплатите по ссылке:\n${link}\n\nЕсли не оплатить, VPN будет отключён автоматически.`;
  return await sendMessage(client.phone, message);
}

function generatePayToken(clientId) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'secret';
  // Без expiresIn — токен бессрочный
  return jwt.sign({ type: 'pay', client_id: clientId }, secret);
}

async function sendPaymentLink(phone, clientId, clientName) {
  const price = process.env.SUBSCRIPTION_PRICE || '250';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const token = generatePayToken(clientId);
  const link = `${appUrl}/pay/${token}`;
  const message = `${clientName}, вот ваша ссылка для оплаты 💳\n\nСумма: *${price}₽/месяц*\n\n� Нажмите чтобы оплатить:\n${link}`;
  return await sendMessage(phone, message);
}

async function sendExpiredNotification(client) {
  const price = process.env.SUBSCRIPTION_PRICE || '250';
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const token = generatePayToken(client.id);
  const link = `${appUrl}/pay/${token}`;
  const message = `${client.name}, ваша подписка на VPN закончилась ❌\n\nДоступ отключён.\n\n💰 Для возобновления оплатите *${price}₽* по ссылке:\n${link}`;
  return await sendMessage(client.phone, message);
}

async function sendActivationConfirmation(client, expiryDate) {
  const message = `${client.name}, оплата получена! ✅\n\nВаш VPN активирован до *${expiryDate}*.\n\nСпасибо за использование нашего сервиса! 🙏`;
  return await sendMessage(client.phone, message);
}

async function notifyAdminPaymentRequest(client, requestId, amount) {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const message =
    `💰 *Новая заявка на оплату*\n\n` +
    `👤 Клиент: *${client.name}*\n` +
    `📱 Телефон: ${client.phone}\n` +
    `💵 Сумма: *${amount}₽*\n\n` +
    `Примите или отклоните в панели:\n${appUrl}/payment-requests\n\n` +
    `Или ответьте командой:\n` +
    `✅ *принять ${requestId.slice(0, 8)}*\n` +
    `❌ *отклонить ${requestId.slice(0, 8)}*`;
  return await sendMessage(adminPhone, message);
}

async function notifyClientApproved(client, days) {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const token = generatePayToken(client.id);
  const newEnd = require('dayjs')().add(days, 'day').format('DD.MM.YYYY');
  const message =
    `✅ *Оплата принята!*\n\n` +
    `Привет, ${client.name}! Ваш платёж подтверждён.\n` +
    `VPN активирован до *${newEnd}*.\n\n` +
    `Спасибо! 🙏`;
  return await sendMessage(client.phone, message);
}

async function notifyClientRejected(client) {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const token = generatePayToken(client.id);
  const link = `${appUrl}/pay/${token}`;
  const message =
    `❌ *Оплата не подтверждена*\n\n` +
    `Привет, ${client.name}! К сожалению, мы не нашли ваш платёж.\n\n` +
    `Пожалуйста, попробуйте оплатить снова:\n${link}\n\n` +
    `Если возникли проблемы — напишите нам.`;
  return await sendMessage(client.phone, message);
}

function getStatus() {
  return { ready: isReady, initialized: client !== null };
}

module.exports = {
  getClient,
  sendMessage,
  sendPaymentLink,
  sendReminderBeforeExpiry,
  sendExpiredNotification,
  sendActivationConfirmation,
  notifyAdminPaymentRequest,
  notifyClientApproved,
  notifyClientRejected,
  getStatus,
  forceRestart,
  subscribeToEvents,
  getLastQR,
  setIncomingMessageHandler,
  formatPhone,
  generatePayToken,
};

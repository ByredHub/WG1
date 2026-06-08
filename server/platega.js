const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Platega API: https://platega.ru
const BASE_URL = 'https://platega.ru/api/v1';

async function createPayment(client, paymentId) {
  const shopId = process.env.PLATEGA_SHOP_ID;
  const secretKey = process.env.PLATEGA_SECRET_KEY;
  const price = process.env.SUBSCRIPTION_PRICE || '250';
  const appUrl = process.env.APP_URL || '';

  if (!shopId || !secretKey) {
    throw new Error('Platega: не заданы PLATEGA_SHOP_ID / PLATEGA_SECRET_KEY');
  }

  const payload = {
    shop_id: shopId,
    amount: parseInt(price),
    currency: 'RUB',
    order_id: paymentId,
    description: `VPN подписка — ${client.name}`,
    success_url: `${appUrl}/payment/success?payment_id=${paymentId}`,
    fail_url: `${appUrl}/payment/fail?payment_id=${paymentId}`,
    webhook_url: process.env.PLATEGA_WEBHOOK_URL || `${appUrl}/api/payments/webhook`,
    customer: {
      phone: client.phone,
    },
  };

  try {
    const res = await axios.post(`${BASE_URL}/payment/create`, payload, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    console.error('[Platega] Ошибка создания платежа:', err.response?.data || err.message);
    throw err;
  }
}

async function getPaymentStatus(orderId) {
  const secretKey = process.env.PLATEGA_SECRET_KEY;
  try {
    const res = await axios.get(`${BASE_URL}/payment/status`, {
      params: { order_id: orderId },
      headers: { 'Authorization': `Bearer ${secretKey}` },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    console.error('[Platega] Ошибка проверки статуса:', err.message);
    throw err;
  }
}

// Проверка подписи webhook от Platega
function verifyWebhook(body, signature) {
  const crypto = require('crypto');
  const secretKey = process.env.PLATEGA_SECRET_KEY;
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(body))
    .digest('hex');
  return expected === signature;
}

module.exports = { createPayment, getPaymentStatus, verifyWebhook };

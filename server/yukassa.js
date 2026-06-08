const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SHOP_ID = process.env.YUKASSA_SHOP_ID;
const SECRET_KEY = process.env.YUKASSA_SECRET_KEY;
const PRICE = process.env.SUBSCRIPTION_PRICE || '250';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const auth = {
  username: SHOP_ID,
  password: SECRET_KEY,
};

async function createPayment(client, paymentId) {
  const idempotenceKey = uuidv4();

  const payload = {
    amount: {
      value: `${PRICE}.00`,
      currency: 'RUB',
    },
    confirmation: {
      type: 'redirect',
      return_url: `${APP_URL}/payment/success?payment_id=${paymentId}`,
    },
    capture: true,
    description: `VPN подписка — ${client.name} (${client.phone})`,
    metadata: {
      payment_id: paymentId,
      client_id: client.id,
    },
  };

  try {
    const res = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      payload,
      {
        auth,
        headers: { 'Idempotence-Key': idempotenceKey },
        timeout: 15000,
      }
    );
    return res.data;
  } catch (err) {
    console.error('[YuKassa] Ошибка создания платежа:', err.response?.data || err.message);
    throw err;
  }
}

async function getPaymentStatus(yukassaPaymentId) {
  try {
    const res = await axios.get(
      `https://api.yookassa.ru/v3/payments/${yukassaPaymentId}`,
      { auth, timeout: 15000 }
    );
    return res.data;
  } catch (err) {
    console.error('[YuKassa] Ошибка проверки статуса:', err.message);
    throw err;
  }
}

function verifyWebhookSignature(body, signature) {
  return true;
}

module.exports = { createPayment, getPaymentStatus, verifyWebhookSignature };

const axios = require('axios');

const WG_EASY_URL = process.env.WG_EASY_URL || 'http://localhost:51821';
const WG_EASY_PASSWORD = process.env.WG_EASY_PASSWORD || '';

let sessionCookie = null;

async function login() {
  try {
    const res = await axios.post(`${WG_EASY_URL}/api/session`, {
      password: WG_EASY_PASSWORD
    }, { withCredentials: true });

    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
    }
    return true;
  } catch (err) {
    console.error('[WG-Easy] Login failed:', err.message);
    return false;
  }
}

async function request(method, path, data = null) {
  if (!sessionCookie) {
    await login();
  }

  try {
    const config = {
      method,
      url: `${WG_EASY_URL}${path}`,
      headers: { Cookie: sessionCookie },
    };
    if (data) config.data = data;

    const res = await axios(config);
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      sessionCookie = null;
      await login();
      const config = {
        method,
        url: `${WG_EASY_URL}${path}`,
        headers: { Cookie: sessionCookie },
      };
      if (data) config.data = data;
      const res = await axios(config);
      return res.data;
    }
    throw err;
  }
}

async function getPeers() {
  return await request('GET', '/api/wireguard/client');
}

async function getPeer(peerId) {
  const peers = await getPeers();
  return peers.find(p => p.id === peerId) || null;
}

async function createPeer(name) {
  return await request('POST', '/api/wireguard/client', { name });
}

async function deletePeer(peerId) {
  return await request('DELETE', `/api/wireguard/client/${peerId}`);
}

async function enablePeer(peerId) {
  return await request('POST', `/api/wireguard/client/${peerId}/enable`);
}

async function disablePeer(peerId) {
  return await request('POST', `/api/wireguard/client/${peerId}/disable`);
}

async function getPeerConfig(peerId) {
  const res = await axios.get(`${WG_EASY_URL}/api/wireguard/client/${peerId}/configuration`, {
    headers: { Cookie: sessionCookie },
    responseType: 'text'
  });
  return res.data;
}

module.exports = { getPeers, getPeer, createPeer, deletePeer, enablePeer, disablePeer, getPeerConfig, login };

const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { password } = JSON.parse(event.body || '{}');
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const SECRET = process.env.ADMIN_TOKEN_SECRET || ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'admin_not_configured' }) };
    }
    if (!password || password !== ADMIN_PASSWORD) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'invalid_password' }) };
    }

    const expiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hour session
    const sig = crypto.createHmac('sha256', SECRET).update(String(expiry)).digest('hex');
    const token = Buffer.from(JSON.stringify({ expiry, sig })).toString('base64');

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, token, expiry }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

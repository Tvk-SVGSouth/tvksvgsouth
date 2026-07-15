const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SECRET = process.env.ADMIN_TOKEN_SECRET;
  if (!SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_not_configured' }) };
  }

  try {
    const { password } = JSON.parse(event.body || '{}');
    if (!password) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'password_required' }) };
    }

    const supabase = getClient();
    // The username is fixed to "admin" -- the login form only ever asks for
    // a password. See supabase-setup.sql to add more admin accounts.
    const { data: isValid, error } = await supabase.rpc('verify_admin', {
      p_username: 'admin',
      p_password: password
    });

    if (error) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: error.message }) };
    }
    if (!isValid) {
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

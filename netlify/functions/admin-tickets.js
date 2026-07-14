const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Content-Type': 'application/json'
};

function verifyToken(token) {
  try {
    const SECRET = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD;
    if (!SECRET || !token) return false;
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (!decoded.expiry || !decoded.sig) return false;
    if (Date.now() > decoded.expiry) return false;
    const expected = crypto.createHmac('sha256', SECRET).update(String(decoded.expiry)).digest('hex');
    return expected === decoded.sig;
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!verifyToken(token)) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  const store = getStore('tickets');

  if (event.httpMethod === 'GET') {
    try {
      const tickets = [];
      let cursor;
      do {
        const page = await store.list({ cursor });
        for (const b of page.blobs) {
          const t = await store.get(b.key, { type: 'json' });
          if (t) tickets.push(t);
        }
        cursor = page.cursor;
      } while (cursor);

      tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, tickets }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
    }
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const { ticketId, status, note } = JSON.parse(event.body || '{}');
      if (!ticketId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'ticketId_required' }) };
      }
      const ticket = await store.get(String(ticketId).trim().toUpperCase(), { type: 'json' });
      if (!ticket) {
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
      }

      const validStatuses = ['Acknowledge', 'Work in Progress', 'Pending', 'Resolved'];
      if (status && validStatuses.includes(status)) {
        ticket.status = status;
      }
      if (note && String(note).trim()) {
        ticket.notes = ticket.notes || [];
        ticket.notes.push({ text: String(note).trim().slice(0, 1000), at: new Date().toISOString() });
      }
      ticket.updatedAt = new Date().toISOString();

      await store.setJSON(ticket.id, ticket);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticket }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};

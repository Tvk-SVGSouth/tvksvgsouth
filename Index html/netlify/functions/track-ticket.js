const { getStore } = require('@netlify/blobs');

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
    const { ticketId, phone } = JSON.parse(event.body || '{}');
    if (!ticketId || !phone) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'missing_fields' }) };
    }

    const store = getStore('tickets');
    const ticket = await store.get(String(ticketId).trim().toUpperCase(), { type: 'json' });

    if (!ticket) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
    }

    const phoneDigits = String(phone).replace(/\D/g, '');
    if (phoneDigits.length < 4 || !ticket.phone.endsWith(phoneDigits.slice(-4))) {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'phone_mismatch' }) };
    }

    const publicTicket = {
      id: ticket.id,
      name: ticket.name,
      constituency: ticket.constituency,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      attachmentUrl: ticket.attachmentUrl,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      notes: (ticket.notes || []).map(n => ({ text: n.text, at: n.at }))
    };

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticket: publicTicket }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

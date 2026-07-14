const { getStore } = require('@netlify/blobs');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function generateTicketId(constituency) {
  const prefix = constituency === 'Manamadurai' ? 'MMD' : 'SVG';
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TVK-${prefix}-${yy}${mm}${dd}-${rand}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    const required = ['name', 'phone', 'constituency', 'address', 'category', 'subject', 'description', 'consent'];
    for (const field of required) {
      if (!data[field] || !String(data[field]).trim()) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'missing_field', field }) };
      }
    }

    if (!['Sivagangai', 'Manamadurai'].includes(data.constituency)) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'invalid_constituency' }) };
    }

    const phoneDigits = String(data.phone).replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'invalid_phone' }) };
    }

    const store = getStore('tickets');

    let ticketId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateTicketId(data.constituency);
      const existing = await store.get(candidate);
      if (!existing) { ticketId = candidate; break; }
    }
    if (!ticketId) ticketId = generateTicketId(data.constituency) + '-' + Date.now().toString().slice(-4);

    const ticket = {
      id: ticketId,
      name: String(data.name).trim().slice(0, 120),
      phone: phoneDigits.slice(-15),
      constituency: data.constituency,
      address: String(data.address).trim().slice(0, 1000),
      category: String(data.category).trim().slice(0, 100),
      subject: String(data.subject).trim().slice(0, 200),
      description: String(data.description).trim().slice(0, 3000),
      attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl).slice(0, 500) : '',
      attachmentType: data.attachmentType ? String(data.attachmentType).slice(0, 50) : '',
      consent: data.consent === 'yes' ? 'yes' : 'no',
      status: 'Acknowledge',
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.setJSON(ticketId, ticket);

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticketId }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

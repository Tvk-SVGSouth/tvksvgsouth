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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_not_configured', detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' }) };
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

    const supabase = getClient();

    const row = {
      name: String(data.name).trim().slice(0, 120),
      phone: phoneDigits.slice(-15),
      constituency: data.constituency,
      address: String(data.address).trim().slice(0, 1000),
      category: String(data.category).trim().slice(0, 100),
      subject: String(data.subject).trim().slice(0, 200),
      description: String(data.description).trim().slice(0, 3000),
      attachment_url: data.attachmentUrl ? String(data.attachmentUrl).slice(0, 500) : '',
      attachment_type: data.attachmentType ? String(data.attachmentType).slice(0, 50) : '',
      consent: data.consent === 'yes' ? 'yes' : 'no',
      status: 'Acknowledge',
      notes: []
    };

    let ticketId = '';
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateTicketId(data.constituency);
      const { error } = await supabase.from('tickets').insert({ id: candidate, ...row });
      if (!error) { ticketId = candidate; lastError = null; break; }
      // 23505 = unique_violation (id collision) -> just retry with a new id
      if (error.code !== '23505') { lastError = error; break; }
      lastError = error;
    }

    if (!ticketId) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: lastError ? lastError.message : 'could not generate ticket id' }) };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticketId }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

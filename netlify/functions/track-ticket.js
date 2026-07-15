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

function mapPublicTicket(t) {
  return {
    id: t.id,
    status: t.status,
    name: t.name,
    category: t.category,
    subject: t.subject,
    constituency: t.constituency,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    notes: t.notes || []
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_not_configured' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const ticketId = String(data.ticketId || '').trim();
    const phoneDigits = String(data.phone || '').replace(/\D/g, '');

    if (!ticketId || phoneDigits.length < 4) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'ticket_and_phone_required' }) };
    }

    const supabase = getClient();
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .ilike('id', ticketId)
      .maybeSingle();

    if (error || !ticket) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
    }

    // Match on the last 10 digits so it still works regardless of a leading
    // 0 or country code either side typed in.
    const storedTail = String(ticket.phone).slice(-10);
    const inputTail = phoneDigits.slice(-10);
    if (storedTail !== inputTail) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticket: mapPublicTicket(ticket) }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

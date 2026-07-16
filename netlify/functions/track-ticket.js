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
    const phoneTail = phoneDigits.slice(-10);

    // Either field is enough on its own now -- the person can track using
    // just the Ticket ID, or just the phone number they filed the complaint
    // with (which may return more than one ticket).
    if (!ticketId && phoneTail.length < 4) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'ticket_or_phone_required' }) };
    }

    const supabase = getClient();

    if (ticketId) {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*')
        .ilike('id', ticketId)
        .maybeSingle();

      if (error || !ticket) {
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
      }

      // If a phone number was also supplied, cross-check it matches this
      // ticket (last 10 digits) so a Ticket ID alone plus a wrong number
      // can't be used to fish for other people's tickets.
      if (phoneTail) {
        const storedTail = String(ticket.phone).slice(-10);
        if (storedTail !== phoneTail) {
          return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
        }
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, tickets: [mapPublicTicket(ticket)] }) };
    }

    // Phone-only lookup: a citizen may have filed more than one complaint,
    // so return every ticket tied to this number, most recent first.
    const { data: rows, error } = await supabase
      .from('tickets')
      .select('*')
      .like('phone', '%' + phoneTail)
      .order('created_at', { ascending: false });

    if (error || !rows || !rows.length) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, tickets: rows.map(mapPublicTicket) }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Content-Type': 'application/json'
};

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function verifyToken(token) {
  try {
    const SECRET = process.env.ADMIN_TOKEN_SECRET;
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

function mapTicket(t) {
  return {
    id: t.id,
    name: t.name,
    phone: t.phone,
    constituency: t.constituency,
    address: t.address,
    category: t.category,
    subject: t.subject,
    description: t.description,
    attachmentUrl: t.attachment_url || '',
    attachmentType: t.attachment_type || '',
    consent: t.consent,
    status: t.status,
    assignee: t.assignee || '',
    notes: t.notes || [],
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_not_configured' }) };
  }

  const supabase = getClient();

  if (event.httpMethod === 'GET') {
    try {
      const { data: rows, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: error.message }) };
      }

      const tickets = (rows || []).map(mapTicket);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, tickets }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
    }
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const { ticketId, status, note, assignee } = JSON.parse(event.body || '{}');
      if (!ticketId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'ticketId_required' }) };
      }

      const cleanId = String(ticketId).trim();
      const { data: existing, error: fetchErr } = await supabase
        .from('tickets')
        .select('*')
        .ilike('id', cleanId)
        .maybeSingle();

      if (fetchErr || !existing) {
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'not_found' }) };
      }

      const validStatuses = ['Acknowledge', 'Work in Progress', 'Pending', 'Resolved'];
      const updates = { updated_at: new Date().toISOString() };

      if (status && validStatuses.includes(status)) {
        updates.status = status;
      }
      if (typeof assignee === 'string') {
        updates.assignee = assignee.trim().slice(0, 120);
      }
      if (note && String(note).trim()) {
        const notes = Array.isArray(existing.notes) ? existing.notes.slice() : [];
        notes.push({ text: String(note).trim().slice(0, 1000), at: new Date().toISOString() });
        updates.notes = notes;
      }

      const { data: updated, error: updateErr } = await supabase
        .from('tickets')
        .update(updates)
        .ilike('id', cleanId)
        .select()
        .single();

      if (updateErr) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: updateErr.message }) };
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticket: mapTicket(updated) }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};

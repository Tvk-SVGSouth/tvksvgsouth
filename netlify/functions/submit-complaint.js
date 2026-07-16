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

// Maps the long bilingual category values sent by the form to a short code
// used in the ticket ID, e.g. "Roads & Infrastructure | சாலைகள்..." -> "Road".
// Matching is on the English prefix so it's unaffected by wording tweaks
// further into the string.
function getCategoryCode(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.startsWith('roads')) return 'Road';
  if (cat.startsWith('water')) return 'Water';
  if (cat.startsWith('electricity')) return 'Power';
  if (cat.startsWith('sanitation')) return 'Sanitation';
  if (cat.startsWith('ration')) return 'Ration';
  if (cat.startsWith('government schemes') || cat.startsWith('govt schemes')) return 'Scheme';
  if (cat.startsWith('law')) return 'Law';
  return 'Other';
}

async function generateTicketId(supabase, category) {
  const code = getCategoryCode(category);
  const { data: num, error } = await supabase.rpc('next_ticket_number', { p_category_code: code });
  if (error) throw error;
  return `tvksvg-${code}${String(num).padStart(3, '0')}`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendOfficeNotification(ticketId, row) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.OFFICE_EMAIL;
  if (!apiKey || !toEmail) return; // email notifications not configured -- skip silently

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'TVK Grievance Cell <onboarding@resend.dev>';
  const attachmentLine = row.attachment_url
    ? `<p><strong>Attachment:</strong> <a href="${escapeHtml(row.attachment_url)}">${escapeHtml(row.attachment_url)}</a></p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#800000;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">New Grievance Submitted</h2>
      </div>
      <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <p style="font-size:18px;"><strong>Ticket ID:</strong> <span style="font-family:monospace;color:#800000;">${escapeHtml(ticketId)}</span></p>
        <p><strong>Name:</strong> ${escapeHtml(row.name)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(row.phone)}</p>
        <p><strong>Constituency:</strong> ${escapeHtml(row.constituency)}</p>
        <p><strong>Category:</strong> ${escapeHtml(row.category)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(row.subject)}</p>
        <p><strong>Description:</strong><br>${escapeHtml(row.description)}</p>
        <p><strong>Address:</strong><br>${escapeHtml(row.address)}</p>
        ${attachmentLine}
        <p><strong>May we contact directly:</strong> ${row.consent === 'yes' ? 'Yes' : 'No'}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#888;font-size:12px;">Submitted via the TVK Sivagangai South website grievance system.</p>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `New Grievance: ${ticketId} — ${row.subject}`,
        html
      })
    });
  } catch (e) {
    // Email is a nice-to-have, not critical -- never fail the submission over it.
    console.error('Resend email failed:', e.message);
  }
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
      assignee: '',
      notes: []
    };

    let ticketId = '';
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      let candidate;
      try {
        candidate = await generateTicketId(supabase, data.category);
      } catch (genErr) {
        lastError = genErr;
        break;
      }
      const { error } = await supabase.from('tickets').insert({ id: candidate, ...row });
      if (!error) { ticketId = candidate; lastError = null; break; }
      // 23505 = unique_violation (id collision) -> just retry with a new id
      if (error.code !== '23505') { lastError = error; break; }
      lastError = error;
    }

    if (!ticketId) {
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: lastError ? lastError.message : 'could not generate ticket id' }) };
    }

    // Fire-and-forget: don't let a slow/failed email delay or break the response
    await sendOfficeNotification(ticketId, row);

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ticketId }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'server_error', detail: err.message }) };
  }
};

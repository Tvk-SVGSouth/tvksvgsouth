# TVK Sivagangai South — Grievance Ticketing System (Supabase Edition)

## Update — Category ticket numbers, Assignee, and DVAC banner
This package adds three things on top of the Supabase edition:

1. **New Ticket ID format**: tickets are now numbered like `tvksvg-Road001`,
   `tvksvg-Water014`, `tvksvg-Power003` — the category picked in the form
   decides the prefix, and the number increments per category. Codes:
   Road, Water, Power, Sanitation, Ration, Scheme, Law, Other.
2. **Assignee field**: admins can now type in who a ticket is assigned to
   (e.g. "Ravi Kumar — Municipal Engineer") from the ticket detail panel;
   it shows in the ticket list, the CSV export, and is searchable.
3. **Category-wise ticket counts** on the admin dashboard, and a new
   **"Report Bribery / Corruption" (DVAC) banner** on the homepage.

**You must re-run `supabase-setup.sql`** (Step 1 below) even if you already
ran an earlier version — it's written with `if not exists` / `add column
if not exists` throughout, so it's safe to run again and will only add the
new `assignee` column and `category_counters` table without touching your
existing tickets. Existing ticket IDs (the old `TVK-SVG-...` style) keep
working fine for tracking and admin lookups; only new submissions get the
new `tvksvg-Category###` format.


This version stores complaints in **Supabase** (a free hosted Postgres
database) instead of Netlify Blobs. Everything else works the same way:
citizens file a complaint on `grievance.html`, get a Ticket ID, and can
check status anytime. Your team manages tickets from `admin.html`.

## What was changed from the Netlify Blobs version
- `netlify/functions/submit-complaint.js`, `track-ticket.js`,
  `admin-login.js`, `admin-tickets.js` — all rewritten to read/write
  Supabase instead of Netlify Blobs
- `package.json` — now depends on `@supabase/supabase-js` instead of
  `@netlify/blobs`
- `supabase-setup.sql` — **new file**, creates your database tables
- `grievance.html` and `admin.html` are **unchanged** — no frontend edits
  were needed, only the backend storage changed

## Step 1 — Create your database tables

1. Open your Supabase project: `https://mtazspzsbxsbbnbatbdv.supabase.co`
2. In the left sidebar, click **SQL Editor** → **New query**
3. Open `supabase-setup.sql` (included in this package), copy its entire
   contents, paste into the SQL Editor, and click **Run**
4. Check **Table Editor** in the sidebar — you should now see two tables:
   `tickets` and `admin_users`

This also creates one admin login for you: username `admin`, password
`TVKSVG` (matches what you told me — change it anytime, see the comment
inside `supabase-setup.sql` for the one-line SQL to update it).

## Step 2 — Get your Supabase API keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**
2. You'll need two values from this page:
   - **Project URL** — looks like `https://mtazspzsbxsbbnbatbdv.supabase.co`
   - **service_role key** — under "Project API keys". This is a **secret**
     key with full database access — never put it in any HTML/JS file,
     never share it publicly. It only goes into Netlify's environment
     variables (server-side only), which is what we set up next.

## Step 3 — Set Netlify environment variables

In Netlify: your site → **Project configuration** → **Environment variables**
→ **Add a variable**. Add these:

| Key | Value |
|---|---|
| `SUPABASE_URL` | your Project URL from Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from Step 2 (check "Contains secret values") |
| `ADMIN_TOKEN_SECRET` | any long random string you make up (check "Contains secret values") |
| `RESEND_API_KEY` | your Resend API key — see Step 4 below (check "Contains secret values") |
| `OFFICE_EMAIL` | the email address that should receive new-complaint notifications |

You can now **remove** the old `ADMIN_PASSWORD` variable if you had set
one — it's no longer used; the admin password now lives in the
`admin_users` table instead.

After adding these, go to **Deploys** → **Trigger deploy** → **Deploy site**
so the functions pick them up.

## Step 4 — Email notifications (Resend, free)

Every time someone submits a complaint, your office can now get an email
with all the details — no setup required if you skip this, submissions
just won't trigger an email.

1. Create a free account at **https://resend.com**
2. Go to **API Keys** → **Create API Key** (default permissions are fine)
3. Copy the key (starts with `re_...`) — this is `RESEND_API_KEY` above
4. Set `OFFICE_EMAIL` (Step 3 above) to whichever inbox should get these

That's it — by default emails send from `onboarding@resend.dev`, which
works immediately without any domain setup, and Resend's free tier covers
3,000 emails/month. If you later want emails to come from your own domain
(e.g. `grievance@tvksvgsouth.org`) instead, verify that domain in Resend
and set an extra variable `RESEND_FROM_EMAIL` to something like
`TVK Grievance Cell <grievance@tvksvgsouth.org>`.

## Step 5 — Cloudinary (unchanged, still needed for photo/video uploads)

If you haven't already done this from the earlier setup:
1. Free account at cloudinary.com
2. **Settings → Upload → Upload presets → Add upload preset → Unsigned**
3. Your Cloud Name and preset name go into `grievance.html` near the top
   of the `<script>` section — this is already filled in with
   `xmfy2c02` / `SVGSOUTH` in this package, so no action needed unless you
   want to change it.

## Step 6 — Deploy

Push all files in this package to the root of your GitHub repo (same repo
you already connected to Netlify), the same way as before. Netlify will
`npm install` (pulling in `@supabase/supabase-js`) and deploy.

## Verifying it works

1. `yoursite.netlify.app/grievance.html` → submit a test complaint → you
   should get a Ticket ID
2. In Supabase → **Table Editor** → `tickets` → you should see the new row
3. `yoursite.netlify.app/grievance.html#track` → enter that Ticket ID +
   the phone number you used → should show status "Acknowledge"
4. `yoursite.netlify.app/admin.html` → log in with password `TVKSVG` →
   you should see the ticket, with live counts for Overall / Acknowledge /
   Work in Progress / Pending / Resolved
5. Open the ticket in the dashboard, change its status, add a note, save
   → go back to the tracking page and check the same ticket again — the
   new status and note should appear
6. Check `OFFICE_EMAIL`'s inbox — you should have received a "New
   Grievance" email for your test submission (check spam folder the
   first time)
7. On the success screen after submitting, click **Download Receipt** —
   your browser's print dialog opens; choose "Save as PDF" as the
   destination to get a soft copy, or print it directly
8. In the admin dashboard, click **Export CSV** to download all (or
   filtered) tickets as a spreadsheet, or open a ticket and click
   **Print** to print/save that one ticket

## Notes
- No paid services required — Supabase free tier (500MB database, more
  than enough for a grievance cell) and Cloudinary free tier (25GB) cover
  this comfortably.
- The `service_role` key bypasses Supabase's row-level security by
  design — that's intentional and safe here, because it only ever runs
  inside your Netlify functions (server-side), never in the browser.
- To add a second admin login, run in the SQL Editor:
  ```sql
  insert into admin_users (username, password_hash)
  values ('secondadmin', crypt('their_password', gen_salt('bf')));
  ```
  (Note: `admin-login.js` currently only checks username `admin` since
  the login form only asks for a password — let me know if you want a
  username field added to support multiple admins with different logins.)

## Troubleshooting — admin dashboard not showing a new ticket
If a citizen gets a Ticket ID successfully but it doesn't show up when you
log into `admin.html` and click Refresh, walk through these in order:

1. **Supabase → Table Editor → tickets** — is the row actually there?
   - If **yes**: the submission worked; the problem is only in
     `admin-tickets.js` reading it back — check the next two points.
   - If **no**: the submission itself failed silently on the frontend, or
     the citizen never actually saw a Ticket ID (check your Netlify
     function logs for `submit-complaint` for errors).
2. **Netlify → Deploys** — after adding/changing any environment variable
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN_SECRET`),
   you must **Trigger deploy → Deploy site** again — functions only pick
   up env vars at build/deploy time, not automatically.
3. **Netlify → Functions → admin-tickets → Logs** (or your browser's
   Network tab on admin.html) — open the ticket dashboard, click Refresh,
   and look at the response from `/.netlify/functions/admin-tickets`.
   A `500` with `server_not_configured` means the Supabase env vars are
   missing on Netlify; any other `500` will show a `detail` message
   explaining the database error.
4. Make sure `supabase-setup.sql` was run in full (Step 1) — if
   `category_counters` or the `assignee` column don't exist yet, new
   submissions could fail even though the tables tab looks fine. Re-run
   the whole file; it's safe to run more than once.
5. Confirm the browser tab was fully reloaded after deploying this
   update — an old cached copy of `admin.html` in the browser won't have
   the new dashboard code.

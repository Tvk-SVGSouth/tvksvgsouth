# TVK Sivagangai South — Grievance Ticketing System (Supabase Edition)

## Latest update — Staff Portal, flexible tracking, redesigned dashboard

1. **Track by Ticket ID *or* phone number** — on `grievance.html`, the
   "நிலை அறிய / Track" tab no longer forces you to fill in both fields.
   Enter either the Ticket ID **or** the phone number used to file the
   complaint. If you only enter a phone number and that number filed more
   than one complaint, every matching ticket is shown.
2. **New: Staff / Assignee Ticket Portal** (`staff.html`) — one shared link
   and one shared password for every assignee (municipal engineer,
   volunteer, ward coordinator, etc). They can see **every** ticket, open
   any of them, change its status, assign/reassign it, and add a note —
   exactly like the admin dashboard can. Any update they make instantly
   reflects on the public tracking page and on the Admin Dashboard, since
   both portals read and write the same `tickets` table. Log in at
   `yoursite.netlify.app/staff.html` with the **staff password**
   (default `TVKSTAFF` — see Step 1, change it before going live).
3. **Admin Dashboard redesign** (`admin.html`) — new dark blue theme with a
   gradient header, glass-effect rounded cards, and animated count-up
   numbers on the stat cards. Also added an **Assignee-wise ticket count**
   panel next to the existing Category breakdown, so you can see at a
   glance how many tickets each person currently has (click a card to
   filter the list by that person). A **Staff Portal** button in the header
   opens `staff.html` in a new tab.
4. **You must re-run `supabase-setup.sql`** again (Step 1 below) to create
   the new `staff` login — it's safe to run repeatedly (`on conflict do
   nothing`), it will not touch your existing admin login or any tickets.

---

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

As of the "Staff Portal, flexible tracking, redesigned dashboard" update
above, `grievance.html` (track form) and `admin.html` (full redesign) were
both updated, and `staff.html` was added — see that section for details.

## Step 1 — Create your database tables

1. Open your Supabase project: `https://mtazspzsbxsbbnbatbdv.supabase.co`
2. In the left sidebar, click **SQL Editor** → **New query**
3. Open `supabase-setup.sql` (included in this package), copy its entire
   contents, paste into the SQL Editor, and click **Run**
4. Check **Table Editor** in the sidebar — you should now see two tables:
   `tickets` and `admin_users`

This also creates two logins for you:
- **Admin Dashboard** (`admin.html`): username `admin`, password `TVKSVG`
- **Staff Portal** (`staff.html`): username `staff`, password `TVKSTAFF`

Change either password anytime — see the comments inside
`supabase-setup.sql` for the one-line SQL to update each one. Do this
before you publish the site publicly.

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
3. `yoursite.netlify.app/grievance.html#track` → try tracking with just
   the Ticket ID (leave phone blank), then try again with just the phone
   number (leave Ticket ID blank) — both should independently find the
   ticket and show status "Acknowledge"
4. `yoursite.netlify.app/admin.html` → log in with password `TVKSVG` →
   you should see the ticket, with live animated counts for Overall /
   Acknowledge / Work in Progress / Pending / Resolved, plus the Category
   and Assignee-wise breakdown panels
5. Open the ticket in the dashboard, change its status, assign it to a
   name, add a note, save → go back to the tracking page and check the
   same ticket again — the new status and note should appear; back on the
   dashboard, that name should now appear in the Assignee-wise panel
6. `yoursite.netlify.app/staff.html` → log in with password `TVKSTAFF` →
   you should see the same ticket. Update its status or add another note
   from here → refresh `admin.html` and confirm the change shows up there
   too (both portals share the same ticket data)
7. Check `OFFICE_EMAIL`'s inbox — you should have received a "New
   Grievance" email for your test submission (check spam folder the
   first time)
8. On the success screen after submitting, click **Download Receipt** —
   your browser's print dialog opens; choose "Save as PDF" as the
   destination to get a soft copy, or print it directly
9. In the admin dashboard, click **Export CSV** to download all (or
   filtered) tickets as a spreadsheet, or open a ticket and click
   **Print** to print/save that one ticket

## Notes
- No paid services required — Supabase free tier (500MB database, more
  than enough for a grievance cell) and Cloudinary free tier (25GB) cover
  this comfortably.
- The `service_role` key bypasses Supabase's row-level security by
  design — that's intentional and safe here, because it only ever runs
  inside your Netlify functions (server-side), never in the browser.
- Only two usernames are recognized by the login endpoint: `admin` (full
  dashboard) and `staff` (shared assignee portal) — both are already
  seeded by `supabase-setup.sql`. Everyone using the Staff Portal shares
  the one `staff` password; there are no individual per-person logins.
  Each person still identifies themselves by typing their own name into
  the "Assign To" field on a ticket, which is what powers the
  Assignee-wise ticket count on the Admin Dashboard.

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

## Troubleshooting — staff.html login fails ("Incorrect access code")
- Make sure you re-ran the full `supabase-setup.sql` after this update —
  it's what creates the `staff` row in `admin_users`. Check **Table
  Editor → admin_users** in Supabase; you should see two rows, `admin`
  and `staff`.
- The default staff password is `TVKSTAFF`. If you changed it with the
  SQL snippet in `supabase-setup.sql`, use that new password instead.
- `staff.html` and `admin.html` use separate browser sessions (different
  `sessionStorage` keys), so logging into one does not log you into the
  other — that's expected.

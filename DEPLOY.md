# Going live — WakaWithUs

This sets up **live editing**: you edit in the dashboard, the change is saved to
Supabase, and the public website refreshes automatically (about a minute later).
The dashboard is a **separate app** and is never linked from the public website.

```
You (dashboard)  ──writes──▶  Supabase (content + images)
                                   │
                                   ├─ website pulls content at build
                                   └─ dashboard pings Vercel → website rebuilds → LIVE
```

---

## A. Supabase (≈5 min)

1. Open your project: `https://xexqljkwwusrbtibnmhc.supabase.co`
2. **SQL Editor → New query** → paste `supabase-setup.sql` from this folder → **Run**.
3. **Storage → New bucket** → name **`images`** → tick **Public bucket** → Save.
4. **Project Settings → API** → copy these (keep the service key secret!):
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`  ← secret, dashboard only

## B. Website on Vercel (≈10 min)

1. Push the website repo to GitHub: `https://github.com/chamkang/WakaWithUs.git`
   ```bash
   cd Crypgo-1.0.0
   git init && git add -A && git commit -m "WakaWithUs site"
   git branch -M main
   git remote add origin https://github.com/chamkang/WakaWithUs.git
   git push -u origin main
   ```
2. On **vercel.com → Add New → Project** → import **WakaWithUs**.
3. **Settings → Environment Variables** → add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = anon public key
4. **Deploy.** (Each build pulls the latest content from Supabase.)
5. **Settings → Git → Deploy Hooks** → create a hook (branch `main`) → copy the URL.
   This is your `VERCEL_DEPLOY_HOOK` for the dashboard.

## C. Dashboard in LIVE mode

Set these env vars before starting the dashboard (Windows PowerShell example):

```powershell
$env:SUPABASE_URL="https://xexqljkwwusrbtibnmhc.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<your service_role key>"
$env:VERCEL_DEPLOY_HOOK="<the deploy hook URL>"
$env:ADMIN_PASSWORD="<choose a strong password>"
npm start
```

The console will say **"LIVE / Supabase mode"**. Now every **Save** writes to Supabase
and triggers the website to rebuild → your edit goes live automatically.

> Want the dashboard online too (still unlinked from the site)? Deploy this folder
> to a free Node host (e.g. Render.com → New Web Service → start command `npm start`)
> and set the same env vars there. Its URL stays private to you.

---

### Notes
- Without the Supabase env vars the dashboard runs in **LOCAL mode** (edits the file
  on your computer) — handy for offline tweaks.
- The website always has a safe fallback: if Supabase is unreachable at build time, it
  uses the last content bundled in the repo, so it never breaks.

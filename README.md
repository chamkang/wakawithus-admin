# WakaWithUs — Content Dashboard

A lightweight, **local** content manager for the WakaWithUs website. It edits the
website's content store (`Crypgo-1.0.0/src/content/site.json`) and manages the
images in `Crypgo-1.0.0/public/images/photos` — no database, no hosting needed.

## Run it

```bash
cd wakawithus-admin
npm install          # first time only
npm start
```

Then open **http://localhost:4000** and log in.

- **Default password:** `wakawithus`
  Change it by setting an env var before starting:
  `set ADMIN_PASSWORD=yourpassword` (Windows) then `npm start`.
- If the website folder isn't the sibling `../Crypgo-1.0.0`, set `SITE_ROOT`:
  `set SITE_ROOT=C:\path\to\Crypgo-1.0.0`

## What you can edit

Everything on the site is in one editable store, grouped into sections in the
left sidebar: **Global** (brand, WhatsApp, email, location, socials), **Hero**,
**Intro**, **Why**, **How it works**, **Destinations**, **Trips**, **Services**,
**About**, **Testimonials**, **FAQ**, **Marquee**.

For every field you can:
- **Edit** any text or number.
- **Add / delete / reorder** list items (trips, services, FAQs, founders, itinerary days, etc.).
- **Upload or replace images** (with live preview) — the file is saved straight into the website.

Click **Save changes** to write to the website. Every save also keeps a timestamped
backup in `wakawithus-admin/backups/`.

## Publishing changes

The website is a static export, so after saving:
- **Local preview:** the dev server (`npm run dev` in the website) hot-reloads automatically.
- **Live site:** rebuild & redeploy the website (`npm run build` in `Crypgo-1.0.0`).

## Tests

```bash
node admin-test.mjs   # API: auth, edit, add, delete, image upload (server must be running)
node e2e-test.mjs     # confirms a dashboard edit appears on the live site (both servers running)
```

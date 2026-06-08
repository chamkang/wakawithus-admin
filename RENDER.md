# Host the dashboard online (Render) — optional

This puts the Content Studio on its own private URL (e.g. `https://wakawithus-admin.onrender.com`)
so you can edit from anywhere. It stays password-protected and is **never linked** from the public
website. Render's free tier is fine (it sleeps after ~15 min idle, so the first load after a break
takes ~30–50s — normal for an admin tool).

## 1. Put the dashboard in its own GitHub repo
Create a new **empty** repo on GitHub called `wakawithus-admin` (do NOT reuse the website repo).
Then, from this folder:

```bash
cd "C:\Users\DELL\Desktop\wakawithus-admin"
git init
git add -A
git commit -m "WakaWithUs admin dashboard"
git branch -M main
git remote add origin https://github.com/chamkang/wakawithus-admin.git
git push -u origin main
```

> ✅ Your secret key is safe: `start-live.ps1` and `.env` are in `.gitignore`, so they are **not** pushed.
> The secret lives only in Render's environment variables (step 3).

## 2. Create the Render service
1. Go to **render.com** → **New + → Web Service**.
2. Connect your GitHub and pick the **wakawithus-admin** repo.
3. Render auto-detects Node. Confirm:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
4. Click **Create Web Service** (it will build once; finish step 3 so it works).

## 3. Add environment variables (Render → your service → Environment)
| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://xexqljkwwusrbtibnmhc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase **secret** key |
| `VERCEL_DEPLOY_HOOK` | your Vercel deploy hook URL |
| `ADMIN_PASSWORD` | a strong password you choose |
| `SUPABASE_BUCKET` | `images` |

Save → Render redeploys automatically.

## 4. Use it
Open your Render URL (e.g. `https://wakawithus-admin.onrender.com`), log in with `ADMIN_PASSWORD`,
edit, and click **Publish**. It writes to Supabase and triggers the live website to rebuild (~1 min).

---

### Updating the dashboard later
Any code change: `git add -A && git commit -m "..." && git push` → Render redeploys automatically.

### Security reminder
Keep the Render URL to yourself. Anyone with the URL still needs the password, but an unguessable URL +
strong password is your protection. Rotate the Supabase secret key any time in Supabase → API Keys.

/**
 * WakaWithUs — Admin Content Dashboard (separate from the public website).
 *
 * Two modes, chosen automatically by env vars:
 *  • LOCAL mode (default): reads/writes the website's src/content/site.json and
 *    saves images into public/images/photos. Great for local editing.
 *  • LIVE mode (when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set): reads/writes
 *    content in Supabase and uploads images to Supabase Storage. On save it can ping
 *    a Vercel Deploy Hook so the live site refreshes automatically.
 */
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 4000;
const PASSWORD = process.env.ADMIN_PASSWORD || "wakawithus";

// Website project (used in LOCAL mode + for seeding Supabase the first time)
const SITE_ROOT = process.env.SITE_ROOT || path.join(__dirname, "..", "Crypgo-1.0.0");
const CONTENT_FILE = path.join(SITE_ROOT, "src", "content", "site.json");
const PHOTOS_DIR = path.join(SITE_ROOT, "public", "images", "photos");
const SITE_PUBLIC = path.join(SITE_ROOT, "public");

// Supabase / live config
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "images";
const DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK || "";
const LIVE = Boolean(SUPABASE_URL && SERVICE_KEY);

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// ---- middleware ----
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/site", express.static(SITE_PUBLIC)); // preview local images

// ---- auth ----
const sessions = new Set();
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > -1) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function isAuthed(req) {
  const { admin_session } = parseCookies(req);
  return Boolean(admin_session && sessions.has(admin_session));
}
function requireAuth(req, res, next) { if (isAuthed(req)) return next(); res.status(401).json({ error: "Not authenticated" }); }

app.post("/api/login", (req, res) => {
  if ((req.body && req.body.password) === PASSWORD) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    res.setHeader("Set-Cookie", `admin_session=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
    return res.json({ ok: true, mode: LIVE ? "live" : "local" });
  }
  res.status(401).json({ error: "Wrong password" });
});
app.post("/api/logout", (req, res) => {
  const { admin_session } = parseCookies(req);
  sessions.delete(admin_session);
  res.setHeader("Set-Cookie", "admin_session=; Path=/; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/session", (req, res) => res.json({ authed: isAuthed(req), mode: LIVE ? "live" : "local" }));

// ---- Supabase helpers ----
function readSeed() {
  // Used to seed Supabase the first time AND to fill in any fields added to the
  // schema later. Works locally (website file) and when deployed (bundled copy).
  for (const p of [CONTENT_FILE, path.join(__dirname, "seed-content.json")]) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {}
  }
  return {};
}

// Fill in keys present in `seed` but missing in `data` (never overwrites real values).
// Lets newly-added fields (e.g. a review image) appear even if the stored data is older.
function withDefaults(seed, data) {
  if (Array.isArray(seed)) {
    if (!Array.isArray(data)) return data;
    const template = seed[0];
    return data.map((item, i) => withDefaults(seed[i] !== undefined ? seed[i] : template, item));
  }
  if (seed && typeof seed === "object") {
    if (!data || typeof data !== "object") return data;
    const out = { ...data };
    for (const k of Object.keys(seed)) {
      out[k] = k in out ? withDefaults(seed[k], out[k]) : seed[k];
    }
    return out;
  }
  return data;
}
async function sbGetContent() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content?id=eq.1&select=data`, { headers: sbHeaders });
  if (!r.ok) throw new Error("Supabase read failed: " + r.status);
  const rows = await r.json();
  if (rows[0] && rows[0].data) return rows[0].data;
  const seed = readSeed();
  await sbPutContent(seed);
  return seed;
}
async function sbPutContent(data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content`, {
    method: "POST",
    headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, data }),
  });
  if (!r.ok) throw new Error("Supabase write failed: " + r.status + " " + (await r.text()));
}
async function triggerDeploy() {
  if (!DEPLOY_HOOK) return;
  try { await fetch(DEPLOY_HOOK, { method: "POST" }); } catch (_) {}
}

// ---- content ----
app.get("/api/content", requireAuth, async (req, res) => {
  try {
    if (LIVE) return res.json(withDefaults(readSeed(), await sbGetContent()));
    const fileData = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
    res.json(withDefaults(readSeed(), fileData));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/content", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") throw new Error("Invalid content body");
    if (LIVE) {
      await sbPutContent(data);
      triggerDeploy();
      return res.json({ ok: true, mode: "live", published: Boolean(DEPLOY_HOOK) });
    }
    // local: keep a backup then write
    try {
      const bdir = path.join(__dirname, "backups");
      fs.mkdirSync(bdir, { recursive: true });
      if (fs.existsSync(CONTENT_FILE)) fs.copyFileSync(CONTENT_FILE, path.join(bdir, `site.${Date.now()}.json`));
    } catch (_) {}
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
    res.json({ ok: true, mode: "local" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- images ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  try {
    if (LIVE) {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${safe}`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": req.file.mimetype, "x-upsert": "true" },
        body: req.file.buffer,
      });
      if (!r.ok) throw new Error("Upload failed: " + r.status + " " + (await r.text()));
      return res.json({ path: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${safe}` });
    }
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PHOTOS_DIR, safe), req.file.buffer);
    res.json({ path: `/images/photos/${safe}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/images", requireAuth, async (req, res) => {
  try {
    if (LIVE) {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 200, sortBy: { column: "name", order: "asc" } }),
      });
      const items = r.ok ? await r.json() : [];
      return res.json({ images: items.filter((i) => i.name).map((i) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${i.name}`) });
    }
    const files = fs.readdirSync(PHOTOS_DIR).filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f)).map((f) => `/images/photos/${f}`);
    res.json({ images: files });
  } catch (e) { res.json({ images: [] }); }
});

app.delete("/api/images", requireAuth, async (req, res) => {
  try {
    const name = path.basename(String(req.query.name || ""));
    if (LIVE) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, { method: "DELETE", headers: sbHeaders });
      return res.json({ ok: true });
    }
    const target = path.join(PHOTOS_DIR, name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n  WakaWithUs Admin Dashboard  (${LIVE ? "LIVE / Supabase" : "LOCAL / file"} mode)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  Password: ${PASSWORD}`);
  if (LIVE) console.log(`  Supabase: ${SUPABASE_URL}  bucket: ${BUCKET}  deployHook: ${DEPLOY_HOOK ? "set" : "none"}`);
  else console.log(`  Editing: ${CONTENT_FILE}`);
  console.log("");
});

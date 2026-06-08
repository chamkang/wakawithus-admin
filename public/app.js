/* WakaWithUs Content Studio — recursive editor bound to the live content object */
let content = null;
let current = null;
let mode = "local";

const $ = (s) => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const pretty = (k) => k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
const isImagePath = (v) => typeof v === "string" && (v.startsWith("/images/") || v.startsWith("http") || /\.(jpe?g|png|webp|gif|avif)$/i.test(v));
const isImageKey = (k) => ["image", "flyer"].includes(k);

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.borderColor = bad ? "#7f2d22" : "#342a1e";
  t.style.background = bad ? "#2a1410" : "#1b1610";
  t.style.opacity = "1";
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.style.opacity = "0"), 3000);
}

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  return fetch(url, opt);
}

function applyMode(m) {
  mode = m || "local";
  const badge = $("#modeBadge");
  if (mode === "live") {
    badge.textContent = "● LIVE";
    badge.style.cssText = "background:rgba(107,166,68,.16);color:#8fd05f";
    $("#saveLabel").textContent = "Publish";
    $("#status").textContent = "Edits publish to the live site";
  } else {
    badge.textContent = "● LOCAL";
    badge.style.cssText = "background:rgba(224,169,60,.16);color:#E0A93C";
    $("#saveLabel").textContent = "Save";
    $("#status").textContent = "Editing local files";
  }
  badge.classList.remove("hidden");
}

/* ---------- auth ---------- */
async function checkSession() {
  const r = await fetch("/api/session");
  const j = await r.json();
  if (j.authed) { applyMode(j.mode); await loadContent(); showApp(); }
  else showLogin();
}
function showLogin() { $("#login").classList.remove("hidden"); $("#app").classList.add("hidden"); }
function showApp() { $("#login").classList.add("hidden"); $("#app").classList.remove("hidden"); }

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const r = await api("POST", "/api/login", { password: $("#password").value });
  if (r.ok) { const j = await r.json().catch(() => ({})); applyMode(j.mode); await loadContent(); showApp(); }
  else { const err = $("#loginError"); err.textContent = "Wrong password."; err.classList.remove("hidden"); }
});
$("#logoutBtn").addEventListener("click", async () => { await api("POST", "/api/logout"); location.reload(); });
$("#reloadBtn").addEventListener("click", async () => { await loadContent(); toast("Reloaded"); });
$("#saveBtn").addEventListener("click", save);

async function loadContent() {
  const r = await fetch("/api/content");
  if (r.status === 401) return showLogin();
  content = await r.json();
  buildSidebar();
  if (!current || !(current in content)) current = Object.keys(content)[0];
  renderSection(current);
}

async function save() {
  const btn = $("#saveBtn"); const label = $("#saveLabel"); const prev = label.textContent;
  label.textContent = "Saving…"; btn.disabled = true; btn.classList.add("opacity-70");
  try {
    const r = await api("PUT", "/api/content", content);
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j.mode === "live") toast(j.published ? "Published ✓ — live site rebuilding (~1 min)" : "Saved to Supabase ✓");
      else toast("Saved ✓ — rebuild/redeploy to publish");
    } else { const j = await r.json().catch(() => ({})); toast(j.error || "Save failed", true); }
  } catch (e) { toast("Save failed: " + e.message, true); }
  label.textContent = prev; btn.disabled = false; btn.classList.remove("opacity-70");
}

/* ---------- sidebar ---------- */
function buildSidebar() {
  const nav = $("#sections");
  nav.innerHTML = "";
  Object.keys(content).forEach((key) => {
    const b = el("button", "sidebar-link text-left whitespace-nowrap px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5 transition-colors", pretty(key));
    b.onclick = () => { current = key; renderSection(key); [...nav.children].forEach((c) => c.classList.remove("active")); b.classList.add("active"); };
    if (key === current) b.classList.add("active");
    nav.appendChild(b);
  });
}

/* ---------- editor ---------- */
function renderSection(key) {
  const root = $("#editor");
  root.innerHTML = "";
  const head = el("div", "mb-5");
  head.appendChild(el("h2", "font-display text-3xl text-ink", pretty(key)));
  head.appendChild(el("p", "text-muted text-sm mt-1", "Edit the fields below, then " + (mode === "live" ? "Publish" : "Save") + "."));
  root.appendChild(head);
  const card = el("div", "bg-surface rounded-2xl border border-line p-5 md:p-6");
  const val = content[key];
  if (Array.isArray(val)) card.appendChild(renderArray(content, key));
  else if (val && typeof val === "object") card.appendChild(renderObject(val));
  else card.appendChild(renderField(content, key));
  root.appendChild(card);
}

function renderObject(obj) {
  const wrap = el("div", "space-y-4");
  Object.keys(obj).forEach((k) => wrap.appendChild(renderField(obj, k)));
  return wrap;
}

function renderField(parent, key) {
  const val = parent[key];
  if (Array.isArray(val)) return renderArray(parent, key);
  if (val && typeof val === "object") {
    const fs = el("div", "border border-line rounded-xl p-4 bg-surface2");
    fs.appendChild(el("p", "field-label mb-3", pretty(key)));
    fs.appendChild(renderObject(val));
    return fs;
  }
  const wrap = el("div", "");
  wrap.appendChild(el("label", "field-label block mb-1.5", pretty(key)));
  if (isImageKey(key) || isImagePath(val)) {
    wrap.appendChild(imageControl(() => parent[key], (v) => (parent[key] = v)));
  } else if (typeof val === "number") {
    const inp = el("input"); inp.type = "number"; inp.value = val; inp.style.maxWidth = "10rem";
    inp.oninput = () => (parent[key] = inp.value === "" ? 0 : Number(inp.value));
    wrap.appendChild(inp);
  } else {
    const long = String(val || "").length > 60;
    const inp = el(long ? "textarea" : "input");
    if (long) inp.rows = Math.min(10, Math.ceil(String(val).length / 70) + 1);
    inp.value = val == null ? "" : val;
    inp.oninput = () => (parent[key] = inp.value);
    wrap.appendChild(inp);
  }
  return wrap;
}

function renderArray(parent, key) {
  const arr = parent[key];
  const wrap = el("div", "");
  const header = el("div", "flex items-center justify-between mb-3");
  header.appendChild(el("p", "field-label", `${pretty(key)} · ${arr.length} item${arr.length === 1 ? "" : "s"}`));
  const addBtn = el("button", "text-sm px-3 py-1.5 rounded-lg bg-forest text-white font-semibold hover:bg-forestdk transition-colors", "+ Add");
  header.appendChild(addBtn);
  wrap.appendChild(header);
  const list = el("div", "space-y-3");
  wrap.appendChild(list);

  function redraw() {
    list.innerHTML = "";
    header.firstChild.textContent = `${pretty(key)} · ${arr.length} item${arr.length === 1 ? "" : "s"}`;
    arr.forEach((item, idx) => list.appendChild(renderArrayItem(arr, idx, redraw)));
  }
  addBtn.onclick = () => {
    if (arr.length && typeof arr[0] === "object") arr.push(blankFrom(arr[0]));
    else if (arr.length && typeof arr[0] === "number") arr.push(0);
    else arr.push("");
    redraw();
  };
  redraw();
  return wrap;
}

function renderArrayItem(arr, idx, redraw) {
  const item = arr[idx];
  const card = el("div", "border border-line rounded-xl p-4 bg-surface2");
  const bar = el("div", "flex items-center justify-between mb-3");
  bar.appendChild(el("p", "text-xs font-bold text-muted", `#${idx + 1}`));
  const ctrls = el("div", "flex gap-1");
  const up = el("button", "text-xs w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-white/5", "↑");
  const down = el("button", "text-xs w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-white/5", "↓");
  const del = el("button", "text-xs px-2.5 h-7 rounded-md text-red-400 hover:bg-red-500/10", "Delete");
  up.onclick = () => { if (idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; redraw(); } };
  down.onclick = () => { if (idx < arr.length - 1) { [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; redraw(); } };
  del.onclick = () => { if (confirm("Delete this item?")) { arr.splice(idx, 1); redraw(); } };
  ctrls.append(up, down, del);
  bar.appendChild(ctrls);
  card.appendChild(bar);

  if (item && typeof item === "object") card.appendChild(renderObject(item));
  else if (typeof item === "string" && isImagePath(item)) card.appendChild(imageControl(() => arr[idx], (v) => (arr[idx] = v)));
  else if (typeof item === "number") { const inp = el("input"); inp.type = "number"; inp.value = item; inp.style.maxWidth = "10rem"; inp.oninput = () => (arr[idx] = Number(inp.value)); card.appendChild(inp); }
  else { const inp = el("input"); inp.value = item; inp.oninput = () => (arr[idx] = inp.value); card.appendChild(inp); }
  return card;
}

function blankFrom(template) {
  if (Array.isArray(template)) return [];
  if (template && typeof template === "object") { const o = {}; for (const k in template) o[k] = blankFrom(template[k]); return o; }
  if (typeof template === "number") return 0;
  return "";
}

/* ---------- image control ---------- */
function imageControl(getVal, setVal) {
  const box = el("div", "flex items-start gap-4");
  const previewWrap = el("div", "w-28 h-28 rounded-xl overflow-hidden bg-surface2 flex items-center justify-center flex-shrink-0 border border-line");
  const img = el("img", "w-full h-full object-cover");
  const refresh = () => {
    const v = getVal();
    if (v) { img.src = v.startsWith("http") ? v : "/site" + v + "?t=" + Date.now(); img.style.display = "block"; }
    else img.style.display = "none";
  };
  img.onerror = () => (img.style.display = "none");
  previewWrap.appendChild(img);
  box.appendChild(previewWrap);

  const right = el("div", "flex-1 min-w-0");
  const path = el("input"); path.value = getVal() || ""; path.style.fontSize = "13px";
  path.oninput = () => { setVal(path.value); refresh(); };
  right.appendChild(path);

  const row = el("div", "flex items-center gap-2 mt-2");
  const file = el("input"); file.type = "file"; file.accept = "image/*";
  const upBtn = el("button", "text-sm px-3 py-2 rounded-lg border border-forest text-forest font-semibold hover:bg-forest hover:text-white transition-colors", "Upload / replace");
  upBtn.onclick = () => file.click();
  file.onchange = async () => {
    if (!file.files[0]) return;
    upBtn.textContent = "Uploading…";
    const fd = new FormData(); fd.append("file", file.files[0]);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    upBtn.textContent = "Upload / replace";
    if (r.ok) { const j = await r.json(); setVal(j.path); path.value = j.path; refresh(); toast("Image uploaded ✓"); }
    else toast("Upload failed", true);
  };
  row.append(upBtn, file);
  right.appendChild(row);
  box.appendChild(right);
  refresh();
  return box;
}

checkSession();

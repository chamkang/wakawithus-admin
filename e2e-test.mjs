/* End-to-end: edit via dashboard API, confirm the live website renders the change. */
const ADMIN = "http://localhost:4000";
const SITE = "http://localhost:3001";
let cookie = "";
const log = (n, c) => console.log(`  ${c ? "PASS" : "FAIL"}  ${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// login
let r = await fetch(ADMIN + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "wakawithus" }) });
cookie = (r.headers.get("set-cookie") || "").split(";")[0];

// get content
const content = await (await fetch(ADMIN + "/api/content", { headers: { Cookie: cookie } })).json();
const original = content.hero.pill;
const marker = "E2E-LIVE-CHECK-" + Date.now();

// edit hero.pill via dashboard
content.hero.pill = marker;
await fetch(ADMIN + "/api/content", { method: "PUT", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(content) });

// wait for Next dev to recompile, then fetch the live homepage
let found = false;
for (let i = 0; i < 12; i++) {
  await sleep(2500);
  try {
    const html = await (await fetch(SITE + "/", { cache: "no-store" })).text();
    if (html.includes(marker)) { found = true; break; }
  } catch (_) {}
}
log("Edit made in dashboard appears on the live website", found);

// restore
content.hero.pill = original;
await fetch(ADMIN + "/api/content", { method: "PUT", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(content) });
console.log("  (original content restored)");
process.exit(found ? 0 : 1);

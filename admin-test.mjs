/* Senior-tester harness for the WakaWithUs admin dashboard.
   Exercises auth, read, modify, add, delete, and image upload end-to-end,
   verifying the website's content file (site.json) actually changes. */
import fs from "fs";
import path from "path";

const BASE = "http://localhost:4000";
const CONTENT_FILE = path.join(process.cwd(), "..", "Crypgo-1.0.0", "src", "content", "site.json");
let cookie = "";
let pass = 0, fail = 0;
const ok = (n, c) => { (c ? pass++ : fail++); console.log(`  ${c ? "PASS" : "FAIL"}  ${n}`); };
const readFile = () => JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));

async function call(method, url, body, withCookie = true) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withCookie && cookie) headers["Cookie"] = cookie;
  const r = await fetch(BASE + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  return r;
}

const originalRaw = fs.readFileSync(CONTENT_FILE, "utf8");

console.log("\n── WakaWithUs Admin — Senior Tester ──\n");

// 1. Unauthed session
let r = await call("GET", "/api/session", undefined, false);
let j = await r.json();
ok("Session starts unauthenticated", j.authed === false);

// 2. Reject content read without auth
r = await call("GET", "/api/content", undefined, false);
ok("Content read blocked without login (401)", r.status === 401);

// 3. Wrong password rejected
r = await call("POST", "/api/login", { password: "wrong" }, false);
ok("Wrong password rejected (401)", r.status === 401);

// 4. Login
r = await call("POST", "/api/login", { password: "wakawithus" }, false);
const setCookie = r.headers.get("set-cookie") || "";
cookie = setCookie.split(";")[0];
ok("Login succeeds & sets session cookie", r.ok && cookie.startsWith("admin_session="));

// 5. Read content
r = await call("GET", "/api/content");
const content = await r.json();
ok("Reads full content", r.ok && content.global && Array.isArray(content.trips));
const tripsBefore = content.trips.length;

// 6. MODIFY a text field
content.global.brandName = "WakaWithUs-EDITED";
content.hero.headlineAccent = "one EDIT";
r = await call("PUT", "/api/content", content);
ok("Save (PUT) succeeds", r.ok);
let disk = readFile();
ok("Text edit persisted to site.json", disk.global.brandName === "WakaWithUs-EDITED" && disk.hero.headlineAccent === "one EDIT");

// 7. ADD an item (new trip) + nested edit
const newTrip = JSON.parse(JSON.stringify(content.trips[1]));
newTrip.title = "Test Adventure (added by tester)";
newTrip.destination = "Testville";
content.trips.push(newTrip);
content.faq.push({ q: "Test question?", a: "Test answer." });
r = await call("PUT", "/api/content", content);
disk = readFile();
ok("Add trip persisted (count +1)", disk.trips.length === tripsBefore + 1);
ok("Added trip keeps nested itinerary array", Array.isArray(disk.trips[disk.trips.length - 1].itinerary));
ok("Add FAQ persisted", disk.faq[disk.faq.length - 1].q === "Test question?");

// 8. DELETE items
content.trips.pop();
content.faq.pop();
r = await call("PUT", "/api/content", content);
disk = readFile();
ok("Delete trip persisted (count restored)", disk.trips.length === tripsBefore);

// 9. Image upload
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const fd = new FormData();
fd.append("file", new Blob([png], { type: "image/png" }), "tester-pixel.png");
r = await fetch(BASE + "/api/upload", { method: "POST", headers: { Cookie: cookie }, body: fd });
j = await r.json();
ok("Image upload returns a path", r.ok && j.path === "/images/photos/tester-pixel.png");
ok("Uploaded image exists on disk", fs.existsSync(path.join(CONTENT_FILE, "..", "..", "..", "public", "images", "photos", "tester-pixel.png")));

// 10. List images includes upload
r = await call("GET", "/api/images");
j = await r.json();
ok("Image list includes uploaded file", j.images.includes("/images/photos/tester-pixel.png"));

// 11. Delete uploaded image
r = await call("DELETE", "/api/images?name=tester-pixel.png");
ok("Image delete succeeds", r.ok);
ok("Uploaded image removed from disk", !fs.existsSync(path.join(CONTENT_FILE, "..", "..", "..", "public", "images", "photos", "tester-pixel.png")));

// 12. Unauthorized write blocked
r = await call("PUT", "/api/content", { hacked: true }, false);
ok("Write blocked without auth (401)", r.status === 401);

// 13. Restore original content exactly
fs.writeFileSync(CONTENT_FILE, originalRaw, "utf8");
ok("Original content restored", fs.readFileSync(CONTENT_FILE, "utf8") === originalRaw);

console.log(`\n── Result: ${pass} passed, ${fail} failed ──\n`);
process.exit(fail ? 1 : 0);

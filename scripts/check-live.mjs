const url = process.argv[2] || "https://carmasr-app.vercel.app/";

const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
const h = await r.text();
const assets = [...new Set([...h.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map((m) => m[0]))];
console.log("assets:", assets.join("  "));
console.log("sw registered in html:", /sw\.js|serviceWorker/.test(h) ? "نعم" : "لا");

for (const a of assets.filter((x) => x.endsWith(".js"))) {
  const js = await fetch(new URL(a, url).href, { headers: { "Cache-Control": "no-cache" } });
  const t = await js.text();
  const idx = t.indexOf("مليون");
  const around = idx > -1 ? t.slice(Math.max(0, idx - 260), idx + 60) : "(مفيش نص مليون)";
  console.log(`\n--- ${a}  حجم=${(t.length / 1024).toFixed(0)}KB`);
  console.log("الكود الحالي في نسخة الموقع:\n" + around);
  console.log("\nالنسخة فيها toFixed(2) ؟", /toFixed\(2\)/.test(around) ? "نعم (جديد)" : "لا (قديم)");
  break;
}
const url = "https://carmasr-app.vercel.app/";
const deadline = Date.now() + 6 * 60 * 1000;

async function check() {
  const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  const h = await r.text();
  const asset = (h.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
  if (!asset) return { ok: false, note: "مفيش bundle" };
  const js = await fetch(new URL(asset, url).href, { headers: { "Cache-Control": "no-cache" } });
  const t = await js.text();
  const i = t.indexOf("مليون");
  const around = t.slice(Math.max(0, i - 120), i + 30);
  return { ok: /toFixed\(2\)/.test(around), asset };
}

let last = "";
while (Date.now() < deadline) {
  const s = await check();
  const line = `${new Date().toLocaleTimeString("en-GB")}  ${s.asset || s.note}  ->  ${s.ok ? "الجديدة اتنشرت" : "القديمة"}`;
  if (line.slice(9) !== last) console.log(line);
  last = line.slice(9);
  if (s.ok) { console.log("\n>>> اتأكد إن الموقع بيقدّم السعرExact"); break; }
  await new Promise((r) => setTimeout(r, 20000));
}
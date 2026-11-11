/**
 * run-wm-migrate.mjs — سائق ميجريشن الووترمارك القديمة
 * بيضغط CIs على /api/send-ad (action=watermark-migrate) حتى يكتمل النطاقات.
 *
 * الاستخدام:
 *   npm run wm-migrate            # production، chunk افتراضي 5
 *   npm run wm-migrate -- --chunk 10
 *   npm run wm-migrate -- --url http://localhost:3000/api/send-ad
 */
const args = process.argv.slice(2);
const val = (f) => { const i = args.findIndex((a) => a === f); return i >= 0 ? args[i + 1] : undefined; };
const URL = val('--url') || 'https://carmasr-app.vercel.app/api/send-ad';
const CHUNK = Number(val('--chunk') || 5);
const MAX_LOOPS = Number(val('--maxLoops') || 5000);
const STOP_AT_SECS = Number(val('--seconds') || 0) * 1000;

const started = Date.now();
let processed = 0, upgraded = 0, loops = 0;
const FORCE = args.includes('--force');
if (args.includes('--restart')) {
  const r0 = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'watermark-migrate', reset: true, force: FORCE }) });
  if (!r0.ok) throw new Error(`reset → HTTP ${r0.status}`);
  console.log(`(أُعيد ضبط المؤشر${FORCE ? ' — وضع force (إعادة ختم الجميع' : ''})`);
}
while (true) {
  loops++;
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'watermark-migrate', chunk: CHUNK, force: FORCE }),
  });
  if (!res.ok) throw new Error(`${URL} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  processed = data.processed || processed;
  upgraded = data.upgraded ?? upgraded;
  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`  #${loops} | processed=${processed} | upgraded=${upgraded} | done=${data.done || false} | ${secs}s`);
  if (data.done) break;
  if (!data.success) throw new Error(`migration error: ${JSON.stringify(data).slice(0, 300)}`);
  if (loops >= MAX_LOOPS) { console.log(`  (وقف توقف عند --maxLoops=${MAX_LOOPS} — أعد التشغيل للمتابعة)`); break; }
  if (STOP_AT_SECS && Date.now() - started >= STOP_AT_SECS) { console.log(`  (توقف حسب --seconds — أعد التشغيل للمتابعة)`); break; }
}
console.log(`\n✅ اكتمل ميجريشن الووترمارك — ${processed} إعلان تفحص، ${upgraded} اتحدث في ${Math.round((Date.now() - started) / 1000)}s`);
import admin from 'firebase-admin';
import { getDb } from './db.js';
import { safeFetch } from './ssrf.js';

/**
 * جلب + تحليل رابط (فيسبوك/واتساب/عام) — استخراج العنوان والصور والوصف
 * استراتيجية احترافية: تجربة عدة User-Agents وطرق استخراج أوامر Meta وJSON-LD ثم img خام.
 */
const SCRAPE_UAS = [
  'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
];

function absolutize(base, u) {
  try { return new URL(u, base).href; } catch { return u; }
}

// عنوان فيسبوك غالبًا اسم جروب/سوق/صفحة وليس محتوى الإعلان — نكتشفه ونستبدله
const GROUP_WORDS = /(?:^|[\s|،,])(?:سوق|جروب|مجموع(?:ة|ه)|بيدج|صفح(?:ة|ه)|معرض|لتجارة|للتجارة|أ?كبر|جميع\s+أنواع|للبيع\s+والشراء|بيع\s+و\s*شرا|market|group|souq|fans?|دليل|إعلانات\s+مبوبة)(?:[\s|،,]|$)/i;
function stripTatweel(s) {
  return String(s || '').replace(/[\u0640\u064B-\u065F]/g, '');
}
// فيسبوك أحيانًا يرجّع صفحة الدخول بترميز HTML entities (&#x...) فما ينفعش نفحص النص الخام
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ' '; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ' '; } });
}
const LOGIN_WALL_RE = /استكشف الأشياء التي تحبها|تسجيل الدخول إلى فيسبوك|إنشاء حساب جديد|هل نسيت كلمة السر|Email or mobile number|Log into Facebook|Create new account|Forgot password|Our Systems Have Detected Unusual Traffic|login_required/i;
function looksLikeLoginWall(text) {
  return LOGIN_WALL_RE.test(decodeEntities(text));
}
function looksLikeGroupName(s) {
  // شيل الإيموجي/الرموز قبل الفحص حتى تُلتقط الكلمات الملزوقة بإيموجي مثل "🌹سوق..."
  const norm = stripTatweel(s).replace(/[^\u0600-\u06FF\s]/g, ' ');
  return GROUP_WORDS.test(norm);
}
function cleanScrapedTitle(title, description) {
  let t = stripTatweel(title).replace(/\s*\|\s*Facebook\s*$/i, '').trim();
  if (/^(?:facebook|فيسبوك|فيس بوك)$/i.test(t)) t = '';
  // og:title غالبًا "اسم الجروب | نص البوست" — نخلي الجزء الأكثر دلالة على الإعلان
  if (t.includes('|')) {
    const parts = t.split('|').map((x) => x.trim()).filter(Boolean).filter((p) => !/^(?:facebook|فيسبوك|فيس بوك)$/i.test(p));
    const adParts = parts.filter((p) => !looksLikeGroupName(p) && p.length >= 4);
    if (adParts.length) t = adParts[adParts.length - 1];
  }
  // لو لسه اسم جروب/سوق عام — خُذ أول سطر ذي معنى من نص البوست
  if (!t || looksLikeGroupName(t)) {
    const line = String(description || '')
      .split(/\r?\n/).map((s) => stripTatweel(s).replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, ' ').trim())
      .find((s) => s.length >= 5 && !looksLikeGroupName(s));
    if (line) t = line;
  }
  return stripTatweel(t).replace(/\s+/g, ' ').trim();
}

export async function scrapeLinkPreview(url) {
  const result = { ok: false, title: '', images: [], description: '', phone: '', brand: '', model: '', year: '', author: '', error: '' };
  const dbg = { htmlLen: 0, blocked: false, finalUrl: '', pluginLen: 0, hasStoryIds: false };

  let html = '';
  let finalUrl = url;
  const fbHtmlPool = [html];
  for (const ua of SCRAPE_UAS) {
    try {
      const r = await safeFetch(url, {
        headers: { 'User-Agent': ua, 'Accept-Language': 'ar,en;q=0.9', Accept: 'text/html,application/xhtml+xml,image/webp,*/*;q=0.8' },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      if (r.url) finalUrl = r.url;
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || '';
      const cs = (ct.match(/charset=["']?([\w.-]+)/i) || [])[1] || '';
      let text = buf.toString('utf-8');
      if (cs && cs.toLowerCase() !== 'utf-8' && cs.toLowerCase() !== 'utf8') {
        try { text = new TextDecoder(cs).decode(buf); } catch { text = buf.toString('utf-8'); }
      } else if (/\uFFFD/.test(text)) {
        try {
          const alt = new TextDecoder('windows-1256').decode(buf);
          if ((alt.match(/\uFFFD/g) || []).length < (text.match(/\uFFFD/g) || []).length) text = alt;
        } catch {}
      }
      const loginUrl = /\/login\//i.test(r.url || '');
      const blocked = loginUrl || looksLikeLoginWall(text);
      if (text && text.length > 200 && !blocked) {
        html = text;
        finalUrl = r.url || url;
        break;
      }
    } catch { /* جرّب الـ UA التالي */ }
  }
  // استعادة اللينك الكانونيكي لو فيسبوك حوّلنا لصفحة دخول: حقيقته مدفونة في next=
  if (/\/login\/\??/i.test(finalUrl)) {
    const loginNext = finalUrl.match(/[?&]next=([^&]+)/);
    if (loginNext && loginNext[1]) {
      try {
        const decoded = decodeURIComponent(loginNext[1]);
        if (/^https?:\/\/[^/]*facebook\.com/i.test(decoded) && !/\/login\//i.test(decoded)) finalUrl = decoded;
      } catch {}
    }
  }
  // المحاولة الأخيرة المباشرة: اللمرنتج الكانونيكالي نفسه بـ Googlebot — فاغلب الأوقات بيعدي (الحاجز احتمالي)
  if (!html && /facebook\.com\/share\/p\//i.test(url) && finalUrl && finalUrl !== url) {
    try {
      const r2 = await safeFetch(finalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept-Language': 'ar,en;q=0.9' },
        signal: AbortSignal.timeout(20000),
      });
      if (r2.ok) {
        const buf2 = Buffer.from(await r2.arrayBuffer());
        let tx = buf2.toString('utf-8');
        if (/\uFFFD/.test(tx)) { try { tx = new TextDecoder('windows-1256').decode(buf2); } catch {} }
        if (/Our Systems Have Detected Unusual Traffic|login_required|Log into Facebook|Log in to Facebook/i.test(tx)) { /* لسه محجوب */ }
        else if (tx.length > 300) { html = tx; dbg.canonicalHit = true; }
      }
    } catch { /* تجاهل */ }
  }
  if (!html) {
    result.error = 'محظور أو لا يوجد محتوى';
    dbg.blocked = true;
    // لا نرجع مبكرًا لروابط فيسبوك — الجدار قد يمنع الصفحة لكن أداة التضمين العامة تظل متاحة
    if (!/facebook\.com|fb\.com|fb\.watch/i.test(url)) return result;
  } else {
    dbg.htmlLen = html.length;
  }
  dbg.finalUrl = finalUrl;

  const decode = (s) => (s || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
  const pick = (patterns) => {
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) return decode(m[1]);
    }
    return '';
  };

  result.title = pick([
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
  ]);
  result.description = pick([
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]);
  // كابشن/المقال الأولي كنص (لو الوصف الفوقي قصير جداً)
  if (!result.description) {
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = (body.match(/[^.!?]{60,260}[.!?]/g) || []).filter(s => !/cookie|privacy|login|دخول|خصوصية|register|facebook\.com|instagram\.com/i.test(s));
    if (sentences.length) result.description = sentences.slice(0, 8).join(' ').trim().slice(0, 2000);
    else if (body.length > 40) result.description = body.slice(0, 2000).trim();
  }

  // جمع الصور: og:image + og:image:url + og:image:secure_url + twitter:image + link image_src + JSON-LD + img خام
  const images = [];
  const addImage = (u) => {
    if (!u || images.length >= 8) return;
    const abs = absolutize(finalUrl, decode(u)).replace(/\s+/g, '');
    if (!/^https?:\/\//i.test(abs)) return;
    if (/\.(svg|ico)|emoji|data:image|hsts-pixel|1px|pixel|\/rsrc\.php\/|s50x50|t39\.[\w.-]+-1\//i.test(abs)) return;
    if (images.includes(abs)) return;
    images.push(abs);
  };
  const metas = html.match(/<meta[^>]+>|\<link[^>]+>/gi) || [];
  for (const m of metas) {
    const prop = (m.match(/(?:property|name)=["']([^"']+)["']/i) || [])[1];
    const content = (m.match(/content=["']([^"']+)["']/i) || [])[1] || (m.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!prop || !content) continue;
    const p = prop.toLowerCase();
    if (/^og:image(:url|:secure_url)?$/i.test(p) || /^twitter:image(:src)?$/i.test(p)) addImage(content);
  }
  if (!images.length) {
    const m1 = html.match(/<meta[^>]+rel=["']image_src["'][^>]+>/i);
    if (m1) { const href = (m1[0].match(/href=["']([^"']+)["']/i) || [])[1]; if (href) addImage(href); }
  }
  if (!images.length) {
    const ld = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const blk of ld) {
      const hits = blk.match(/(?:https?:\/\/)[^"'\s\\]+?(?:\.webp|\.jpg|\.jpeg|\.png)/gi) || [];
      for (const h of hits) addImage(h);
      const json = blk.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
      try {
        const parsed = JSON.parse(json);
        const collect = (o) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) return o.forEach(collect);
          if (typeof o.image === 'string') addImage(o.image);
          if (Array.isArray(o.image)) o.image.forEach(collect);
          Object.values(o).forEach(collect);
        };
        collect(parsed);
      } catch { /* تجاهل */ }
    }
  }
  if (!images.length) {
    const imgs = html.match(/<img[^>]+src=["'][^"']+["'][^>]*>/gi) || [];
    for (const im of imgs) {
      const src = (im.match(/src=["']([^"']+)["']/i) || [])[1];
      if (src && !/^data:/i.test(src)) {
        const w = (im.match(/width=["'](\d+)["']/i) || [])[1];
        if (!w || parseInt(w, 10) >= 200) addImage(src);
      }
      if (images.length >= 4) break;
    }
  }

  // ⚠️ فيسبوك غالباً حاجز تسجيل دخول للسكربتات (لا og:image) — الحل بالأدوات المفتوحة:
  // 1) plugins/post.php (بدون تسجيل: يعيد نص البوست + جدول الصور) ثم 2) m.facebook ثم 3) r.jina.ai
  if (/facebook\.com|fb\.com|fb\.watch|m\.facebook/i.test(url)) {
    // خزان HTML اللي نستخرج منه حساب صاحب البوست (author) بعد ما تتجمع المصادر
    fbHtmlPool.splice(0, fbHtmlPool.length, html);
    // ألبوم متعدد الصور: كل fbid في الصفحة = صورة في الألبوم → رابط lookaside لكل واحدة
    const addAlbumFrom = (src) => {
      if (!src || images.length >= 8) return;
      try {
        const setA = (src.match(/[?&](?:amp;)?set=a\.(\d+)/) || [])[1] || '';
        const profileId = (src.match(/[?&](?:amp;)?id=(\d{15,})/) || [])[1] || '';
        const fbidRe = /(?:[?&]|&amp;)fbid=(\d{15,})/g;
        let fm; const ids = [];
        while ((fm = fbidRe.exec(src)) && ids.length < 8) {
          if (!ids.includes(fm[1]) && fm[1] !== setA && fm[1] !== profileId) ids.push(fm[1]);
        }
        if (ids.length > 1) {
          const cleanTitle = result.title.replace(/ \| Facebook/i, '');
          if (cleanTitle.trim()) result.title = cleanTitle;
          if (!result.description) result.description = `منشور فيسبوك — ${ids.length} صور`;
          for (const fid of ids.slice(0, 8 - images.length)) {
            addImage(`https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=${fid}`);
          }
        }
      } catch { /* تجاهل الألبوم */ }
    };
    addAlbumFrom(html);

    try {
      const probeUrl = (finalUrl && finalUrl !== url) ? finalUrl : url;
      const hrefCandidates = [...new Set([probeUrl, url])];
      let phtml = '', pStatus = 0;
      for (const cand of hrefCandidates) {
        try {
          const pluginUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(cand)}&show_text=true&width=500`;
          const pr = await fetch(pluginUrl, {
            headers: { 'User-Agent': SCRAPE_UAS[2], 'Accept-Language': 'ar,en;q=0.9' },
            redirect: 'follow',
            signal: AbortSignal.timeout(25000),
          });
          if (!pr.ok) { pStatus = pr.status; continue; }
          const t = await pr.text();
          if (t.length < 1500) { pStatus = pr.status; continue; }
          phtml = t; pStatus = pr.status; break;
        } catch { /* جرّب href التالي */ }
      }
      dbg.pluginStatus = pStatus;
      if (phtml) {
        dbg.pluginLen = phtml.length;
        fbHtmlPool.push(phtml);
        const pMeta = phtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || phtml.match(/<meta[^>]+content=["']([^"']+)["'](?:[^>]+)?property=["']og:image["']/i);
        if (pMeta && pMeta[1]) addImage(pMeta[1]);
        const poster = phtml.match(/poster=["']([^"']+)["']/i);
        if (poster && poster[1]) addImage(poster[1].replace(/&amp;/g, '&'));
        const bg = phtml.match(/background(-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/i);
        if (bg && bg[2]) addImage(bg[2]);
        const pImgs = phtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
        for (const im of pImgs.slice(0, 40)) {
          const src = (im.match(/src=["']([^"']+)["']/i) || [])[1];
          if (src && /fbcdn\.net/i.test(src) && /\.(jpe?g|png|webp|gif)/i.test(src)) addImage(src);
          if (images.length >= 8) break;
        }
        // صورة الإمبدد scontent تحمل معرّفها الرقمي في المسار → lookaside يعطي النسخة كاملة الدقة
        const sIds = [...new Set((phtml.match(/scontent[\w.-]*\.fbcdn\.net\/v\/t[\w./-]+\/(\d{15,})_/gi) || []).map(s => (s.match(/(\d{15,})_/) || [])[1]))].filter(Boolean);
        for (const sid of sIds.slice(0, 8 - images.length)) {
          addImage(`https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=${sid}`);
        }
        // لو الإمبدد اتقدم بدون <img> صريح: امسح أي رابط fbcdn فالصفحة (يغطي data-src/srcset/attrs)
        if (!images.length) {
          const fbRaw = phtml.match(/https?:\/\/[^"'\s<>]+?\.fbcdn\.net[^"'\s<>]+?\.(?:jpe?g|png|webp|gif)/gi) || [];
          for (const s of fbRaw.slice(0, 30)) {
            if (/emoji|\/logos\/|fb_icon|\/rsrc\.php/i.test(s)) continue;
            addImage(s);
            if (images.length >= 8) break;
          }
        }
        {
          const pBody = phtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const pChunks = (pBody.match(/[^]{40,700}/g) || []).filter(s => /[\u0600-\u06FF]/.test(s) && !/تسجيل الدخول|log in|cookie|privacy/i.test(s));
          if (pChunks.length) {
            const pluginDesc = decode(pChunks.slice(0, 8).join(' ').trim()).slice(0, 2000);
            if (pluginDesc.length > (result.description || '').length) result.description = pluginDesc;
          }
        }
      }
    } catch { /* تجاهل plugins */ }

    // تجاوز: منشور فيديو — ثمرة الفيديو من أداة التضمين الرسمية
    if (!images.length) {
      try {
        const probeUrlV = (finalUrl && finalUrl !== url) ? finalUrl : url;
        const vurl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(probeUrlV)}&show_text=false&width=560`;
        const vr = await fetch(vurl, {
          headers: { 'User-Agent': SCRAPE_UAS[2], 'Accept-Language': 'ar,en;q=0.9' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (vr.ok) {
          const vh = await vr.text();
          const vm = vh.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || vh.match(/<meta[^>]+content=["']([^"']+)["'](?:[^>]+)?property=["']og:image["']/i);
          if (vm && vm[1]) addImage(vm[1]);
        }
      } catch { /* تجاهل video.php */ }
    }
    try {
      const probeUrl = (finalUrl && finalUrl !== url) ? finalUrl : url;
      const mobileUrl = probeUrl.replace(/https?:\/\/(?:www\.|web\.|m\.)?facebook\.com/i, 'https://m.facebook.com');
      if (mobileUrl !== probeUrl && !images.length) {
        const mf = await fetch(mobileUrl, {
          headers: { 'User-Agent': SCRAPE_UAS[3], 'Accept-Language': 'ar,en;q=0.9' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (mf.ok) {
          const mhtml = await mf.text();
          fbHtmlPool.push(mhtml);
          const mImgs = mhtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || mhtml.match(/<meta[^>]+content=["']([^"']+)["'](?:[^>]+)?property=["']og:image["']/i);
          if (mImgs && mImgs[1]) addImage(mImgs[1]);
          if (!images.length) {
            const raws = mhtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
            for (const im of raws.slice(0, 20)) {
              const src = (im.match(/src=["']([^"']+)["']/i) || [])[1];
              if (src && !/^data:|\/images\/emoji/i.test(src)) addImage(src);
              if (images.length >= 4) break;
            }
          }
          if (!result.title) {
            const t = mhtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (t && t[1]) result.title = decode(t[1]);
          }
        }
      }
    } catch { /* تجاهل */ }

    // الخطوة الأخيرة: القارئ r.jina.ai — يفتح الصفحة فعلياً ويستخرج النص والصور (يعمل كمان للألبومات اللي أول صورة بس وصلت)
    if (images.length < 3) {
      try {
        const probeUrl = (finalUrl && finalUrl !== url) ? finalUrl : url;
        const rd = await fetch(`https://r.jina.ai/${probeUrl}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'text/markdown,text/*' },
          redirect: 'follow',
          signal: AbortSignal.timeout(25000),
        });
        if (rd.ok) {
          const md = await rd.text();
          dbg.jinaLen = md.length;
          const jinaWall = looksLikeLoginWall(md);
          const mdImgs = md.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g) || [];
          for (const thing of mdImgs.slice(0, 8)) {
            const u = (thing.match(/\((https?:\/\/[^)\s]+)\)/) || [])[1];
            if (u && /\.(jpe?g|png|webp|gif)/i.test(u)) addImage(u);
          }
          const urls = md.match(/https?:\/\/[^\s"'()<>]+/g) || [];
          for (const u of urls) {
            if (/\.(jpe?g|png|webp|gif)/i.test(u)) addImage(u);
            if (images.length >= 8) break;
          }
          dbg.jinaImgs = images.length;
          if (!jinaWall) {
            const mdText = md
              .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
              .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
              .replace(/^[#>!]+\s*/gm, '')
              .replace(/\s+/g, ' ').trim();
            if (/[\u0600-\u06FF]/.test(mdText) && mdText.length > (result.description || '').length) {
              result.description = mdText.slice(0, 2000);
            }
            if (!result.title) {
              const head = md.split('\n').find(l => l.trim() && !/^[#>!]/.test(l.trim()));
              if (head && head.trim().length >= 3) result.title = head.trim().slice(0, 200);
            }
          }
        }
      } catch { /* تجاهل */ }
    }
  }
  result.images = images;

  // حساب صاحب البوست — نرجع يشبه "https://www.facebook.com/<account>" عشان ماسنجر يشتغل مباشرة
  const authorFrom = (h) => {
    if (!h) return '';
    const actor = h.match(/<a[^>]+class=["'][^"']*actor[^"']*["'][^>]*href=["']([^"']+)["']/i);
    if (actor && actor[1]) return actor[1].replace(/&amp;/g, '&');
    const pid = h.match(/["']?profile_id["']?\s*[:=]\s*["']?(\d{6,})/i);
    if (pid && pid[1]) return `https://www.facebook.com/profile.php?id=${pid[1]}`;
    const plain = h.match(/<a[^>]+href=["'](https:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9._-]+)["']/i);
    if (plain && plain[1] && !/(?:posts|photos|story\.php|permalink\.php|profile\.php\?|groups|\/share\/)/i.test(plain[1])) return plain[1].replace(/&amp;/g, '&');
    return '';
  };
  for (const h of fbHtmlPool) {
    if (result.author) break;
    const a = authorFrom(h);
    if (/^https?:\/\/\S+/i.test(a)) result.author = a;
    else result.author = '';
  }

  // عنوان عام بلا معنى أو اسم جروب/سوق من فيسبوك — استبدله بعنوان يوصف الإعلان
  result.title = cleanScrapedTitle(result.title, result.description);

  // لو اللي رجع في الحقيقة صفحة تسجيل دخول (حتى لو مشفّرة) — امسحه بدل ما يتخزن كنص إعلان
  if (looksLikeLoginWall(result.description)) result.description = '';
  if (looksLikeLoginWall(result.title)) result.title = '';

  result.phone = pick([
    /\+2?(0?1[0125]\d{8})\b/,
    /(?:\b01[0125]\d{8}\b)/,
    /(?:0?1[0125]\d{8})/,
  ]);
  result.ok = !!(result.title || result.images.length);
  result._dbg = dbg;
  return result;
}

export function isLink(text) {
  return /(?:https?:\/\/)[^\s]+|facebook\.com|fb\.com|fb\.watch|wa\.me|whatsapp\.com|[0-9]/.test(String(text || ''));
}

/** تنظيف النصوص من الرموز التالفة (�) وعلامات التحكم/الصفرية العرض — قبل تخزينها أو عرضها */
export function cleanStr(v) {
  return String(v || '')
    .replace(/[\uFFFD\u0000-\u001F\u007F\u200B-\u200F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * تنظيف رسائل المحادثات (واتساب/ماسنجر/نسخ لأي برنامج): يشيل أي حرف 4-بايت (كل الإيموجي خارج BMP)
 * ورموز variation selectors والتعريب الأصفري — لأن بوابات wa.me / m.me / messenger.com على أجهزة كتير
 * بتحوّلها لـ � فتبان الرسالة سبام/مجهولة. بيحافظ على الأسطر (\n) والحروف العربية.
 */
export function cleanMsg(v) {
  return String(v || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF\u200D]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/\uFE0F/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * رسالة "عملنا لك إعلان مجاني" — جاهزة للصق في واتساب/ماسنجر
 */
export function freeAdMessage(listingUrl) {
  return cleanMsg(`أهلاً 👋 عميل كار مصر CarMasr 🚛\n\nخبر حلو: عملنالك إعلان مجاني عن سيارتك على موقع كار مصر — أكبر سوق للنقل الثقيل في مصر!\n\n🔗 شوف إعلانك:\n${listingUrl}\n\nنشكرك لثقتك فينا 🙏\nفريق CarMasr`);
}

/**
 * رسالة أدمن للمعلن بعد الموافقة على إعلانه — نص العرض + رابط الإعلان + تحميل المنصة.
 */
export function contactAdvertiserMessage(listing, listingUrlFinal) {
  const title = cleanStr(listing.title) || 'إعلانك';
  const priceNum = Number(listing.price);
  const price = Number.isFinite(priceNum) && priceNum !== 0
    ? priceNum.toLocaleString('ar-EG') + ' جنيه'
    : 'اتصل بنا لمعرفة السعر';
  const details = [
    `🚛 ${title}`,
    listing.brand ? `${listing.model ? cleanStr(listing.model) + ' ' : ''}${cleanStr(listing.brand)}` : '',
    listing.year ? `${cleanStr(listing.year)}` : '',
    `📍 ${cleanStr(listing.governorate) || 'مصر'}`,
    `💰 ${price}`,
  ].filter(Boolean).join(' • ');
  const downloadUrl = appDownloadUrl();
  const who = cleanStr(advertiserName(listing)) || 'صاحب الإعلان';

  return cleanMsg(`أهلاً ${who} 👋 — معاك توفيق، مؤسس منصة CarMasr 🚛
أكبر سوق للنقل الثقيل في مصر.

يشرفنا تسجيل حضرتك على منصة كار مصر 🤝

🎉 إعلانك اتنشر مجانًا على سوق كار مصر، وكمان تم تمييزه مجانًا ليظهر بشكل أفضل للمهتمين بالنقل الثقيل.

📄 ${details}

👀 شوف إعلانك المميز من هنا:
${listingUrlFinal}

📲 نزّل تطبيق كار مصر:
${downloadUrl}

أي حاجة محتاجها، إحنا في الخدمة 🤝
فريق CarMasr
`);
}

/**
 * رابط واتساب جاهز برسالة مكتوبة.
 * ملاحظة: يُستخدم api.whatsapp.com مباشرة بدل wa.me —
 * wa.me يفسد أي رمز 4-بايت (emojis) عند تحويله لـ api.whatsapp.com ويستبدله بـ �.
 */
export function whatsappLink(phone, message) {
  let n = String(phone || '').replace(/[^\d]/g, '');
  if (!n) return null;
  if (n.startsWith('00')) n = n.slice(2);               // 0010… → 10…
  if (n.startsWith('0')) n = '20' + n.slice(1);         // 01012345678 → 201012345678
  else if (!n.startsWith('20')) n = '20' + n;           // 1012345678 → 201012345678
  return `https://api.whatsapp.com/send/?phone=${n}&text=${encodeURIComponent(cleanMsg(message))}&type=phone_number&app_absent=0`;
}

/**
 * رابط ماسنجر مفتوح برسالة جاهزة — يحتاج معرف الصفحة (Page ID / username)
 * فيسبوك لا يسمح بإرسال رسالة فعلياً لمستخدم لم يبدأ المحادثة أولاً،
 * فالرابط المشروح يفتح محادثة يبدأها المعلن بنفسه.
 */
export function messengerLink(pageId, message) {
  const id = String(pageId || '').trim();
  if (!id) return null;
  return `https://m.me/${encodeURIComponent(id)}?text=${encodeURIComponent(cleanMsg(message))}`;
}

/** تحويل اسم مستخدم فيسبوك إلى اسم عرض أنيق (tawfiek.fayez → Tawfiek Fayez) */
export function prettyFbName(id) {
  const s = String(id || '').trim();
  if (!/[a-zA-Z]/.test(s)) return s;
  return s
    .replace(/[._\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const FB_NON_ACCOUNT_SEG = new Set(['profile.php', 'share', 'sharer', 'groups', 'photo', 'photos', 'reel', 'reels', 'watch', 'events', 'stories', 'people', 'menus', 'pages', 'messages', 'permalink.php', 'php', 'search', 'me', 'home', 'marketplace', 'watchparty', 'checkpoint', 'login.php', 'signup']);

/**
 * استخراج حساب المعلن من رابط فيسبوك/ماسنجر.
 * يرجع { id, name } حيث id = اسم المستخدم أو الرقم، أو null لو الرابط لا يحمل حسابًا (مشاركة/بوست/جروب).
 */
export function facebookAccount(facebook) {
  const url = String(facebook || '').trim();
  if (!url) return null;
  let m;
  if ((m = url.match(/facebook\.com\/profile\.php\?id=(\d+)/i))) {
    return { id: m[1], name: '' };
  }
  if ((m = url.match(/facebook\.com\/people\/[^\/]+\/(\d+)/i))) {
    const seg = decodeURIComponent((url.match(/facebook\.com\/people\/([^\/]+)\//i) || [])[1] || '');
    return { id: m[1], name: seg.replace(/[._\-]/g, ' ').trim() };
  }
  // منشورات (story/permalink) بيحملوا معرّف صاحب البوست في id= → نستخدمه هدف ماسنجر
  if ((m = url.match(/(?:story|permalink)\.php[^'"?\s]*[?&]id=(\d{6,})/i))) {
    return { id: m[1], name: '' };
  }
  // صورة/ألبوم: set=a.<owner> = معرّف الحساب صاحب الألبوم
  if ((m = url.match(/[?&]set=a\.(\d{6,})/i))) {
    return { id: m[1], name: '' };
  }
  if ((m = url.match(/(?:facebook\.com|m\.facebook\.com|fb\.com)\/([A-Za-z0-9._-]+)(?:\/|\?|$)/i))) {
    const seg = m[1];
    if (!FB_NON_ACCOUNT_SEG.has(seg.toLowerCase())) {
      return { id: seg, name: prettyFbName(seg) };
    }
  }
  if ((m = url.match(/(?:m\.me|messenger\.com\/t)\/([\w.-]+)/i))) {
    return { id: m[1], name: prettyFbName(m[1]) };
  }
  return null;
}

/** اسم المعلن (المخزن أو المستخرج من لينك الفيس بوك) — للترحيب به في الرسالة */
export function advertiserName(listing) {
  if (listing && listing.advertiserName && String(listing.advertiserName).trim()) return String(listing.advertiserName).trim();
  const acc = facebookAccount(listing && listing.facebook);
  if (acc && acc.name) return acc.name;
  if (acc && acc.id) return prettyFbName(acc.id);
  return '';
}

/**
 * رابط إنبوكس صفحة البزنس مانيجر — ماسنجر الصفحة نفسها.
 * مع المعرف الرقمي للمعلن يفتح محادثته مباشرة، وبدونه يفتح الإنبوكس.
 * يتطلب asset_id (الصفحة) و business_id من إعدادات البزنس مانيجر، ويمكن تجاوزهما من env.
 */
export function businessInboxUrl(advertiserId) {
  const asset = String(process.env.MESSENGER_ASSET_ID || '1259908743863176').trim();
  const biz = String(process.env.MESSENGER_BUSINESS_ID || '1259916907195693').trim();
  if (!asset || !biz) return null;
  const adv = /^\d{6,}$/.test(String(advertiserId || '').trim()) ? String(advertiserId).trim() : '';
  const base = `https://business.facebook.com/latest/inbox/messenger?asset_id=${asset}&business_id=${biz}&ir_qe_exposed=1&mailbox_id=${asset}`;
  return adv ? `${base}&selected_item_id=${adv}&thread_type=FB_MESSAGE` : base;
}

/**
 * زر الماسنجر: بيفتح محادثة المعلن بحساب المالك الشخصي (باسم الأكونت، مش باسم الصفحة) برسالة جاهزة.
 * يُستخدم facebook.com/messages/t (مش messenger.com ولا m.me) لأنه الوحيد اللي بيحافظ على
 * رموز الـ emojis في معامل text كما هي (اتأكدنا بالبايتات: messenger.com/m.me بيحولوها إلى �).
 * لو ضبطت env MESSENGER_MODE=business يفتح إنبوكس الصفحة (البزنس مانيجر) بدلًا من ذلك.
 */
export function advertiserMessengerLink(facebook, fallback, message) {
  const inboxMode = String(process.env.MESSENGER_MODE || 'personal');
  const acc = facebookAccount(facebook);
  const target = (acc && acc.id) || '';
  if (inboxMode === 'business') {
    const inbox = businessInboxUrl(target);
    if (inbox) return inbox;
  }
  const t = target || String(fallback || '').trim();
  if (!t) return null;
  const txt = message ? encodeURIComponent(cleanMsg(message)) : '';
  return `https://www.facebook.com/messages/t/${encodeURIComponent(t)}${txt ? '?text=' + txt : ''}`;
}

const ARABIC_TO_LATIN = {
  'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'أ': 'a', 'إ': 'i', 'آ': 'a', 'ة': 'a', 'ى': 'a', 'ء': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function slugify(title) {
  let slug = String(title || '').toLowerCase().trim();
  slug = slug.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-z0-9\s-]/g, '');
  slug = slug.replace(/\s+/g, '-').replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');
  return slug || 'listing';
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://carmasr-app.vercel.app';

export function listingUrl(slug, id) {
  return `${SITE_URL}/listing/${id}${slug ? '/' + slug : ''}`;
}

/** رابط صفحة تحميل تطبيق كار مصر — بلاي ستور يوم ما يتوفر (PLAY_STORE_URL), غير كده الصفحة الرسمية */
export function appDownloadUrl() {
  return process.env.PLAY_STORE_URL || `${SITE_URL}/download/`;
}

/** اسم مستخدم صفحة كار مصر على فيسبوك (يعمل كـ slug للنشر والبريد) */
export function facebookPageUsername() {
  return String(process.env.MESSENGER_PAGE_ID || process.env.FB_PAGE_ID || '').trim() || 'TareeqEG';
}

/** رابط صفحة كار مصر على فيسبوك */
export const FACEBOOK_PAGE_URL = `https://www.facebook.com/${facebookPageUsername()}`;

/** اسم مستخدم الحساب الشخصي المباشر — منه بيتنشر بدل الصفحة */
export function facebookProfileUsername() {
  return String(process.env.FB_PROFILE_USERNAME || '').trim() || 'mashroey.bns';
}

/** رابط الحساب الشخصي المباشر */
export const FACEBOOK_PROFILE_URL = `https://www.facebook.com/${facebookProfileUsername()}`;

/**
 * توكن الحساب الشخصي (user token من Graph Explorer) — بيدي أولوية النشر:
 * الحساب الشخصي هو اللي عضو في الجروبات، والصفحات كتير مرفوضة فيها.
 */
export function fbUserToken() {
  return String(process.env.FB_USER_ACCESS_TOKEN || '').trim();
}

/**
 * إنشاء إعلان جديد (status: pending) عبر admin SDK — بيgتف الـ rules لأن الصفحة محمية للتسجيل
 */
export async function createListingFromPayload(payload, opts = {}) {
  const db = getDb();
  const title = String(payload.title || '').trim();
  if (!title) throw new Error('اسم الإعلان مطلوب');

  const numberOr = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const data = {
    title: cleanStr(payload.title),
    slug: slugify(payload.title),
    description: cleanStr(payload.description),
    price: numberOr(payload.price),
    listingType: payload.listingType === 'rent' ? 'rent' : (payload.listingType === 'sell' ? 'sell' : 'sell'),
    category: cleanStr(payload.category || 'vehicles'),
    subcategory: cleanStr(payload.subcategory),
    governorate: cleanStr(payload.governorate),
    location: cleanStr(payload.location),
    images: Array.isArray(payload.images) ? payload.images.filter(Boolean).slice(0, 15) : [],
    userId: String(payload.userId || ''),
    userName: cleanStr(payload.userName) || 'زائر',
    userPhone: cleanStr(payload.userPhone),
    contactPhone: cleanStr(payload.contactPhone || payload.userPhone),
    userType: String(payload.userType || 'individual'),
    verified: false,
    status: opts.status || 'pending',
    featured: false,
    source: payload.source || 'send-ad',
    createdAt: new Date(),
  };
  if (payload.condition) data.condition = String(payload.condition);
  if (payload.brand) data.brand = String(payload.brand);
  if (payload.model) data.model = String(payload.model);
  if (payload.year) data.year = numberOr(payload.year, undefined);
  if (payload.facebook) data.facebook = String(payload.facebook);
  if (payload.advertiserName) data.advertiserName = cleanStr(payload.advertiserName).slice(0, 60);
  if (numberOr(payload.price) === 0) data.priceNote = 'السعر عند المعاينة';

  const ref = await db.collection('listings').add(data);
  return { id: ref.id, ...data, url: listingUrl(data.slug, ref.id), createdAt: data.createdAt.toISOString() };
}

/**
 * إشعار الأدمن: FCM push + إشعار داخل التطبيق + واتساب (CallMeBot إن وُجد)
 */
export async function notifyAdminsOfNewListing(listing) {
  const db = getDb();
  const out = { pushSent: 0, notified: 0, waConfigured: false, waSent: false, waError: null, pushErrors: [] };

  const title = listing.title || '';
  const who = listing.userName || '-';
  const price = Number(listing.price) ? `${listing.price} جنيه` : 'سعر حسب التفاوض';
  const waText = cleanMsg(`📢 إعلان جديد على كار مصر\n👤 ${who}\n📞 ${listing.contactPhone || listing.userPhone || '-'}\n📋 ${listing.governorate} • ${listing.category}\n💰 ${price}\n🔗 ${listing.url}`);

  // 1) FCM + إشعار داخل التطبيق للأدمن
  try {
    const adminSnap = await db.collection('users').where('type', '==', 'admin').get();
    const seenTokens = new Set();
    for (const doc of adminSnap.docs) {
      const uid = doc.id;
      const tokens = await db.collection('deviceTokens').where('userId', '==', uid).get();
      for (const t of tokens.docs) {
        const token = t.data().token;
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);
        try {
          await admin.messaging().send({
            token,
            notification: { title: '📢 إعلان جديد على كار مصر', body: `${who} • ${title}` },
            android: { priority: 'high', notification: { title: '📢 إعلان جديد على كار مصر', body: `${who} • ${title}`, icon: 'ic_stat_icon', color: '#FF8A1A' } },
            data: { title: '📢 إعلان جديد على كار مصر', body: `${who} • ${title}`, url: `/listing/${listing.id}` },
          });
          out.pushSent += 1;
        } catch (e) { out.pushErrors.push(String((e && e.message) || e)); }
      }
      await db.collection('notifications').add({
        userId: uid, type: 'system', title: '📢 إعلان جديد',
        body: `${who} • ${title}`, read: false, listingId: listing.id, url: `/listing/${listing.id}`,
        createdAt: new Date(),
      }).catch(() => {});
      out.notified += 1;
    }
  } catch (e) { out.pushErrors.push('loop: ' + String((e && e.message) || e)); }

  // 2) واتساب CallMeBot (لو المفتاح موجود)
  const callmeKey = process.env.WHATSAPP_CALLMEBOT_KEY;
  const to = process.env.WHATSAPP_TO || '201018870145';
  if (callmeKey) {
    out.waConfigured = true;
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}&text=${encodeURIComponent(waText)}&apikey=${encodeURIComponent(callmeKey)}`;
      const r = await fetch(url, { method: 'GET' });
      const text = (await r.text()).trim() || '';
      out.waSent = /Message Sent|sent/i.test(text);
      if (!out.waSent) out.waError = text.slice(0, 200) || `HTTP ${r.status}`;
    } catch (e) { out.waError = String((e && e.message) || e); }
  }

  return out;
}

/* ══════════════════════════════════════════════════════
   النشر الأوتوماتيك على صفحة فيسبوك (بوست احترافي بالإعلان)
   ══════════════════════════════════════════════════════ */

/** توكن صفحة فيسبوك للنشر — من env (يدعم اسمين للتوافق) */
export function facebookPageToken() {
  return String(process.env.FB_PAGE_ACCESS_TOKEN || process.env.MESSENGER_PAGE_ACCESS_TOKEN || '').trim();
}

const FB_CONN_DOC = 'settings/fbConn';

/** توكن الصفحة المرتبط يدويًا من الموقع (أفضلية) — نتنزل من Firestore، مع fallback للـ env */
export async function effectiveFbToken(db) {
  try {
    const conn = await getFbConnection(db);
    const t = conn && conn.accessToken ? String(conn.accessToken).trim() : '';
    if (t && !/^#/.test(t)) {
      return t;
    }
  } catch (e) {
    console.error('[effectiveFbToken] error:', String(e?.message || e));
  }
  const envTok = facebookPageToken();
  return envTok;
}

/** حالة الربط الحالية بفيسبوك (البيانات المحفوظة من زرار «ربط فيسبوك» في اللوحة) */
export async function getFbConnection(db) {
  try {
    const snap = await db.doc(FB_CONN_DOC).get();
    if (!snap.exists) {
      return null;
    }
    const d = snap.data() || {};
    const tok = String(d.accessToken || '').trim();
    return {
      accessToken: tok,
      fbPageId: String(d.fbPageId || ''),
      fbPageName: String(d.fbPageName || ''),
      tokenType: String(d.tokenType || ''),
      connectedAt: d.connectedAt || null,
    };
  } catch (e) {
    console.error('[fbConn] Firestore read error:', String(e?.message || e));
    return null;
  }
}

/**
 * تشخيص سريع لحالة النشر: التوكن منين، شغال فعلًا، والصفحة واخدة إيه، والجروبات عددها.
 * أخطاء فيسبوك بترجع كما هي عشان تعرف السبب بالظبط.
 */
export async function diagnoseFacebook(db) {
  const GRAPH = 'v26.0';
  const call = async (path) => {
    try {
      const r = await fetch(`https://graph.facebook.com/${GRAPH}/${path}`);
      return await r.json();
    } catch (e) {
      return { error: { message: 'فشل الاتصال بفيسبوك: ' + String((e && e.message) || e) } };
    }
  };
  const norm = (j) => {
    if (!j) return { ok: false, error: 'رد فارغ' };
    if (j.error) return { ok: false, error: String(j.error.message || j.error.type || 'خطأ غير معروف'), code: j.error.code || null };
    return { ok: true, id: j.id || null, name: j.name || null };
  };

  const conn = await getFbConnection(db);
  const storedTok = conn && conn.accessToken && !/^#/.test(conn.accessToken) ? String(conn.accessToken).trim() : '';
  const envTok = facebookPageToken();
  const token = storedTok || envTok;
  const pageUsername = facebookPageUsername();

  const out = {
    graph: GRAPH,
    tokenSource: storedTok ? 'stored' : (envTok ? 'env' : null),
    tokenLength: token ? token.length : 0,
    pageUsername,
    tokenCheck: token ? norm(await call(`me?fields=id,name&access_token=${encodeURIComponent(token)}`)) : { ok: false, error: 'مفيش توكن صفحة خالص — لا محفوظ ولا في Vercel' },
    pageCheck: token && pageUsername
      ? norm(await call(`${encodeURIComponent(pageUsername)}?fields=id,name&access_token=${encodeURIComponent(token)}`))
      : null,
    userToken: fbUserToken() ? 'موجود (FB_USER_ACCESS_TOKEN)' : 'غير موجود',
  };

  try {
    const groups = (await loadFbGroups(db)) || [];
    const nowMs = Date.now();
    const stamp = (g) => { const t = Date.parse(String(g.lastPostedAt || '')); return Number.isFinite(t) ? t : 0; };
    out.groups = {
      total: groups.length,
      enabled: groups.filter(g => g.enabled !== false).length,
      cooling: groups.filter(g => stamp(g) > 0 && nowMs - stamp(g) < GROUP_COOLDOWN_HOURS * 3600 * 1000).length,
      doc: FB_GROUPS_DOC,
    };
  } catch (e) {
    out.groups = { error: String((e && e.message) || e) };
  }
  return out;
}

export async function saveFbConnection(db, { accessToken, fbPageId, fbPageName, tokenType }) {
  await db.doc(FB_CONN_DOC).set({
    accessToken: String(accessToken || '').trim(),
    fbPageId: String(fbPageId || ''),
    fbPageName: String(fbPageName || ''),
    tokenType: tokenType === 'user' ? 'user' : (tokenType === 'page' ? 'page' : ''),
    connectedAt: new Date(),
  }, { merge: true });
}

export async function clearFbConnection(db) {
  await db.doc(FB_CONN_DOC).delete().catch(() => {});
}

const FB_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const FB_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/** إعادة استضافة صورة عبر Cloudinary (لحل روابط فيسبوك CDN والروابط اللي مفيش سيرفر هيوصلها كويس) */
async function rehostImageToCloudinary(imageUrl) {
  if (!FB_CLOUD_NAME || !FB_UPLOAD_PRESET || !/^https?:\/\//i.test(imageUrl)) return imageUrl;
  try {
    const isFbCrawler = /lookaside\.fbsbx\.com\/lookaside\/crawler\//i.test(imageUrl);
    const img = await safeFetch(imageUrl, {
      headers: isFbCrawler ? {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'image/*,*/*;q=0.8',
      } : { 'User-Agent': 'Mozilla/5.0 (compatible; TareeqBot/1.0; +https://carmasr-app.vercel.app)', Accept: 'image/*,*/*;q=0.8' },
    });
    if (!img.ok) return imageUrl;
    const buf = Buffer.from(await img.arrayBuffer());
    if (!buf || !buf.byteLength) return imageUrl;
    const ct = (img.headers.get('content-type') || '').toLowerCase();
    if (ct && ct.indexOf('image') === -1) return imageUrl;
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'image/jpeg' }), 'ad.jpg');
    form.append('upload_preset', FB_UPLOAD_PRESET);
    form.append('folder', 'tareeq/listings');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${FB_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    const data = await r.json();
    return (data && data.secure_url) || imageUrl;
  } catch { return imageUrl; }
}

/** تحويل رابط/اسم حساب فيسبوك إلى صيغة @ذكر — بدون رابط (حتى لا يختاره فيسبوك كصورة للبوست) */
export function fbMention(facebook) {
  const f = String(facebook || '').trim();
  if (!f) return '';
  if (/^@[\w.\-]+$/.test(f)) return f;
  const m = f.match(/facebook\.com\/([A-Za-z0-9.\-]+)/i);
  if (!m) return '';
  const u = m[1];
  if (/^(profile\.php|people|pages|messages|groups|events|marketplace|watch|reel|photo|video|stories|share)/i.test(u)) return '';
  return '@' + u;
}

/* صيغة البوست الاحترافية اللي بيترفع على صفحة فيسبوك — منصة كار مصر بنشر الإعلان: نص الإعلان أولاً ثم
   لينك الموقع في آخر سطر (اللينك الوحيد = كارت بصورة العربية)، ومنشن صاحب الإعلان @username لو
   لينكه بروفايل حقيقي (ما ينفعش من لينك مشاركة/جروب)، بدون رقم واتساب */
export function facebookPostText(listing, url) {
  const title = cleanStr(listing.title) || 'إعلان جديد على كار مصر';
  const priceNum = Number(listing.price);
  const price = Number.isFinite(priceNum) && priceNum !== 0
    ? priceNum.toLocaleString('ar-EG') + ' جنيه'
    : 'اتصل بنا لمعرفة السعر';
  const specs = [
    listing.brand ? `🏷️ ${cleanStr(listing.brand)}${listing.model ? ' ' + cleanStr(listing.model) : ''}` : '',
    listing.year ? `📅 سنة الصنع: ${cleanStr(listing.year)}` : '',
    listing.governorate ? `📍 ${cleanStr(listing.governorate)}` : '',
    `💰 ${price}`,
  ].filter(Boolean).join('\n');
  const owner = cleanStr(listing.advertiserName || '');
  const mention = fbMention(listing.facebook);
  const finalUrl = url || listingUrl(listing.slug, listing.id);
  const ownerLine = owner
    ? `👤 المعلن/البائع: ${owner}${mention ? ' ' + mention : ''}`
    : mention ? `👤 المعلن/البائع: ${mention}` : '';
  const parts = [
    `🚛 ${title}`,
    specs,
    '',
    ownerLine,
    '',
    `📲 متاح على تطبيق كار مصر CarMasr`,
    '',
    '✨ سوق كار مصر — أكبر سوق للمعدات الثقيلة والنقل في مصر 🇪🇬',
    '',
    '#كار_مصر #سوق_كار_مصر #معدات_ثقيلة #نقل_ثقيل #شاحنات #مقطورات #قطع_غيار #مصر',
    '',
    finalUrl,
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * صيغة بوست الجروبات — بتخاطب جمهور الجروب (المشترين المحتملين) لا صاحب الإعلان:
 * التفاصيل أولاً (النوع/الماركة/السعر/الموقع) ثم وصف مختصر ثم رابط المنصة —
 * من غير سطر "المعلن/البائع" ومن غير إشارة لصاحب البوست لإنها نسبة تانية عن نص الصفحة.
 */
export function groupPostText(listing, url) {
  const title = cleanStr(listing.title) || 'إعلان جديد على كار مصر';
  const priceNum = Number(listing.price);
  const price = Number.isFinite(priceNum) && priceNum !== 0
    ? priceNum.toLocaleString('ar-EG') + ' جنيه'
    : 'اتصل بنا لمعرفة السعر';
  const specs = [
    `🏷️ ${cleanStr(listing.brand)}${listing.model ? ' ' + cleanStr(listing.model) : ''}`,
    listing.year ? `📅 سنة الصنع: ${cleanStr(listing.year)}` : '',
    listing.governorate ? `📍 ${cleanStr(listing.governorate)}` : '',
    `💰 ${price}`,
  ].filter(Boolean).join('\n');
  const desc = cleanStr(listing.description || '').slice(0, 220);
  const finalUrl = url || listingUrl(listing.slug, listing.id);
  const parts = [
    `🚛 ${title}`,
    specs,
    desc ? '' + desc : '',
    '',
    '🔗 تفاصيل أكثر وصور أوضح من هنا:',
    finalUrl,
    '',
    '✨ سوق كار مصر — أكبر سوق للنقل الثقيل في مصر 🇪🇬',
    '',
    '#كار_مصر #سوق_كار_مصر #معدات_ثقيلة #نقل_ثقيل #شاحنات #مقطورات #مصر',
  ];
  return parts.filter(Boolean).join('\n');
}

/** قبل تخزين فيسبوك صاحب الإعلان: يشيل لينكات المشاركات/الجروبات/الماركت والبلايس —
    يبقي بس على بروفايل حقيقي (اسم مستخدم أو profile.php?id أو people/id) عشان زر الماسنجر يشتغل */
export function validFbProfile(facebook) {
  const f = String(facebook || '').trim();
  if (!f) return '';
  const m = f.match(/(?:facebook\.com|fb\.com|m\.facebook\.com)\/([A-Za-z0-9._\-]+)(?=\/|\?|$)/i);
  if (m) {
    const seg = m[1].toLowerCase();
    if (/^(share|share\.php|groups|events|marketplace|watch|reel|photo\.php|photos|videos|posts|stories|messages|pages|login|home|friends|feed|settings|about|help|policies)/i.test(seg)) return '';
    return f;
  }
  if (/^m\.me\/([\w.-]+)$/i.test(f) || /^messenger\.com\/t\/([\w.-]+)$/i.test(f)) return f;
  return '';
}

/**
 * رفع صور العربية (حتى 4) غير منشورة على هدف Graph API (صفحة أو جروب) — بايناري (multipart) أولًا
 * لأنه الأضمن، مع fallback للرفع بالـ URL ثم إعادة الاستضافة عبر Cloudinary كخيار أخير.
 * يرجع مصفوفة { media_feed_id } لاستخدامها في attached_media.
 */
export async function uploadPhotosToTarget(targetId, token, images) {
  const base = 'https://graph.facebook.com/v26.0';
  const mediaIds = [];
  for (const img of (Array.isArray(images) ? images.filter(u => /^https?:\/\//i.test(String(u))).slice(0, 4) : [])) {
    let photoId = null;
    try {
      const res = await safeFetch(img, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TareeqBot/1.0; +https://carmasr-app.vercel.app)', 'Accept': 'image/*,*/*;q=0.8' } });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.ok && buf && buf.byteLength > 0) {
        const mime = /\.png/i.test(img) ? 'image/png' : /\.gif/i.test(img) ? 'image/gif' : /\.webp/i.test(img) ? 'image/webp' : 'image/jpeg';
        const fd = new FormData();
        fd.append('access_token', token);
        fd.append('published', 'false');
        fd.append('source', new Blob([buf], { type: mime }), 'ad.jpg');
        const r = await fetch(`${base}/${targetId}/photos`, { method: 'POST', body: fd });
        photoId = (await r.json().catch(() => ({}))).id || null;
      }
    } catch {}
    if (!photoId) {
      try {
        const r = await fetch(`${base}/${targetId}/photos?url=${encodeURIComponent(img)}&published=false&access_token=${encodeURIComponent(token)}`, { method: 'POST' });
        photoId = (await r.json().catch(() => ({}))).id || null;
      } catch {}
    }
    if (!photoId) {
      try {
        const hosted = await rehostImageToCloudinary(img);
        if (hosted && hosted !== img) {
          const r = await fetch(`${base}/${targetId}/photos?url=${encodeURIComponent(hosted)}&published=false&access_token=${encodeURIComponent(token)}`, { method: 'POST' });
          photoId = (await r.json().catch(() => ({}))).id || null;
        }
      } catch {}
    }
    if (photoId) mediaIds.push({ media_feed_id: photoId });
  }
  return mediaIds;
}

/**
 * نشر إعلان على أي هدف Graph API (صفحة أو جروب): رفع الصور ثم النشر في /feed بصيغة احترافية.
 * منشن صاحب الإعلان (tag) يحدث فقط لما withTag = true ومعرّفه الرقمي معروف —
 * النشر في الجروبات بدون منشن لتفادي رفض فيسبوك خارج سياق الصفحة.
 */
export async function postToFacebookTarget({ targetId, token, listing, url, withTag = true, text, imageOnly = false }) {
  const base = 'https://graph.facebook.com/v26.0';
  const postUrl = url || listingUrl(listing.slug, listing.id);
  try {
    const mediaIds = await uploadPhotosToTarget(targetId, token, listing && listing.images);
    // بوستات الإعلانات: صور فقط — ممنوع نشر نص/لينك بدون صورة
    if (imageOnly && !mediaIds.length) {
      return { ok: false, error: 'الإعلان مفيش فيه صور — بوست الإعلان على فيسبوك صور فقط' };
    }
    const acc = withTag ? facebookAccount(listing && listing.facebook) : null;
    const ownerId = acc && /^\d{6,}$/.test(String(acc.id)) ? String(acc.id) : '';

    const buildForm = (withTags) => {
      const form = new URLSearchParams();
      const message = imageOnly ? '' : (text || facebookPostText(listing, postUrl));
      if (message) form.set('message', message);
      form.set('access_token', token);
      if (mediaIds.length) form.set('attached_media', JSON.stringify(mediaIds));
      if (withTags && ownerId) form.set('tags', JSON.stringify([{ tag_uid: ownerId }]));
      return form;
    };

    // النشر — بالمنشن أولًا، ولو رفض فيسبوك (المستخدم مش مؤهل) نعيد دونه
    let resp = await fetch(`${base}/${targetId}/feed`, { method: 'POST', body: buildForm(true) });
    let data = await resp.json().catch(() => ({}));
    let tagged = !!(ownerId && resp.ok && data && data.id);
    if (!(resp.ok && data && data.id) && ownerId) {
      resp = await fetch(`${base}/${targetId}/feed`, { method: 'POST', body: buildForm(false) });
      data = await resp.json().catch(() => ({}));
    }
    if (resp.ok && data && data.id) {
      return { ok: true, postId: data.id, images: mediaIds.length, tagged };
    }
    const fbErr = (data && data.error && (data.error.message || data.error.type))
      ? String(data.error.message || data.error.type) : `HTTP ${resp.status}`;
    return { ok: false, error: `فيسبوك رفض البوست: ${fbErr}` };
  } catch (e) {
    return { ok: false, error: 'خطأ في النشر على فيسبوك: ' + String((e && e.message) || e) };
  }
}

/**
 * رفع إعلان على صفحة فيسبوك: رفع الصور (حتى 4) غير منشورة ثم النشر في /feed بصيغة احترافية.
 * الصور هي أساس البوست (صور العربية)، ومعه منشن (tag) لصاحب الإعلان ما دام معرّفه الرقمي معروف —
 * لو فيسبوك رفض المنشن يتنشر البوست بدونه. لو الصور فشلت كلها → ينشر النص + الرابط فقط.
 */
export async function postListingToFacebookPage(listing, tokenOverride) {
  const token = tokenOverride || facebookPageToken();
  if (!token) return { ok: false, error: 'مفيش توكن صفحة فيسبوك — اربط فيسبوك من اللوحة (زرار «ربط فيسبوك») أو حوّل FB_PAGE_ACCESS_TOKEN في إعدادات Vercel' };
  const pageSlug = facebookPageUsername();
  let pageId = pageSlug;
  try {
    // المعرف الرقمي للصفحة من الـ username (عشان Graph ياخد الرقم فعلًا)
    const res = await fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(pageSlug)}?fields=id&access_token=${encodeURIComponent(token)}`);
    const j = await res.json();
    if (j && j.id) pageId = j.id;
  } catch {}
  const r = await postToFacebookTarget({ targetId: pageId, token, listing, url: listingUrl(listing.slug, listing.id), withTag: true, imageOnly: true });
  if (r.ok) r.pageUsername = pageSlug;
  return r;
}

/**
 * نشر الإعلان من الحساب الشخصي المباشر (مش الصفحة) — الهدف "me".
 * محتاج FB_USER_ACCESS_TOKEN في Vercel: روح Graph Explorer → حسابك →
 * getUserToken بصلاحية publish_to_groups و public_profile وبعدها استنسخه هناك.
 */
export async function postListingToFacebookProfile(listing, tokenOverride) {
  const token = tokenOverride || fbUserToken();
  if (!token) {
    return { ok: false, error: 'مفيش توكن حساب شخصي — حوّل FB_USER_ACCESS_TOKEN في إعدادات Vercel عشان النشر يتم من حسابك المباشر' };
  }
  const r = await postToFacebookTarget({
    targetId: 'me',
    token,
    listing,
    url: listingUrl(listing.slug, listing.id),
    withTag: false,
    imageOnly: true,
  });
  if (r.ok) r.profileUsername = facebookProfileUsername();
  return r;
}

/* ══════════════════════════════════════════════════════
   جروبات النشر (من لوحة الأدمن) + النشر الموحّد
   ══════════════════════════════════════════════════════ */

const FB_GROUPS_DOC = 'settings/fbGroups';
/** وثيقة الطابور التلقائي للنشر على الجروبات (حملة واحدة نشطة) */
const FB_CAMPAIGN_DOC = 'settings/fbCampaign';
/** عدد الجروبات اللي الطابور بينشر عليها في الدورة الواحدة */
const GROUP_CAMPAIGN_PER_TICK = 5;
/** السقف اليومي الافتراضي للطابور التلقائي (يتحكم فيه الأدمن من اللوحة) */
const GROUP_CAMPAIGN_DEFAULT_DAILY = 30;

// حماية الحساب من الإغلاق: حد لكل دورة + مهلة عشوائية بين المنشورات + حد يومي
const MAX_GROUPS_PER_RUN = 3;
const MAX_GROUPS_PER_DAY = 15;
/** هدنة ذكية: الجروب اللي اتنشر فيه مؤخرًا ما يتكررش قبل المدة دي — بيمنع الحظر والتكرار */
const GROUP_COOLDOWN_HOURS = 20;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** تأخير عشوائي بين 5-15 ثانية — يحاكي السلوك البشري ويمنع كشف الأتمتة */
const jitterDelay = () => Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;

/** قائمة جروبات فيسبوك المحفوظة للنشر (تخزين Firestore: settings/fbGroups) */
export async function loadFbGroups(db) {
  try {
    const snap = await db.doc(FB_GROUPS_DOC).get();
    const groups = (snap.exists && snap.data() && Array.isArray(snap.data().groups)) ? snap.data().groups : [];
    return groups.sort((a, b) => ((a.createdAt || 0) - (b.createdAt || 0)));
  } catch {
    return [];
  }
}

export async function saveFbGroups(db, groups) {
  try {
    await db.doc(FB_GROUPS_DOC).set({ groups: Array.isArray(groups) ? groups : [], updatedAt: new Date() }, { merge: true });
  } catch {}
}

async function persistFbGroupId(db, url, id) {
  if (!url || !id) return;
  const groups = await loadFbGroups(db);
  const g = groups.find(x => String(x.url || '') === String(url));
  if (g && String(g.id || '') !== String(id)) {
    g.id = String(id);
    await saveFbGroups(db, groups);
  }
}

/** معرّف الجروب الرقمي مباشرة من الرابط (facebook.com/groups/123456789/) */
export function fbGroupLinkId(url) {
  const m = String(url || '').match(/facebook\.com\/groups\/(\d{6,})\/?(?:[?#].*)?$/i);
  return m ? m[1] : '';
}

/** استخراج كل لينكات الجروبات الفيس من أي نص (لصق مجموعات تعليقات/قائمة محفوظة) — بدون أسماء — فريدة */
export function extractFbGroupLinks(text) {
  const out = [];
  const seen = new Set();
  const re = /https?:\/\/(?:[a-z-]+\.)?(?:facebook\.com|fb\.com)\/groups\/[^\s<>"']+/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    let raw = m[0];
    raw = raw.replace(/[)\]}>]+$/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push(raw);
    }
  }
  return out;
}

/**
 * تحليل نص لصق الجروبات (سطر لكل جروب) — يدعم: "اسم الجروب<TAB>اللينك"، "اسم | اللينك"، أو لينك لوحده.
 * يرجع [{ url, name }] فريد (بدون تكرار).
 */
export function parseFbGroupsPaste(text) {
  const out = [];
  const seen = new Set();
  const cleanName = (s) => String(s || '')
    .replace(/[\t|,;:–—-]+\s*$/, '')
    .replace(/^\s*[\t|,;:–—-]+/, '')
    .replace(/["'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/(^|[\s|,;\t(])((?:www\.)?(?:facebook|fb)\.com\/groups\/)/gi, '$1https://$2');
    const links = extractFbGroupLinks(line);
    if (!links.length) continue;
    links.forEach((link, i) => {
      if (seen.has(link)) return;
      seen.add(link);
      let name = '';
      if (i === 0) {
        const idx = line.indexOf(link);
        if (idx > 0) name = line.slice(0, idx);
        name = cleanName(name);
        if (name.length > 120) name = name.slice(0, 120).trim();
      }
      out.push({ url: link, name });
    });
  }
  return out;
}
export function guessGroupName(url) {
  const u = String(url || '').replace(/#.*$/, '').replace(/\?.*$/, '');
  const m = u.match(/facebook\.com\/groups\/([^/?#]+)/i);
  if (!m || /^\d+$/.test(m[1])) return '';
  return decodeURIComponent(m[1]).replace(/[._-]+/g, ' ').trim().slice(0, 60);
}

/** تحويل لينك جروب فيسبوك لمعرّفه الرقمي عبر نقطة معرفة الـ URLs في Graph API */
export async function resolveFbGroupId(url, token) {
  if (!token || !/^https?:\/\//i.test(String(url || ''))) return '';
  try {
    const r = await fetch(`https://graph.facebook.com/v26.0/?id=${encodeURIComponent(String(url))}&fields=id,name&access_token=${encodeURIComponent(token)}`);
    const j = await r.json();
    return j && /^\d+$/.test(String(j.id || '')) ? String(j.id) : '';
  } catch {
    return '';
  }
}

/**
 * بيانات التواصل مع صاحب الإعلان جاهزة للإرسال — رسالة «عملنا لك إعلان مجاني» + لينك واتساب وماسنجر
 */
export function buildAdvertiserContact(listing, url) {
  const finalUrl = url || listingUrl(listing.slug, listing.id);
  const message = freeAdMessage(finalUrl);
  const ph = cleanStr(listing.contactPhone || listing.userPhone || '');
  const fb = validFbProfile(listing.facebook) || '';
  return {
    name: advertiserName(listing),
    phone: ph,
    facebook: fb,
    message,
    waLink: whatsappLink(ph, message),
    msLink: advertiserMessengerLink(fb, '', message),
    needPhone: !ph,
    needMessenger: !fb,
  };
}

/**
 * النشر الموحّد للتوكين: صفحة فيسبوك (مع منع التكرار) + جروبات محفوظة/محددة + بيانات إشعار المعلن.
 * حماية من الإغلاق: عدد أقصى لكل دورة (MAX_GROUPS_PER_RUN) مع مهلة بين المنشورات
 * (GROUP_POST_DELAY_MS) وحد يومي (MAX_GROUPS_PER_DAY) يُحتسب في Firestore —
 * الباقي يُرجَّع للمعلن ليعيد الضغط للنشر على دفعات بعد هدنة.
 * opts.force يسمح بإعادة نشر الصفحة حتى لو منشورة قبل كده؛ opts.groupIds يقتصر على جروبات محددة.
 */
export async function publishAdToFacebook(listing, opts = {}) {
  const db = getDb();
  const pageToken = await effectiveFbToken(db);
  const userToken = fbUserToken();
  // الحساب الشخصي هو المصدر الأساسي لو موجود توكنه — والصفحة بديل احتياطي
  const useProfile = !!userToken;
  const token = useProfile ? userToken : pageToken;
  const url = listingUrl(listing.slug, listing.id);
  const out = {
    ok: false,
    url,
    page: null,
    groups: [],
    contact: buildAdvertiserContact(listing, url),
    reasons: [],
    source: useProfile ? 'profile' : 'page',
    sourceUsername: useProfile ? facebookProfileUsername() : facebookPageUsername(),
    sourceUrl: useProfile ? FACEBOOK_PROFILE_URL : FACEBOOK_PAGE_URL,
  };

  if (!pageToken && !userToken) {
    out.error = 'مفيش توكن صفحة فيسبوك — اضغط «ربط فيسبوك» من اللوحة أو حوّل FB_PAGE_ACCESS_TOKEN في إعدادات Vercel';
    return out;
  }

  if (!opts.skipPage) {
    if (listing.fbPostedAt && !opts.force) {
      out.page = { ok: true, alreadyPosted: true, postId: listing.fbPostId || null };
    } else {
      out.page = useProfile
        ? await postListingToFacebookProfile(listing, userToken)
        : await postListingToFacebookPage(listing, pageToken);
    }
  }

  const wantedIds = Array.isArray(opts.groupIds) ? opts.groupIds.map(String) : null;
  const saved = (await loadFbGroups(db)) || [];
  const wanted = wantedIds
    ? saved.filter(g => wantedIds.includes(String(g.id)))
    : saved.filter(g => g.enabled !== false);

  if (!wanted.length) {
    out.reasons.push(saved.length
      ? 'مفيش جروب محدد في الدورة دي — علّم الجروبات اللي تنشر فيها فوق قبل ما تضغط نشر'
      : 'مفيش جروبات محفوظة خالص — ضيف لينكات الجروبات من اللستة الأول');
  }

  // تدوير ذكي: الأقدم نشرًا أولًا، واللي في هدنة نشيله من الدورة دي
  const postedAt = (g) => { const t = Date.parse(String(g.lastPostedAt || '')); return Number.isFinite(t) ? t : 0; };
  const nowMs = Date.now();
  const cooldownMs = GROUP_COOLDOWN_HOURS * 3600 * 1000;
  const isCooling = (g) => postedAt(g) > 0 && nowMs - postedAt(g) < cooldownMs;
  const inCooldown = wanted.filter(isCooling);
  const pool = wanted.filter(g => !isCooling(g)).sort((a, b) => postedAt(a) - postedAt(b));
  if (inCooldown.length) {
    out.reasons.push(`${inCooldown.length} جروب في هدنة نشر (${GROUP_COOLDOWN_HOURS} ساعة) — تلقائيًا هيتقبلوا في دورة الجاية`);
  }
  if (wanted.length && !pool.length) {
    out.reasons.push('كل الجروبات المختارة في هدنة دلوقتي — ارجع اضغط بعد شوية عشان الحساب في أمان');
  }

  if (pool.length) {
    // التحقق من صلاحية التوكن قبل بدء النشر
    try {
      const meRes = await fetch(`https://graph.facebook.com/v26.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const meData = await meRes.json();
      if (!meRes.ok || !meData.id) {
        out.error = 'توكن فيسبوك منتهي الصلاحية أو غير صالح — أعد الربط من اللوحة';
        return out;
      }
    } catch {
      // نكمل حتى لو فشل التحقق (ربما يكون التوكن صالح لكن الاتصال ضعيف)
    }

    // الحد اليومي — اللي فاضل اليوم كله
    let postedCountToday = 0;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const gsnap = await db.doc(FB_GROUPS_DOC).get();
      const gdata = gsnap.exists ? gsnap.data() : {};
      postedCountToday = gdata.postedOn === today ? Number(gdata.postedCount || 0) : 0;
    } catch {}

    const remainingDay = Math.max(0, MAX_GROUPS_PER_DAY - postedCountToday);
    const maxThisRun = Math.min(MAX_GROUPS_PER_RUN, remainingDay);
    const slice = pool.slice(0, maxThisRun);

    if (remainingDay <= 0) {
      out.reasons.push('وصلت الحد اليومي للنشر في الجروبات — كمّل بكرة');
    } else if (maxThisRun === 0) {
      out.reasons.push('الحد اليومي اكتمل');
    } else if (pool.length > slice.length) {
      out.reasons.push(`بنشر ${slice.length} جروب بس في الدورة دي لحماية الحساب — ارجع اضغط تاني عشان تكمل الباقي بعد هدنة`);
    }

    for (const [i, g] of slice.entries()) {
      const entry = {
        id: String(g.id || ''),
        url: String(g.url || ''),
        name: String(g.name || '') || String(g.url || ''),
      };
      let targetId = entry.id;
      if (!/^\d+$/.test(targetId)) {
        targetId = await resolveFbGroupId(entry.url, token);
        if (targetId) {
          entry.id = targetId;
          await persistFbGroupId(db, entry.url, targetId);
        }
      }
      if (!/^\d+$/.test(targetId)) {
        entry.ok = false;
        entry.error = 'تعذّر تحديد معرّف الجروب — تأكد من اللينك أو جدّد توكن الصفحة';
        out.groups.push(entry);
        continue;
      }
      if (i > 0) {
        const delay = jitterDelay();
        await sleep(delay);
      }
      const r = await postToFacebookTarget({ targetId, token, listing, url, withTag: false, text: groupPostText(listing, url), imageOnly: true });
      entry.ok = r.ok;
      if (r.ok) {
        entry.postId = r.postId;
        entry.images = r.images || 0;
      } else {
        entry.error = r.error;
        // تأخير أطول بعد فشل — تجنب الحظر المتتالي
        await sleep(30000);
      }
      out.groups.push(entry);
      try {
        await db.doc(FB_GROUPS_DOC).set(
          { postedOn: new Date().toISOString().slice(0, 10), postedCount: postedCountToday + i + 1 },
          { merge: true },
        ).catch(() => {});
      } catch {}
      // تسجيل وقت النشر للجروب — ده اللي بيغذّي التدوير الذكي والهدنة
      if (r.ok) {
        try {
          const latest = await loadFbGroups(db);
          const gi = latest.findIndex(x => String(x.id || '') === entry.id || String(x.url || '') === entry.url);
          if (gi >= 0) {
            latest[gi].lastPostedAt = new Date().toISOString();
            await saveFbGroups(db, latest);
          }
        } catch {}
      }
    }

    // باقي الجروبات اللي اتأجلت (متأجّلة إما بالحد أو بالهدنة) — حالة خاصة تظهر في الواجهة
    const deferred = pool.slice(slice.length);
    if (deferred.length) {
      for (const g of deferred) {
        out.groups.push({
          id: String(g.id || ''),
          url: String(g.url || ''),
          name: String(g.name || '') || String(g.url || ''),
          ok: null,
          deferred: true,
          lastPostedAt: g.lastPostedAt || null,
          error: 'وصلت حد الدورة (3 بالمرة) — اضغط "نشر الدفعة التالية" بعدهين عشان المتبقي يتنشر',
        });
      }
    }
  }

  out.ok = !!((opts.skipPage || (out.page && out.page.ok)) || (out.groups.length === 0));
  return out;
}

/* ══════════════════════════════════════════════════════
   الطابور التلقائي للنشر على الجروبات (حملة تنشر لوحدها على مراحل آمنة)
   تحط كل لينكات الجروبات مرة واحدة، والطابور ياخد دفعات صغيرة كل شوية
   باحترام السقف اليومي + الهدنة لكل جروب، من غير أي ضغط يدوي.
   ══════════════════════════════════════════════════════ */

/** جلب إعلان بالمعرّف من Firestore (بيانات طازة للطابور) */
async function getListingById(db, id) {
  if (!id) return null;
  try {
    const snap = await db.collection('listings').doc(String(id)).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

/** توكن النشر — نفس منطق النشر الموحّد: الحساب الشخصي أولًا ثم الصفحة */
async function campaignToken(db) {
  const pageToken = await effectiveFbToken(db);
  const userToken = fbUserToken();
  return userToken || pageToken || '';
}

/** هل الخطأ ده بسبب توكن منتهي/ملغي؟ (مش مشكلة في الجروب نفسه) */
function isAuthError(m) {
  return /access token|session is invalid|token has expired|expired|logged out|\(#190\)|\(#102\)|\(#104\)|permission/i.test(String(m || ''));
}

/** التوكن التاني المتاح لو الأول رفض — الصفحة بديل الحساب الشخصي والعكس */
async function resolveAltToken(db, current) {
  try {
    const user = fbUserToken();
    if (user && user !== current) return user;
    const page = await effectiveFbToken(db);
    if (page && page !== current) return page;
  } catch {}
  return '';
}

/** حالة الحملة جاهزة للعرض في الواجهة */
export async function getGroupCampaign() {
  const db = getDb();
  try {
    const snap = await db.doc(FB_CAMPAIGN_DOC).get();
    if (!snap.exists) return null;
    const c = snap.data() || {};
    return {
      ...c,
      total: Number(c.total || ((c.done || []).length + (c.pending || []).length + (c.failed || []).length)),
      doneCount: (c.done || []).length,
      failedCount: (c.failed || []).length,
      remainingCount: (c.pending || []).length,
    };
  } catch {
    return null;
  }
}

/** بدء حملة: نلتقط الإعلان + الجروبات المطلوبة ونحطها في الطابور كـ pending */
export async function startGroupCampaign({ listingId, groupIds, dailyCap } = {}) {
  const db = getDb();
  const listing = await getListingById(db, listingId);
  if (!listing) return { ok: false, error: 'الإعلان مش موجود' };

  const all = await loadFbGroups(db);
  const wantIds = Array.isArray(groupIds) && groupIds.length ? groupIds.map(String) : null;
  const wanted = wantIds ? all.filter(g => wantIds.includes(String(g.id))) : all.filter(g => g.enabled !== false);
  if (!wanted.length) return { ok: false, error: 'مفيش جروبات محددة — أضف لينكات الجروبات أو علّمها الأول' };

  const pending = wanted.map(g => ({ id: String(g.id || ''), url: String(g.url || ''), name: String(g.name || '') || String(g.url || '') }));
  const cap = Math.min(200, Math.max(1, Number(dailyCap) || GROUP_CAMPAIGN_DEFAULT_DAILY));
  const campaign = {
    listingId: String(listing.id),
    listingTitle: String(listing.title || ''),
    listingUrl: listingUrl(listing.slug, listing.id),
    pending,
    done: [],
    failed: [],
    total: pending.length,
    dailyCap: cap,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.doc(FB_CAMPAIGN_DOC).set(campaign);
  return { ok: true, campaign: { ...campaign, doneCount: 0, failedCount: 0, remainingCount: pending.length } };
}

/** إيقاف الحملة يدويًا */
export async function stopGroupCampaign() {
  const db = getDb();
  const snap = await db.doc(FB_CAMPAIGN_DOC).get();
  if (!snap.exists) return null;
  await db.doc(FB_CAMPAIGN_DOC).set({ status: 'stopped', updatedAt: new Date().toISOString() }, { merge: true });
  return await getGroupCampaign();
}

/** استئناف بعد تجديد التوكن: يرجّع الجروبات اللي فشلت بسبب التوكن لطابور الانتظار */
export async function resumeGroupCampaign() {
  const db = getDb();
  const ref = db.doc(FB_CAMPAIGN_DOC);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = snap.data() || {};
  const failed = Array.isArray(c.failed) ? c.failed : [];
  const authFailed = failed.filter(f => isAuthError(f.error));
  const kept = failed.filter(f => !isAuthError(f.error));
  const pending = [...authFailed, ...(Array.isArray(c.pending) ? c.pending : [])];
  await ref.set({ status: 'running', pending, failed: kept, error: null, authError: false, updatedAt: new Date().toISOString() }, { merge: true });
  return await getGroupCampaign();
}

/**
 * دورة واحدة من الطابور: تنشر دفعة آمنة صغيرة على الجروبات المتبقية.
 * محصّنة ضد التكرار (بتشيل المنشور منها من الطابور)، وبتحترم الحد اليومي والهدنة.
 */
export async function runGroupCampaignTick() {
  const db = getDb();
  const ref = db.doc(FB_CAMPAIGN_DOC);
  const out = { ran: false, posted: 0, failed: 0, remaining: 0, status: 'idle', reasons: [] };

  const snap = await ref.get();
  if (!snap.exists) { out.reasons.push('مفيش حملة محفوظة'); return out; }
  const c = snap.data() || {};
  if (c.status !== 'running') { out.status = String(c.status || 'idle'); out.reasons.push('الحملة مش نشطة'); return out; }
  out.ran = true;

  const listing = await getListingById(db, c.listingId);
  if (!listing) {
    await ref.set({ status: 'error', error: 'الإعلان المرتبط بالحملة مش موجود', updatedAt: new Date().toISOString() }, { merge: true });
    out.status = 'error'; out.reasons.push('الإعلان مش موجود');
    return out;
  }

  const token = await campaignToken(db);
  if (!token) {
    out.status = 'running'; out.remaining = (c.pending || []).length;
    out.reasons.push('مفيش توكن نشر شغال');
    return out;
  }

  const cap = Number(c.dailyCap) || GROUP_CAMPAIGN_DEFAULT_DAILY;
  const today = new Date().toISOString().slice(0, 10);
  const groupsRef = db.doc(FB_GROUPS_DOC);
  let postedToday = 0;
  try {
    const gsnap = await groupsRef.get();
    const gdata = gsnap.exists ? gsnap.data() : {};
    postedToday = gdata.postedOn === today ? Number(gdata.postedCount || 0) : 0;
  } catch {}

  const pending = Array.isArray(c.pending) ? [...c.pending] : [];
  const done = Array.isArray(c.done) ? [...c.done] : [];
  const failed = Array.isArray(c.failed) ? [...c.failed] : [];

  const remainingDay = Math.max(0, cap - postedToday);
  const budget = Math.min(GROUP_CAMPAIGN_PER_TICK, remainingDay);
  if (budget <= 0) {
    out.status = 'running'; out.remaining = pending.length;
    out.reasons.push('وصلنا السقف اليومي — نكمل بكرة تلقائيًا');
    const tickEntry = { at: new Date().toISOString(), posted: 0, failed: 0, remaining: pending.length, reasons: out.reasons };
    const log = [tickEntry, ...(Array.isArray(c.log) ? c.log : [])].slice(0, 20);
    await ref.set({ log, lastTick: tickEntry, updatedAt: new Date().toISOString(), lastTickAt: tickEntry.at }, { merge: true }).catch(() => {});
    return out;
  }

  const slice = pending.splice(0, budget);
  const startedAt = Date.now();
  const url = listingUrl(listing.slug, listing.id);
  const text = groupPostText(listing, url);
  let authError = '';

  for (const [i, g] of slice.entries()) {
    if (i > 0) {
      // حارس زمني: ما نتجاوزش مهلة الدالة (60 ثانية) وإلا نرجّع الباقي للطابور بدل ضياعه
      if (Date.now() - startedAt > 42000) { pending.unshift(...slice.slice(i)); break; }
      await sleep(jitterDelay());
    }
    let targetId = String(g.id || '');
    if (!/^\d+$/.test(targetId)) {
      targetId = await resolveFbGroupId(g.url, token);
      if (targetId) await persistFbGroupId(db, g.url, targetId);
    }
    if (!/^\d+$/.test(targetId)) {
      failed.push({ ...g, error: 'تعذّر تحديد معرّف الجروب' });
      out.failed += 1;
      continue;
    }
    let r = await postToFacebookTarget({ targetId, token, listing, url, withTag: false, text, imageOnly: true });
    if (!r.ok && isAuthError(r.error)) {
      const alt = await resolveAltToken(db, token);
      if (alt) {
        const r2 = await postToFacebookTarget({ targetId, token: alt, listing, url, withTag: false, text, imageOnly: true });
        if (r2.ok) r = r2;
      }
    }
    if (r.ok) {
      done.push({ ...g, id: targetId, postId: r.postId, postedAt: new Date().toISOString() });
      out.posted += 1;
      postedToday += 1;
      await groupsRef.set({ postedOn: today, postedCount: postedToday }, { merge: true }).catch(() => {});
      if (i > 0) await sleep(1500);
    } else if (isAuthError(r.error)) {
      // التوكن منتهي: نرجّع الجروب للطابور بدل ما نحرقه كـ«فشل دائم»
      authError = String(r.error || 'توكن فيسبوك منتهي');
      pending.unshift(...slice.slice(i));
      out.reasons.push('التوكن منتهي/ملغي — جدّد توكن فيسبوك وبعدين اضغط «استئناف الطابور»');
      break;
    } else {
      failed.push({ ...g, error: r.error });
      out.failed += 1;
      await sleep(30000);
    }
  }

  const status = authError ? 'error' : (pending.length ? 'running' : (failed.length && !done.length ? 'error' : 'done'));
  const tickEntry = {
    at: new Date().toISOString(),
    posted: out.posted,
    failed: out.failed,
    remaining: pending.length,
    reasons: out.reasons,
  };
  const prevLog = Array.isArray(c.log) ? c.log : [];
  const log = [tickEntry, ...prevLog].slice(0, 20);
  await ref.set({ pending, done, failed, status, log, lastTick: tickEntry, error: authError || null, authError: !!authError, updatedAt: new Date().toISOString(), lastTickAt: new Date().toISOString() }, { merge: true });
  out.remaining = pending.length;
  out.status = status;
  return out;
}

export const FB_GROUP_LIMITS = { perRun: MAX_GROUPS_PER_RUN, perDay: MAX_GROUPS_PER_DAY };
export const FB_CAMPAIGN = { perTick: GROUP_CAMPAIGN_PER_TICK, defaultDaily: GROUP_CAMPAIGN_DEFAULT_DAILY };

/* ══════════════════════════════════════════════════════
   النشر اليدوي بدون توكن: تجهيز نص البوست للنسخ + تعليم الجروب إنه اتنشر
   (بديل شغّال لما مفيش توكن فيه صلاحية publish_to_groups)
   ══════════════════════════════════════════════════════ */

/** تجهيز نص البوست الجاهز للنسخ اليدوي — من غير أي نداء لـ Graph API */
export async function prepareFbGroupPost(listingId) {
  const db = getDb();
  const listing = await getListingById(db, listingId);
  if (!listing) return { success: false, message: 'الإعلان مش موجود' };
  const url = listingUrl(listing.slug, listing.id);
  const images = (Array.isArray(listing.images) ? listing.images : []).filter(u => /^https?:\/\//i.test(String(u))).slice(0, 4);
  return {
    success: true,
    id: String(listing.id),
    title: String(listing.title || ''),
    url,
    text: groupPostText(listing, url),
    images,
    cooldownHours: GROUP_COOLDOWN_HOURS,
  };
}

/** تسجيل إن الجروب اتنشر فيه يدويًا: يضبط هدنة lastPostedAt ويزوّد العدّاد اليومي */
export async function markFbGroupPosted(groupId) {
  const db = getDb();
  const id = String(groupId || '').trim();
  if (!id) return { success: false, message: 'معرّف الجروب مطلوب' };
  const groups = await loadFbGroups(db);
  const idx = groups.findIndex(g => String(g.id) === id);
  if (idx < 0) return { success: false, message: 'الجروب مش موجود في القايمة' };
  const now = new Date().toISOString();
  groups[idx] = { ...groups[idx], lastPostedAt: now, lastPostedManual: true };
  await saveFbGroups(db, groups);
  try {
    const today = now.slice(0, 10);
    const ref = db.doc(FB_GROUPS_DOC);
    const snap = await ref.get();
    const d = snap.exists ? (snap.data() || {}) : {};
    const count = d.postedOn === today ? Number(d.postedCount || 0) : 0;
    await ref.set({ postedOn: today, postedCount: count + 1, updatedAt: new Date() }, { merge: true });
  } catch {}
  return { success: true, message: 'اتسجل ✓ — الجروب في هدنة ' + GROUP_COOLDOWN_HOURS + ' ساعة', groups };
}

/**
 * استيراد كل جروبات الحساب الشخصي من فيسبوك مرة واحدة (قراءة فقط — مفيش أي نشر = صفر خطر حظر).
 * بيستخدم me/groups ومحتاج التوكن يكون فيه صلاحية groups_access_member_info.
 * لو الاسم موجود كرقم بس (placeholder) بيتظبط للاسم الحقيقي؛ وأسماء المستخدم اليدوية مابتتغيّرش.
 */
export async function importMyFbGroups(db, tokenOverride) {
  const token = String(tokenOverride || '').trim() || fbUserToken() || facebookPageToken();
  if (!token) return { success: false, message: 'مفيش توكن — ضيف FB_USER_ACCESS_TOKEN في إعدادات Vercel (أو احفظ توكن الحساب من تبويب جروبات فيسبوك)' };

  const base = 'https://graph.facebook.com/v26.0';
  let url = `${base}/me/groups?limit=500&fields=id,name,member_count&access_token=${encodeURIComponent(token)}`;
  const fetched = [];
  for (let page = 0; page < 20 && url; page++) {
    let j;
    try { const r = await fetch(url); j = await r.json(); }
    catch { return { success: false, message: 'تعذر الاتصال بفيسبوك — جرّب تاني' }; }
    if (j && j.error) {
      return {
        success: false,
        permission: true,
        message: 'فيسبوك رفض القراءة: ' + String(j.error.message || '') +
          ' — التوكن محتاج صلاحية groups_access_member_info. من Graph Explorer: اختارها مع public_profile واعمل توكن جديد وحطه في FB_USER_ACCESS_TOKEN.',
      };
    }
    for (const g of (Array.isArray(j && j.data) ? j.data : [])) {
      if (g && /^\d+$/.test(String(g.id || ''))) {
        fetched.push({
          id: String(g.id),
          name: cleanStr(g.name) || String(g.id),
          url: `https://www.facebook.com/groups/${g.id}/`,
          memberCount: Number(g.member_count) || 0,
        });
      }
    }
    url = (j && j.paging && j.paging.next) ? j.paging.next : '';
  }
  if (!fetched.length) {
    return { success: false, message: 'فيسبوك رجّع قائمة فاضية — يمكن حسابك مش عضو في أي جروب، أو التوكن ناقصه الصلاحية.' };
  }

  const groups = await loadFbGroups(db);
  const byId = new Map(groups.map(g => [String(g.id), g]));
  let added = 0, renamed = 0;
  for (const f of fetched) {
    const ex = byId.get(f.id);
    if (ex) {
      if (f.name && ex.name !== f.name && /^\d+$/.test(String(ex.name || ''))) { ex.name = f.name; renamed++; }
      if (!ex.url) ex.url = f.url;
      if (f.memberCount && ex.memberCount !== f.memberCount) ex.memberCount = f.memberCount;
    } else {
      groups.push({ id: f.id, url: f.url, name: f.name, enabled: true, createdAt: Date.now(), memberCount: f.memberCount });
      added++;
    }
  }
  await saveFbGroups(db, groups);
  return {
    success: true,
    message: `اتجابوا من فيسبوك: ${fetched.length} جروب — جديد ${added}${renamed ? ' — اسم اتظبط لـ ' + renamed : ''}`,
    added, renamed, total: fetched.length,
    groups: await loadFbGroups(db),
  };
}

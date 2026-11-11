// ==UserScript==
// @name         CarMasr - سحب جروبات فيسبوك
// @namespace    tareeq
// @version      1.0
// @description  يسحب كل جروباتك من صفحة Facebook Groups ويحمّلها كملف .txt (سطر لكل جروب) لرفعها في لوحة CarMasr
// @author       CarMasr
// @match        https://www.facebook.com/groups*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── styles ───
  const css = `
    #tareeq-scraper-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #fff; border: none; border-radius: 14px;
      padding: 12px 18px; font-size: 14px; font-weight: 700;
      box-shadow: 0 8px 24px rgba(249,115,22,0.4);
      cursor: pointer; font-family: system-ui, sans-serif;
      direction: rtl;
    }
    #tareeq-scraper-btn:disabled { opacity: 0.6; cursor: wait; }
    #tareeq-scraper-status {
      position: fixed; bottom: 70px; right: 20px; z-index: 999999;
      background: #0D1B2A; color: #fff; border-radius: 10px;
      padding: 8px 12px; font-size: 12px; font-family: system-ui, sans-serif;
      direction: rtl; max-width: 260px; display: none;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ─── button ───
  const btn = document.createElement('button');
  btn.id = 'tareeq-scraper-btn';
  btn.textContent = '📥 سحب جروبات CarMasr';
  document.body.appendChild(btn);

  const status = document.createElement('div');
  status.id = 'tareeq-scraper-status';
  document.body.appendChild(status);

  function showStatus(msg) {
    status.textContent = msg;
    status.style.display = 'block';
  }
  function hideStatus() { status.style.display = 'none'; }

  function collect() {
    const M = new Map();
    document.querySelectorAll('a[href*="/groups/"]').forEach(a => {
      const h = a.getAttribute('href') || a.href || '';
      const m = h.match(/\/groups\/(\d{5,})(?:\/|$|[?#])/);
      if (!m) return;
      const id = m[1];
      const t = (a.getAttribute('aria-label') || a.textContent || '')
        .replace(/\s+/g, ' ').trim().slice(0, 120);
      const p = M.get(id);
      if (!p || (t && t.length > (p.n || '').length)) M.set(id, { n: t || id });
    });
    return M;
  }

  function scrollDown() {
    window.scrollTo(0, document.body.scrollHeight);
    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = el.scrollHeight;
    const mn = document.querySelector('[role="main"]');
    if (mn && mn.scrollHeight > mn.clientHeight + 200) mn.scrollTop = mn.scrollHeight;
  }

  function downloadTxt(rows) {
    const txt = rows.map(e => (e[1].n || e[0]) + ' | https://www.facebook.com/groups/' + e[0] + '/').join('\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tareeq-groups.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // also copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).catch(() => {});
    }
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '⏳ جاري السحب...';
    showStatus('بدء السحب — لا تغلق الصفحة');

    const M = new Map();
    let last = -1, lastM = -1, same = 0;
    for (let i = 0; i < 400; i++) {
      collect().forEach((v, k) => {
        const p = M.get(k);
        if (!p || (v.n && v.n.length > (p.n || '').length)) M.set(k, v);
      });
      scrollDown();
      await new Promise(r => setTimeout(r, 600));
      const hh = document.body.scrollHeight + (document.scrollingElement ? document.scrollingElement.scrollHeight : 0);
      if (hh === last && M.size === lastM) {
        if (++same >= 6) break;
      } else {
        same = 0;
      }
      last = hh;
      lastM = M.size;
      showStatus('تم سحب ' + M.size + ' جروب — مرّر للأسفل...');
    }
    // final collect
    collect().forEach((v, k) => {
      const p = M.get(k);
      if (!p || (v.n && v.n.length > (p.n || '').length)) M.set(k, v);
    });

    const rows = [...M.entries()];
    if (!rows.length) {
      showStatus('لم يُعثر على أي جروب — تأكد أنك في صفحة Groups');
      btn.disabled = false;
      btn.textContent = '📥 سحب جروبات CarMasr';
      return;
    }

    downloadTxt(rows);
    showStatus('✅ تم سحب ' + rows.length + ' جروب — حُمّل ملف tareeq-groups.txt');
    btn.textContent = '✅ تم (' + rows.length + ')';
    alert('تم تجهيز ' + rows.length + ' جروب ✓\n\nحمّل ملف tareeq-groups.txt\n\nافتح لوحة CarMasr → جروبات فيسبوك → رفع ملف → اختر tareeq-groups.txt → إضافة الكل');

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '📥 سحب جروبات CarMasr';
      hideStatus();
    }, 8000);
  });
})();

// حماية من SSRF: يسمح فقط بـ http/https لعناوين عامة، ويرفض أي عنوان
// يحلّ إلى نطاق خاص/محلي (loopback, link-local, metadata, ULA...)، ويعيد
// فحص كل خطوة إعادة توجيه قبل متابعتها.
import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                          // this-network
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;                         // multicast / reserved
  return false;
}

function isPrivateV6(ip) {
  const s = ip.toLowerCase();
  if (s === '::1' || s === '::') return true;        // loopback / unspecified
  if (s.startsWith('fe80')) return true;             // link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return true; // unique-local
  if (s.startsWith('::ffff:')) return isPrivateV4(s.slice(7)); // IPv4-mapped
  return false;
}

export function isForbiddenIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind === 6) return isPrivateV6(ip);
  return true;
}

export async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new Error('SSRF_BAD_URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('SSRF_BAD_PROTOCOL');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('SSRF_FORBIDDEN_HOST');
  }
  if (net.isIP(host)) {
    if (isForbiddenIp(host)) throw new Error('SSRF_FORBIDDEN_IP');
    return u;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error('SSRF_DNS_FAIL'); }
  if (!addrs.length) throw new Error('SSRF_DNS_EMPTY');
  for (const a of addrs) {
    if (isForbiddenIp(a.address)) throw new Error('SSRF_FORBIDDEN_RESOLVED_IP');
  }
  return u;
}

// fetch مع فحص SSRF لكل خطوة إعادة توجيه (redirect: manual)
export async function safeFetch(raw, opts = {}, maxRedirects = 3) {
  let current = String(raw);
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { ...opts, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('SSRF_TOO_MANY_REDIRECTS');
}

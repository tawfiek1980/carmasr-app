// api/_lib/cors.js — رؤوس CORS موحّدة للدوال (تسمح بتصفح تطبيق العملاء من الـ APK WebView)
export function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-uid, x-cron-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function isPreflight(req) {
  return req.method === 'OPTIONS';
}
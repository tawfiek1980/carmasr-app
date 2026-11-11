# 🚛 طريق TAREEQ — سوق النقل الثقيل في مصر

أكبر منصة رقمية متخصصة في مركبات النقل الثقيل والمعدات.

---

## ⚡ التشغيل المحلي السريع

### المتطلبات
- Node.js 18+
- npm 9+

### الخطوات

```bash
# 1. فك الضغط وادخل على المجلد
cd tareeq-project

# 2. ثبّت الحزم
npm install

# 3. اضبط متغيرات البيئة
cp .env.example .env
# عدّل .env وأضف بيانات Firebase

# 4. شغّل المشروع
npm run dev
```

افتح المتصفح على: **http://localhost:3000**

---

## 🚀 الرفع على Vercel

### الطريقة ١: بدون سطر أوامر (الأسهل)

1. ادخل على [vercel.com](https://vercel.com) وسجّل دخول
2. اضغط **"Add New Project"**
3. ارفع المجلد أو اربط مستودع GitHub
4. في **"Environment Variables"** أضف:

| المتغير | القيمة |
|---------|--------|
| `VITE_FIREBASE_API_KEY` | من Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | اسم مشروع Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | من Firebase Console |
| `VITE_FIREBASE_APP_ID` | من Firebase Console |
| `JWT_SECRET` | كلمة سر قوية عشوائية |
| `NODE_ENV` | `production` |

5. اضغط **"Deploy"** ✅

---

### الطريقة ٢: سطر الأوامر

```bash
# ثبّت Vercel CLI
npm install -g vercel

# سجّل دخول
vercel login

# ارفع المشروع
vercel --prod
```

---

### الطريقة ٣: السكريبت التلقائي

```bash
# على Mac/Linux
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

---

## 🗂️ هيكل المشروع

```
tareeq-project/
├── src/
│   ├── pages/
│   │   ├── legal/          # 15 صفحة قانونية
│   │   ├── company/        # 7 صفحات الشركة
│   │   ├── help/           # 10 صفحات المساعدة
│   │   ├── system/         # 5 صفحات النظام
│   │   ├── user/           # 7 صفحات المستخدم
│   │   └── admin/          # لوحة إدارة شاملة
│   ├── components/
│   ├── contexts/
│   ├── lib/
│   └── App.tsx             # كل الـ Routes مربوطة
├── server.js               # Express API
├── api/index.js            # Vercel Serverless Function
├── vercel.json             # إعدادات Vercel
└── .env.example            # نموذج متغيرات البيئة
```

---

## 📄 الصفحات المتاحة (45 صفحة جديدة)

### قانونية
`/privacy-policy` · `/terms` · `/cookies` · `/acceptable-use` · `/content-policy` · `/fraud-prevention` · `/finance-policy` · `/vehicle-listing-policy` · `/marketplace-policy` · `/user-safety` · `/data-protection` · `/account-deletion-policy` · `/refund-policy` · `/community-guidelines` · `/copyright-policy`

### الشركة
`/about` · `/mission` · `/why-tareeq` · `/partners` · `/careers` · `/press` · `/media`

### المساعدة
`/help` · `/faq` · `/support` · `/report-problem` · `/report-abuse` · `/safety-tips` · `/help/buying-guide` · `/help/selling-guide` · `/help/financing-guide` · `/help/posting-guide`

### النظام
`/404` · `/500` · `/maintenance` · `/offline` · `/coming-soon`

### المستخدم
`/dashboard` · `/my-listings` · `/my-finance` · `/notifications` · `/settings` · `/security-settings` · `/delete-account`

---

## 🔧 متغيرات البيئة الكاملة

```env
# Firebase (مطلوب)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Backend
JWT_SECRET=your-super-secret-key
NODE_ENV=production

# Database (اختياري - بدونه يشتغل SQLite)
DATABASE_URL=postgresql://...
```

---

## 🛠️ تقنيات المشروع

| التقنية | الاستخدام |
|---------|-----------|
| React 19 + TypeScript | الواجهة |
| Vite 7 | Build Tool |
| TailwindCSS 4 | التصميم |
| React Router 7 | الـ Routing |
| Firebase | المصادقة |
| Express 5 | الـ API |
| PostgreSQL / SQLite | قاعدة البيانات |
| Vercel | الاستضافة |

---

## 📞 الدعم

- البريد: tawfiek.fayez@gmail.com
- الهاتف: 0100 123 4567


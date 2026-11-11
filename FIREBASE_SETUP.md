# 🔥 إعداد Firebase خطوة بخطوة

---

## الخطوة ١ — إنشاء مشروع Firebase

1. افتح [console.firebase.google.com](https://console.firebase.google.com)
2. اضغط **"Add project"** ← اسم المشروع: `tareeq-d4dcc`
3. Google Analytics: اختياري ← **Continue**

---

## الخطوة ٢ — إعداد Authentication

**Console → Authentication → Get Started**

### فعّل طرق التسجيل:

| الطريقة | الخطوات |
|---------|---------|
| **Google** | Sign-in providers → Google → Enable → Project support email → Save |
| **Facebook** | Sign-in providers → Facebook → Enable → أدخل App ID و App Secret من [developers.facebook.com](https://developers.facebook.com) |

### أضف Authorized Domains:
**Authentication → Settings → Authorized domains → Add domain**
```
localhost
tareeq-d4dcc.firebaseapp.com
your-vercel-domain.vercel.app
```

---

## الخطوة ٣ — إعداد Firestore Database

1. **Console → Firestore Database → Create database**
2. اختر **"Production mode"**
3. الموقع: `europe-west1` أو `us-central1`

### ارفع قواعد الأمان:
**Firestore → Rules → انسخ الكود من ملف `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth()  { return request.auth != null; }
    function isAdmin() { return isAuth() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.type == 'admin'; }
    function isOwner(uid) { return isAuth() && request.auth.uid == uid; }

    match /users/{userId} {
      allow read:   if isAuth();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }
    match /listings/{listingId} {
      allow read:   if true;
      allow create: if isAuth();
      allow update, delete: if isAuth() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    match /loads/{loadId} {
      allow read:   if true;
      allow create: if isAuth();
      allow update, delete: if isAuth() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    match /jobs/{jobId} {
      allow read:   if true;
      allow create: if isAuth();
      allow update, delete: if isAuth() && (resource.data.userId == request.auth.uid || isAdmin());
    }
    match /financeRequests/{reqId} {
      allow read:   if isAuth() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuth();
      allow update, delete: if isAdmin();
    }
    match /siteConfig/{docId} {
      allow read:  if true;
      allow write: if isAdmin();
    }
  }
}
```

---

## الخطوة ٤ — إعداد Storage

1. **Console → Storage → Get started → Production mode**
2. **Storage → Rules → انسخ من ملف `storage.rules`**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /listings/{userId}/{fileName} {
      allow read:  if true;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /profiles/{userId}/{fileName} {
      allow read:  if true;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

---

## الخطوة ٥ — الحصول على بيانات الاتصال

**Console → Project Settings (⚙️) → Your apps → Add app → Web (</>)**

اسم التطبيق: `tareeq-web` → Register

ستحصل على:
```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "tareeq-d4dcc.firebaseapp.com",
  projectId:         "tareeq-d4dcc",
  storageBucket:     "tareeq-d4dcc.appspot.com",
  messagingSenderId: "725...",
  appId:             "1:725...",
};
```

---

## الخطوة ٦ — إعداد ملف .env

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=tareeq-d4dcc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tareeq-d4dcc
VITE_FIREBASE_STORAGE_BUCKET=tareeq-d4dcc.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=725660784165
VITE_FIREBASE_APP_ID=1:725660784165:web:56660a3b...
```

---

## الخطوة ٧ — تعيين أول مدير (Admin)

**بعد تسجيل الدخول لأول مرة:**

1. **Firestore → users → [ابحث عن uid الخاص بك]**
2. اضغط **Edit** على حقل `type`
3. غيّر القيمة من `"individual"` إلى `"admin"`
4. اضغط **Update**

**أو عبر صفحة MakeAdmin:**
- ادخل على `/make-admin` واتبع التعليمات

---

## الخطوة ٨ — التحقق إن كل حاجة شغالة

```bash
npm run dev
```

1. ✅ تسجيل الدخول بـ Google
2. ✅ نشر إعلان مع صور
3. ✅ رفع طلب تمويل
4. ✅ لوحة الأدمن على `/admin`

---

## مشاكل شائعة وحلولها

| المشكلة | الحل |
|---------|------|
| `auth/unauthorized-domain` | أضف الدومين في Authentication → Authorized domains |
| `permission-denied` | تأكد من رفع Firestore Rules صح |
| Storage upload fails | تأكد من Storage Rules وتفعيل Storage |
| CORS error | أضف `localhost` في Authorized domains |

import admin from 'firebase-admin';
import { config } from 'dotenv';
config();

const key = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

admin.initializeApp({ credential: admin.credential.cert(key) });

const [,, email, newPassword] = process.argv;

if (!email || !newPassword || newPassword.length < 6) {
  console.error('\n❌ استخدام: npm run reset-pass <email> <password>');
  console.error('   مثال: npm run reset-pass phone_1012345678@tareeq.app 123456\n');
  process.exit(1);
}

try {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password: newPassword });
  console.log(`\n✅ تم تغيير كلمة سر ${email} إلى "${newPassword}"\n`);
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}

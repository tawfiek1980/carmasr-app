const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.adminChangePassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "يجب تسجيل الدخول أولاً"
    );
  }

  const callerUid = context.auth.uid;
  const callerSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  const caller = callerSnap.data();

  if (!caller || caller.type !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "فقط الأدمن يمكنه تنفيذ هذا الإجراء"
    );
  }

  const { email, phone, newPassword } = data;

  if (!newPassword) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "كلمة المرور الجديدة مطلوبة"
    );
  }

  if (newPassword.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "كلمة المرور يجب ألا تقل عن 6 أحرف"
    );
  }

  let uid;
  try {
    // 1. Try to find user by email (works for phone-login users)
    const userRecord = await admin.auth().getUserByEmail(email);
    uid = userRecord.uid;
  } catch {
    // 2. Email lookup failed — try by phone (for Google/Facebook users)
    if (phone) {
      const usersSnap = await admin.firestore()
        .collection("users")
        .where("phone", "==", phone)
        .get();
      if (!usersSnap.empty) {
        uid = usersSnap.docs[0].id;
      }
    }
  }

  if (!uid) {
    console.error("User not found by email:", email, "or phone:", phone);
    throw new functions.https.HttpsError(
      "not-found",
      "لم يتم العثور على مستخدم بهذا الرقم. قد يكون سجّل بحساب جوجل أو فيسبوك."
    );
  }

  try {
    await admin.auth().updateUser(uid, { password: newPassword });
    return { success: true, uid };
  } catch (error) {
    console.error("Reset password error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "فشل تغيير كلمة السر. تأكد من صحة البيانات."
    );
  }
});

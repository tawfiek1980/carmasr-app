// CompleteProfile.tsx
import { useState } from "react";
import ProfileForm from "../components/profile/ProfileForm";

export default function CompleteProfile() {
  const [saving, setSaving] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

        <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-8">
          <h1 className="text-3xl font-extrabold mb-2">
            استكمال بيانات الحساب
          </h1>
          <p className="text-blue-100 text-lg">
            أكمل بياناتك مرة واحدة لتخصيص تجربتك والاستفادة من جميع خدمات كار مصر.
          </p>
        </div>

        <div className="p-8">
          <ProfileForm
            saving={saving}
            setSaving={setSaving}
          />
        </div>

      </div>
    </div>
  );
}
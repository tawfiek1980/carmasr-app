import {
  LayoutDashboard,
  Truck,
  Users,
  Settings,
} from "lucide-react";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: Props) {
  const items = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { id: "listings", label: "الإعلانات", icon: Truck },
    { id: "users", label: "المستخدمين", icon: Users },
    { id: "settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r min-h-screen p-4">
      <h2 className="text-xl font-bold mb-6">Admin</h2>

      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex items-center gap-2 w-full p-2 rounded mb-2 ${
            activeTab === item.id ? "bg-black text-white" : "hover:bg-gray-100"
          }`}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
export default function DashboardCards({ stats }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded shadow">Users: {stats.users || 0}</div>
      <div className="bg-white p-4 rounded shadow">Listings: {stats.listings || 0}</div>
      <div className="bg-white p-4 rounded shadow">Loads: {stats.loads || 0}</div>
      <div className="bg-white p-4 rounded shadow">Jobs: {stats.jobs || 0}</div>
    </div>
  );
}
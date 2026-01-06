"use client";

import type { Profile } from "@/lib/types";

type AdminProfile = Profile & { created_at?: string | null };

type Props = {
  profiles: AdminProfile[];
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const iso = new Date(value).toISOString();
  return iso.slice(0, 10);
};

export default function UsersClient({ profiles }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-gray-600">Latest 200 profiles.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{profiles.length} total</span>
      </div>
      <div className="mt-3 overflow-auto">
        {profiles.length === 0 ? (
          <p className="text-sm text-gray-600">No users found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Timezone</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Reminder</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Push opt-in</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Admin</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((p) => {
                const reminder = p.reminder_time ? p.reminder_time.slice(0, 5) : "—";
                const timezone = p.timezone || "UTC";
                const pushOptIn = p.push_opt_in ? "Yes" : "No";
                const isAdmin = p.is_admin ? "Yes" : "No";
                const userLabel = `${p.user_id.slice(0, 6)}…`;
                return (
                  <tr key={p.user_id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-800" title={p.user_id}>
                      {userLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{timezone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{reminder}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{pushOptIn}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{isAdmin}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">{formatDate(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

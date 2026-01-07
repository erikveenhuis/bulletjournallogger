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
    <div className="bujo-card bujo-ruled">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Users</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">Latest 200 profiles.</p>
        </div>
        <span className="bujo-chip text-xs">{profiles.length} total</span>
      </div>
      <div className="mt-3 overflow-auto">
        {profiles.length === 0 ? (
          <p className="text-sm text-[var(--bujo-subtle)]">No users found.</p>
        ) : (
          <table className="min-w-full divide-y divide-[var(--bujo-border)] text-sm">
            <thead className="bg-[var(--bujo-paper)]">
              <tr className="text-left text-[var(--bujo-ink)]">
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Timezone</th>
                <th className="px-3 py-2 font-medium">Reminder</th>
                <th className="px-3 py-2 font-medium">Push opt-in</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bujo-border)]">
              {profiles.map((p) => {
                const reminder = p.reminder_time ? p.reminder_time.slice(0, 5) : "—";
                const timezone = p.timezone || "UTC";
                const pushOptIn = p.push_opt_in ? "Yes" : "No";
                const isAdmin = p.is_admin ? "Yes" : "No";
                const userLabel = `${p.user_id.slice(0, 6)}…`;
                return (
                  <tr key={p.user_id} className="align-top text-[var(--bujo-ink)]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{userLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{timezone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{reminder}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{pushOptIn}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{isAdmin}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(p.created_at)}</td>
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

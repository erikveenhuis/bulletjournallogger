"use client";

import { useMemo, useState } from "react";
import type { AdminProfile } from "@/lib/types";

type Props = {
  profiles: AdminProfile[];
  currentUserId: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const iso = new Date(value).toISOString();
  return iso.slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const iso = new Date(value).toISOString();
  return iso.replace("T", " ").replace(/\.\d+Z$/, " UTC");
};

export default function UsersClient({ profiles, currentUserId }: Props) {
  const [rows, setRows] = useState<AdminProfile[]>(profiles);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const email = p.email?.toLowerCase() ?? "";
      const uid = p.user_id.toLowerCase();
      const timezone = p.timezone?.toLowerCase() ?? "";
      return email.includes(q) || uid.includes(q) || timezone.includes(q);
    });
  }, [rows, query]);

  const toggleAdmin = async (userId: string, nextValue: boolean) => {
    setPendingId(userId);
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, is_admin: nextValue }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update admin access.");
      setPendingId(null);
      return;
    }
    setRows((prev) => prev.map((p) => (p.user_id === userId ? { ...p, is_admin: nextValue } : p)));
    setMessage(nextValue ? "Admin access granted." : "Admin access removed.");
    setPendingId(null);
  };

  return (
    <div className="bujo-card bujo-torn">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Users</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">Latest 200 profiles.</p>
        </div>
        <span className="bujo-chip text-xs">
          {filtered.length} / {rows.length} shown
        </span>
      </div>
      <div className="mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by email, user id, or timezone"
          className="bujo-input w-full text-sm"
        />
      </div>
      <div className="mt-3 overflow-auto">
        {filtered.length === 0 ? (
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
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bujo-border)]">
              {filtered.map((p) => {
                const reminder = p.reminder_time ? p.reminder_time.slice(0, 5) : "—";
                const timezone = p.timezone || "UTC";
                const pushOptIn = p.push_opt_in ? "Yes" : "No";
                const isAdmin = p.is_admin ? "Yes" : "No";
                const created = formatDate(p.auth_created_at || p.created_at);
                const isSelf = p.user_id === currentUserId;
                const actionLabel = p.is_admin ? "Remove admin" : "Make admin";
                const disableAction = pendingId === p.user_id || (isSelf && p.is_admin);
                const userIdLabel = `${p.user_id.slice(0, 6)}…${p.user_id.slice(-4)}`;
                return (
                  <tr key={p.user_id} className="align-top text-[var(--bujo-ink)]">
                    <td className="min-w-[220px] px-3 py-2 text-xs">
                      <div className="font-medium">{p.email || "No email on record"}</div>
                      <div className="mt-1 font-mono text-[11px] text-[var(--bujo-subtle)]" title={p.user_id}>
                        {userIdLabel}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{timezone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{reminder}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{pushOptIn}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{isAdmin}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{created}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDateTime(p.last_sign_in_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {isSelf && <span className="mr-2 text-[11px] text-[var(--bujo-subtle)]">You</span>}
                      <button
                        onClick={() => toggleAdmin(p.user_id, !p.is_admin)}
                        disabled={disableAction}
                        className="bujo-btn-secondary text-xs disabled:opacity-60"
                      >
                        {pendingId === p.user_id ? "Saving..." : actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {message && <p className="mt-3 bujo-message text-sm">{message}</p>}
    </div>
  );
}
